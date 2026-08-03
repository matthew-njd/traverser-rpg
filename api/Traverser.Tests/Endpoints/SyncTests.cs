using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary><c>POST /api/v1/sync</c> — T2 §4, steps 1, 3, 4, 5, 6.</summary>
[Collection(TraverserApiCollection.Name)]
public class SyncTests(TraverserApiFixture api)
{
    private static readonly DateOnly Day1 = new(2026, 8, 1);
    private static readonly DateOnly Day2 = new(2026, 8, 2);

    private static object StepDelta(Guid id, DateOnly date, int steps) => new
    {
        client_delta_id = id,
        activity_date = date,
        source = "steps",
        steps_delta = steps,
        minutes_delta = 0,
        hr_tier = (int?)null,
        recorded_at = DateTime.UtcNow,
    };

    private static object HrDelta(Guid id, DateOnly date, int tier, int minutes) => new
    {
        client_delta_id = id,
        activity_date = date,
        source = "hr",
        steps_delta = 0,
        minutes_delta = minutes,
        hr_tier = tier,
        recorded_at = DateTime.UtcNow,
    };

    private static async Task<JsonElement> SyncAsync(HttpClient client, params object[] deltas)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas, content_version = 1 },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private static async Task<HttpResponseMessage> RawSyncAsync(HttpClient client, params object[] deltas) =>
        await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas, content_version = 1 },
            TraverserApiFixture.Json);

    // ---- Steps 1, 3, 4, 5, 6 --------------------------------------------------------------------

    /// <summary>
    /// T2 §4's own worked example, day 1: 8,000 steps and 45 minutes Vigorous → 400 + 225 = 625 XP.
    /// </summary>
    [Fact]
    public async Task A_days_steps_and_tier_minutes_become_xp()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var result = await SyncAsync(client,
            StepDelta(Guid.CreateVersion7(), Day1, 8_000),
            HrDelta(Guid.CreateVersion7(), Day1, tier: 2, minutes: 45));

        var day = Assert.Single(result.GetProperty("activity_days").EnumerateArray());

        Assert.Equal(8_000, day.GetProperty("steps").GetInt32());
        Assert.Equal(45, day.GetProperty("tier2_minutes").GetInt32());
        Assert.Equal(625, day.GetProperty("xp_awarded").GetInt32());
        Assert.Equal(625, result.GetProperty("player").GetProperty("xp_lifetime").GetInt64());
    }

    /// <summary>Step 6 — and it must accrue from the first sync or the Waymarker's history is
    /// permanently wrong, which is why it is in M1 despite Leagues being an M3 display concern.</summary>
    [Fact]
    public async Task Lifetime_steps_and_leagues_accrue()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 8_000));
        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day2, 6_200));

        Assert.Equal(14_200, result.GetProperty("player").GetProperty("lifetime_steps").GetInt64());
        Assert.Equal(14, result.GetProperty("leagues").GetInt64());
    }

    /// <summary>
    /// T2 §4 step 3 — **always `+ EXCLUDED`, never `= EXCLUDED`**. Two syncs touching one date must
    /// add; assignment would silently discard the earlier steps.
    /// </summary>
    [Fact]
    public async Task Two_syncs_for_one_date_merge_additively()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 2_000));
        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 3_400));

        var day = Assert.Single(result.GetProperty("activity_days").EnumerateArray());

        Assert.Equal(5_400, day.GetProperty("steps").GetInt32());
        Assert.Equal(270, day.GetProperty("xp_awarded").GetInt32());
    }

    /// <summary>
    /// ↯ **fixtures §11.6, end to end.** 15 Peak minutes then 12 more across two syncs: the second
    /// bills 5 at the Peak rate and 7 at Vigorous (70 XP), not 12 at Peak (84). Evaluating the cap
    /// per-delta fails silently and in the player's favour — no bug report will ever surface it.
    /// <para>
    /// The stored total is the second thing this pins: <c>tier3_minutes</c> must read **27**, the
    /// minutes actually worked. The cap governs the rate, never the record.
    /// </para>
    /// </summary>
    [Fact]
    public async Task The_tier_3_cap_is_charged_against_the_days_cumulative_minutes()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var first = await SyncAsync(client, HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 15));
        Assert.Equal(105, first.GetProperty("player").GetProperty("xp_lifetime").GetInt64());

        var second = await SyncAsync(client, HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 12));

        var day = Assert.Single(second.GetProperty("activity_days").EnumerateArray());

        Assert.Equal(175, second.GetProperty("player").GetProperty("xp_lifetime").GetInt64());
        Assert.Equal(175, day.GetProperty("xp_awarded").GetInt32());
        Assert.Equal(27, day.GetProperty("tier3_minutes").GetInt32());
    }

    /// <summary>
    /// The same two Peak deltas inside a *single* payload. The cap has to consume the day's
    /// allowance across the batch, not restart per delta.
    /// </summary>
    [Fact]
    public async Task The_tier_3_cap_holds_within_one_payload()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var result = await SyncAsync(client,
            HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 15),
            HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 12));

        var day = Assert.Single(result.GetProperty("activity_days").EnumerateArray());

        Assert.Equal(175, day.GetProperty("xp_awarded").GetInt32());
        Assert.Equal(27, day.GetProperty("tier3_minutes").GetInt32());
    }

    /// <summary>The cap is per calendar day, so a new date restarts the allowance in full.</summary>
    [Fact]
    public async Task The_tier_3_allowance_resets_on_a_new_date()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var result = await SyncAsync(client,
            HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 20),
            HrDelta(Guid.CreateVersion7(), Day2, tier: 3, minutes: 20));

        Assert.Equal(280, result.GetProperty("player").GetProperty("xp_lifetime").GetInt64());
    }

    [Fact]
    public async Task Crossing_the_threshold_levels_the_player_up()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        // 2,000 steps = 100 XP, exactly level 1's requirement (fixtures §4).
        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 2_000));

        var player = result.GetProperty("player");
        var levelUp = Assert.Single(result.GetProperty("level_ups").EnumerateArray());

        Assert.Equal(2, levelUp.GetProperty("level").GetInt32());
        Assert.Equal(3, levelUp.GetProperty("stat_points_awarded").GetInt32());
        Assert.Equal(2, player.GetProperty("level").GetInt32());
        Assert.Equal(0, player.GetProperty("xp_current").GetInt32());
        Assert.Equal(3, player.GetProperty("unspent_stat_points").GetInt32());
    }

    /// <summary>
    /// <c>step_goal_snapshot</c> is captured on insert and never updated (tech-01 §4). Raising the
    /// goal afterwards must not retroactively un-hit a day that was legitimately earned.
    /// </summary>
    [Fact]
    public async Task The_step_goal_snapshot_is_frozen_at_the_days_first_delta()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 7_500));

        var patch = await client.PatchAsJsonAsync(
            "/api/v1/players/me/settings", new { daily_step_goal = 12_000 }, TraverserApiFixture.Json);
        patch.EnsureSuccessStatusCode();

        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 100));
        var day = Assert.Single(result.GetProperty("activity_days").EnumerateArray());

        Assert.Equal(7_000, day.GetProperty("step_goal_snapshot").GetInt32());
        Assert.True(day.GetProperty("goal_met").GetBoolean());
    }

    [Fact]
    public async Task Goal_met_reflects_the_snapshot_not_the_current_goal()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 6_999));
        var day = Assert.Single(result.GetProperty("activity_days").EnumerateArray());

        Assert.False(day.GetProperty("goal_met").GetBoolean());
    }

    // ---- Idempotency ----------------------------------------------------------------------------

    /// <summary>
    /// ↯ **The replay test.** T2 §4 calls this the first integration test worth writing and T2 §8
    /// says that if a future change breaks the design, it breaks here. Apply a payload, apply the
    /// byte-identical payload again, and assert 0 XP, 0 Leagues, and a byte-identical player block.
    /// <para>
    /// ↯ Necessary but **not sufficient**, and it is worth knowing why. A pure replay accepts zero
    /// deltas, so the transaction short-circuits before the merge runs at all — this test proves the
    /// short-circuit, not the rule that produced it. Verified by mutation: swapping the merge to read
    /// the *request* instead of the returned set leaves this test green and fails
    /// <see cref="A_batch_mixing_new_and_replayed_deltas_credits_only_the_new_one"/>. That mixed
    /// batch is the case that actually pins "computed from the returned rows only"; the two belong
    /// together and neither should be deleted as redundant.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Replaying_an_identical_payload_changes_nothing()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        object[] payload =
        [
            StepDelta(Guid.CreateVersion7(), Day1, 8_000),
            HrDelta(Guid.CreateVersion7(), Day1, tier: 3, minutes: 25),
            StepDelta(Guid.CreateVersion7(), Day2, 6_200),
        ];

        var first = await SyncAsync(client, payload);
        var second = await SyncAsync(client, payload);

        // The player block, compared as raw JSON text — the spec's own wording is "byte-identical".
        Assert.Equal(
            first.GetProperty("player").GetRawText(),
            second.GetProperty("player").GetRawText());

        Assert.Equal(first.GetProperty("leagues").GetInt64(), second.GetProperty("leagues").GetInt64());

        Assert.Empty(second.GetProperty("level_ups").EnumerateArray());
        Assert.Empty(second.GetProperty("accepted_delta_ids").EnumerateArray());
        Assert.Empty(second.GetProperty("activity_days").EnumerateArray());
        Assert.Equal(3, second.GetProperty("duplicate_delta_ids").GetArrayLength());
    }

    /// <summary>
    /// The ledger must hold one row per delta after a replay, not two. Checked at the table rather
    /// than through the response, because a double insert that happened to produce the same numbers
    /// would still be corruption.
    /// </summary>
    [Fact]
    public async Task A_replay_inserts_no_second_ledger_row()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var deltaId = Guid.CreateVersion7();
        object[] payload = [StepDelta(deltaId, Day1, 3_000)];

        await SyncAsync(client, payload);
        await SyncAsync(client, payload);
        await SyncAsync(client, payload);

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(1, await db.SyncDeltas.CountAsync(d => d.PlayerId == playerId && d.ClientDeltaId == deltaId));
    }

    /// <summary>A partial replay credits only the genuinely new delta.</summary>
    [Fact]
    public async Task A_batch_mixing_new_and_replayed_deltas_credits_only_the_new_one()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var old = Guid.CreateVersion7();
        await SyncAsync(client, StepDelta(old, Day1, 2_000));

        var fresh = Guid.CreateVersion7();
        var result = await SyncAsync(client, StepDelta(old, Day1, 2_000), StepDelta(fresh, Day1, 1_000));

        Assert.Equal(3_000, Assert.Single(result.GetProperty("activity_days").EnumerateArray())
            .GetProperty("steps").GetInt32());

        Assert.Equal(fresh, Assert.Single(result.GetProperty("accepted_delta_ids").EnumerateArray()).GetGuid());
        Assert.Equal(old, Assert.Single(result.GetProperty("duplicate_delta_ids").EnumerateArray()).GetGuid());
    }

    /// <summary>
    /// One <c>client_delta_id</c> twice inside a single payload is a client bug, and it must not
    /// become a 500 or a double credit. First occurrence wins; the rest report as duplicates.
    /// </summary>
    [Fact]
    public async Task Duplicate_ids_within_one_payload_are_credited_once()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var id = Guid.CreateVersion7();
        var result = await SyncAsync(client, StepDelta(id, Day1, 2_000), StepDelta(id, Day1, 2_000));

        Assert.Equal(2_000, Assert.Single(result.GetProperty("activity_days").EnumerateArray())
            .GetProperty("steps").GetInt32());
        Assert.Single(result.GetProperty("accepted_delta_ids").EnumerateArray());
    }

    [Fact]
    public async Task An_empty_payload_is_a_valid_no_op()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 2_000));
        var result = await SyncAsync(client);

        Assert.Equal(2, result.GetProperty("player").GetProperty("level").GetInt32());
        Assert.Empty(result.GetProperty("accepted_delta_ids").EnumerateArray());
        Assert.Empty(result.GetProperty("activity_days").EnumerateArray());
    }

    // ---- The level cap ---------------------------------------------------------------------------

    /// <summary>
    /// ↯ At 60, <c>xp_current</c> freezes and nothing is banked, but <c>xp_lifetime</c> keeps
    /// accruing for display (GDD 1 §4, T2 §4 step 5). Both halves matter: banking would break the
    /// future expansion's pacing, and freezing lifetime would make the effort look unrecorded.
    /// </summary>
    [Fact]
    public async Task At_the_cap_xp_stops_but_lifetime_keeps_accruing()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            await db.Players.Where(p => p.Id == playerId).ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Level, 60)
                .SetProperty(p => p.XpCurrent, 0)
                .SetProperty(p => p.XpLifetime, 211_828L));
        }

        var result = await SyncAsync(client, StepDelta(Guid.CreateVersion7(), Day1, 20_000));
        var player = result.GetProperty("player");

        Assert.Equal(60, player.GetProperty("level").GetInt32());
        Assert.Equal(0, player.GetProperty("xp_current").GetInt32());
        Assert.Equal(JsonValueKind.Null, player.GetProperty("xp_to_next").ValueKind);
        Assert.Equal(212_828, player.GetProperty("xp_lifetime").GetInt64());
        Assert.Empty(result.GetProperty("level_ups").EnumerateArray());

        // Leagues and steps are unaffected by the cap — GDD 1 §4 is explicit that only the XP bar
        // retires; real-world effort keeps earning everything else.
        Assert.Equal(20_000, player.GetProperty("lifetime_steps").GetInt64());
    }

    // ---- Validation -------------------------------------------------------------------------------

    [Fact]
    public async Task Sync_requires_a_token()
    {
        var response = await RawSyncAsync(api.CreateClient(), StepDelta(Guid.CreateVersion7(), Day1, 100));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// T2 §6.1 makes additive merge the whole conflict model, so there is no legitimate producer of
    /// a negative delta — a downward revision from Health Connect is absorbed by the client's
    /// high-water mark and mints nothing at all (fixtures §11.7).
    /// </summary>
    [Fact]
    public async Task Negative_deltas_are_rejected()
    {
        var (_, token) = await api.RegisterAsync();

        var response = await RawSyncAsync(
            api.CreateAuthenticatedClient(token), StepDelta(Guid.CreateVersion7(), Day1, -500));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("validation_failed", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task An_hr_delta_without_a_tier_is_rejected()
    {
        var (_, token) = await api.RegisterAsync();

        var response = await RawSyncAsync(api.CreateAuthenticatedClient(token), new
        {
            client_delta_id = Guid.CreateVersion7(),
            activity_date = Day1,
            source = "hr",
            steps_delta = 0,
            minutes_delta = 30,
            hr_tier = (int?)null,
            recorded_at = DateTime.UtcNow,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_out_of_range_tier_is_rejected()
    {
        var (_, token) = await api.RegisterAsync();

        var response = await RawSyncAsync(
            api.CreateAuthenticatedClient(token), HrDelta(Guid.CreateVersion7(), Day1, tier: 4, minutes: 10));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// A rejected payload must leave nothing behind — the validation runs before the transaction
    /// opens, so a batch where only the last delta is bad cannot half-apply.
    /// </summary>
    [Fact]
    public async Task A_rejected_batch_applies_none_of_its_deltas()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await RawSyncAsync(client,
            StepDelta(Guid.CreateVersion7(), Day1, 5_000),
            StepDelta(Guid.CreateVersion7(), Day1, -1));

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(0, await db.SyncDeltas.CountAsync(d => d.PlayerId == playerId));
        Assert.Equal(0, await db.Players.Where(p => p.Id == playerId).Select(p => p.XpLifetime).SingleAsync());
    }

    /// <summary>Deltas are per-player; one token's sync must never touch another profile.</summary>
    [Fact]
    public async Task Deltas_are_scoped_to_the_authenticated_player()
    {
        var (_, firstToken) = await api.RegisterAsync("First");
        var (secondId, secondToken) = await api.RegisterAsync("Second");

        await SyncAsync(api.CreateAuthenticatedClient(firstToken), StepDelta(Guid.CreateVersion7(), Day1, 9_000));

        var second = await SyncAsync(api.CreateAuthenticatedClient(secondToken));

        Assert.Equal(0, second.GetProperty("player").GetProperty("lifetime_steps").GetInt64());

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(0, await db.SyncDeltas.CountAsync(d => d.PlayerId == secondId));
    }

    /// <summary>
    /// The per-delta XP is written back onto the ledger row, so a day's total can always be traced
    /// to the contributions that produced it.
    /// </summary>
    [Fact]
    public async Task Each_ledger_row_records_the_xp_it_produced()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var steps = Guid.CreateVersion7();
        var hr = Guid.CreateVersion7();

        await SyncAsync(client, StepDelta(steps, Day1, 8_000), HrDelta(hr, Day1, tier: 2, minutes: 45));

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var rows = await db.SyncDeltas.Where(d => d.PlayerId == playerId)
            .ToDictionaryAsync(d => d.ClientDeltaId, d => d.XpDelta);

        Assert.Equal(400, rows[steps]);
        Assert.Equal(225, rows[hr]);
    }
}
