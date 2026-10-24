using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>T2 §4 step 9 — GDD 11 §2–§4's streak, grace and quiet reset.</summary>
[Collection(TraverserApiCollection.Name)]
public class StreakTests(TraverserApiFixture api)
{
    private static readonly DateOnly Day1 = new(2026, 9, 1);

    private static DateOnly Day(int n) => Day1.AddDays(n - 1);

    private static object Steps(DateOnly date, int steps) => new
    {
        client_delta_id = Guid.CreateVersion7(),
        activity_date = date,
        source = "steps",
        steps_delta = steps,
        minutes_delta = 0,
        hr_tier = (int?)null,
        recorded_at = DateTime.UtcNow,
    };

    /// <summary>A sync made while <paramref name="today"/> was the device's local date.</summary>
    private static async Task<JsonElement> SyncOnAsync(HttpClient client, DateOnly today, params object[] deltas)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas, content_version = 1, local_date = today },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private static async Task TagRestDayAsync(HttpClient client, DateOnly date) =>
        (await client.PostAsJsonAsync(
            "/api/v1/players/me/rest-days",
            new { activity_date = date.ToString("yyyy-MM-dd"), vigor_after = 45 },
            TraverserApiFixture.Json)).EnsureSuccessStatusCode();

    private async Task<StreakCreditMethod?> CreditOnAsync(Guid playerId, DateOnly date)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        return await db.ActivityDays
            .Where(a => a.PlayerId == playerId && a.ActivityDate == date)
            .Select(a => a.StreakCreditMethod)
            .SingleOrDefaultAsync();
    }

    private static (int Current, int Longest) StreakOf(JsonElement sync)
    {
        var streak = sync.GetProperty("streak");

        return (streak.GetProperty("current").GetInt32(), streak.GetProperty("longest").GetInt32());
    }

    [Fact]
    public async Task Consecutive_goal_days_build_a_streak()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        await SyncOnAsync(client, Day(2), Steps(Day(2), 8_000));
        var result = await SyncOnAsync(client, Day(3), Steps(Day(3), 9_000));

        Assert.Equal((3, 3), StreakOf(result));
        Assert.Equal(StreakCreditMethod.GoalHit, await CreditOnAsync(playerId, Day(2)));
    }

    /// <summary>Today short of the goal has not broken anything — the day is not over.</summary>
    [Fact]
    public async Task An_unfinished_today_keeps_yesterdays_run()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        var result = await SyncOnAsync(client, Day(2), Steps(Day(2), 500));

        Assert.Equal((1, 1), StreakOf(result));
    }

    /// <summary>
    /// The evening walker: opened at noon, finished after the sync, and the rest arrived next
    /// morning. A day that was opened is a goal hit, so this must not spend grace.
    /// </summary>
    [Fact]
    public async Task Steps_arriving_after_midnight_on_an_opened_day_are_a_goal_hit()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 2_000));
        var result = await SyncOnAsync(client, Day(2), Steps(Day(1), 6_000));

        Assert.Equal(StreakCreditMethod.GoalHit, await CreditOnAsync(playerId, Day(1)));
        Assert.Equal((1, 1), StreakOf(result));
    }

    [Fact]
    public async Task A_goal_day_never_opened_is_credited_by_grace()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        var result = await SyncOnAsync(client, Day(3), Steps(Day(2), 7_500), Steps(Day(3), 7_000));

        Assert.Equal(StreakCreditMethod.AutoSyncGrace, await CreditOnAsync(playerId, Day(2)));
        Assert.Equal((3, 3), StreakOf(result));
    }

    /// <summary>GDD 11 §3.2's 48 hours: three days back is outside it, and the steps still count.</summary>
    [Fact]
    public async Task Grace_does_not_reach_past_the_48_hour_window()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var result = await SyncOnAsync(client, Day(4), Steps(Day(1), 7_000));

        Assert.Null(await CreditOnAsync(playerId, Day(1)));
        Assert.Equal(350, result.GetProperty("activity_days")[0].GetProperty("xp_awarded").GetInt32());
    }

    /// <summary>GDD 11 §3.2: 3 auto-credits per rolling 30 days. Over the cap, steps and XP still land.</summary>
    [Fact]
    public async Task A_fourth_grace_inside_30_days_is_refused()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        foreach (var day in new[] { 2, 4, 6 })
        {
            await SyncOnAsync(client, Day(day + 1), Steps(Day(day), 7_000));
        }

        var result = await SyncOnAsync(client, Day(9), Steps(Day(8), 7_000));

        Assert.Equal(StreakCreditMethod.AutoSyncGrace, await CreditOnAsync(playerId, Day(6)));
        Assert.Null(await CreditOnAsync(playerId, Day(8)));
        Assert.Equal(7_000, result.GetProperty("activity_days").EnumerateArray()
            .Single(d => d.GetProperty("activity_date").GetString() == "2026-09-08")
            .GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task The_grace_cap_rolls_off_after_30_days()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        foreach (var day in new[] { 2, 4, 6 })
        {
            await SyncOnAsync(client, Day(day + 1), Steps(Day(day), 7_000));
        }

        await SyncOnAsync(client, Day(33), Steps(Day(32), 7_000));

        Assert.Equal(StreakCreditMethod.AutoSyncGrace, await CreditOnAsync(playerId, Day(32)));
    }

    /// <summary>GDD 11 §3.1 — a Rest Day counts as active, so the run carries through it.</summary>
    [Fact]
    public async Task A_rest_day_carries_the_streak()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        await TagRestDayAsync(client, Day(2));
        await SyncOnAsync(client, Day(2));
        var result = await SyncOnAsync(client, Day(3), Steps(Day(3), 7_000));

        Assert.Equal(StreakCreditMethod.RestDayTag, await CreditOnAsync(playerId, Day(2)));
        Assert.Equal((3, 3), StreakOf(result));
    }

    /// <summary>The retroactive tag (GDD 11 §3.1) repairs yesterday on the next sync.</summary>
    [Fact]
    public async Task Tagging_yesterday_repairs_the_run()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        await SyncOnAsync(client, Day(2), Steps(Day(2), 1_000));
        await TagRestDayAsync(client, Day(2));
        var result = await SyncOnAsync(client, Day(3), Steps(Day(3), 7_000));

        Assert.Equal((3, 3), StreakOf(result));
    }

    /// <summary>
    /// GDD 11 §4: the counter resets and the record stays. A break is only a null credit — the day
    /// row carries nothing else, and there is nowhere for a notification to go.
    /// </summary>
    [Fact]
    public async Task A_break_resets_quietly_and_keeps_the_longest()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncOnAsync(client, Day(1), Steps(Day(1), 7_000));
        await SyncOnAsync(client, Day(2), Steps(Day(2), 7_000));
        await SyncOnAsync(client, Day(3), Steps(Day(3), 1_000));
        var result = await SyncOnAsync(client, Day(4), Steps(Day(4), 7_000));

        Assert.Equal((1, 2), StreakOf(result));
        Assert.Null(await CreditOnAsync(playerId, Day(3)));
    }

    /// <summary>
    /// The one-time backfill: credits history from before step 9, sets the longest run, and adds
    /// credit only — an existing grace stays grace and a missed day stays a break.
    /// </summary>
    [Fact]
    public async Task The_backfill_credits_history_and_finds_the_longest_run()
    {
        var (playerId, _) = await api.RegisterAsync();

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            ActivityDay Row(int n, bool goalMet = false, bool rest = false, StreakCreditMethod? credit = null) => new()
            {
                PlayerId = playerId,
                ActivityDate = Day(n),
                StepGoalSnapshot = 7_000,
                GoalMet = goalMet,
                RestTaggedAt = rest ? DateTime.UtcNow : null,
                StreakCreditMethod = credit,
            };

            db.ActivityDays.AddRange(
                Row(1, goalMet: true), Row(2, goalMet: true), Row(3, goalMet: true), Row(4, goalMet: true),
                Row(5),
                Row(6, rest: true),
                Row(7, goalMet: true, credit: StreakCreditMethod.AutoSyncGrace));

            await db.SaveChangesAsync();

            await db.Database.ExecuteSqlRawAsync(Api.Migrations.StreakBackfill.Sql);
            await db.Database.ExecuteSqlRawAsync(Api.Migrations.StreakBackfill.Sql);
        }

        Assert.Equal(StreakCreditMethod.GoalHit, await CreditOnAsync(playerId, Day(1)));
        Assert.Null(await CreditOnAsync(playerId, Day(5)));
        Assert.Equal(StreakCreditMethod.RestDayTag, await CreditOnAsync(playerId, Day(6)));
        Assert.Equal(StreakCreditMethod.AutoSyncGrace, await CreditOnAsync(playerId, Day(7)));

        await using var check = api.NewScope();
        var state = await check.ServiceProvider.GetRequiredService<TraverserDbContext>()
            .StreakStates.SingleAsync(s => s.PlayerId == playerId);

        Assert.Equal(4, state.LongestStreak);
    }

    /// <summary>A sync without a local date (an older client) leaves the streak alone.</summary>
    [Fact]
    public async Task No_local_date_skips_step_9()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas = new[] { Steps(Day(1), 7_000) }, content_version = 1 },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        Assert.Null(await CreditOnAsync(playerId, Day(1)));
    }
}
