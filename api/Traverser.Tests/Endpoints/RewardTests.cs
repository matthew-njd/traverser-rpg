using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// T2 §4 step 10 through a real sync. The scripted RNG declines every roll (1.0) and picks index 0,
/// so the 25% daily-goal piece never drops and every random slot is Weapon.
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class RewardTests(TraverserApiFixture api)
{
    private static readonly DateOnly Today = new(2026, 10, 1);

    private static object Steps(int steps) => new
    {
        client_delta_id = Guid.CreateVersion7(),
        activity_date = Today,
        source = "steps",
        steps_delta = steps,
        minutes_delta = 0,
        hr_tier = (int?)null,
        recorded_at = DateTime.UtcNow,
    };

    private static async Task<JsonElement> SyncAsync(HttpClient client, params object[] deltas)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas, content_version = 1, local_date = Today },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private static string[] Granted(JsonElement sync) =>
        sync.GetProperty("rewards_granted").EnumerateArray()
            .Select(r => r.GetProperty("def_id").GetString()!)
            .ToArray();

    private async Task EditAsync(Func<TraverserDbContext, Task> edit)
    {
        await using var scope = api.NewScope();

        await edit(scope.ServiceProvider.GetRequiredService<TraverserDbContext>());
    }

    [Fact]
    public async Task The_daily_goal_pays_one_common_item_per_day_and_no_more()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var first = await SyncAsync(client, Steps(8000));
        var again = await SyncAsync(client, Steps(500));

        Assert.Equal(["item_battlebrand"], Granted(first));
        Assert.Empty(Granted(again));
    }

    /// <summary>Retroactive by design: the grant table, not the sync that crossed the level, is the gate.</summary>
    [Fact]
    public async Task Level_milestones_at_or_below_the_level_pay_once()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await EditAsync(db => db.Players.Where(p => p.Id == playerId).ExecuteUpdateAsync(s => s.SetProperty(p => p.Level, 21)));

        var first = await SyncAsync(client);
        var replay = await SyncAsync(client);

        Assert.Equal(["item_ironhide_tincture", "gear_weapon_heroic", "item_sunder_oil"], Granted(first));
        Assert.Empty(Granted(replay));
    }

    /// <summary>GDD 11 §5.2 from the starter Blade: Armor and Accessory fill, then Weapon goes Heroic.</summary>
    [Fact]
    public async Task Streak_milestones_climb_the_ladder_once()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await EditAsync(db => db.StreakStates.Where(s => s.PlayerId == playerId).ExecuteUpdateAsync(s => s.SetProperty(x => x.LongestStreak, 14)));

        var first = await SyncAsync(client);
        var replay = await SyncAsync(client);

        Assert.Equal(["gear_armor_mortal", "gear_accessory_mortal", "gear_weapon_heroic"], Granted(first));
        Assert.Empty(Granted(replay));
    }

    [Fact]
    public async Task Entering_Valheon_pays_its_three_items_once()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await EditAsync(async db =>
        {
            db.PlayerZoneProgress.Add(new PlayerZoneProgress { PlayerId = playerId, ZoneId = "valheon", UnlockedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        });

        var first = await SyncAsync(client);
        var replay = await SyncAsync(client);

        Assert.Equal(["item_heralds_draft", "item_shadowbind", "item_thundercrack"], Granted(first));
        Assert.Empty(Granted(replay));
    }

    /// <summary>GDD 4 §6.3 — a milestone always delivers. Past the cap it parks; it never vanishes.</summary>
    [Fact]
    public async Task A_reward_past_the_item_cap_parks_as_pending()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await EditAsync(async db =>
        {
            // Registration's three Salves plus seventeen more is twenty.
            for (var i = 0; i < 17; i++)
            {
                db.PlayerItems.Add(new PlayerItem
                {
                    PlayerId = playerId, ItemDefId = "item_travelers_salve", AcquiredAt = DateTime.UtcNow, Source = ItemSource.WildDrop,
                });
            }

            await db.SaveChangesAsync();
            await db.Players.Where(p => p.Id == playerId).ExecuteUpdateAsync(s => s.SetProperty(p => p.Level, 10));
        });

        var sync = await SyncAsync(client);
        var pending = sync.GetProperty("pending_rewards").EnumerateArray().Single();

        Assert.Empty(Granted(sync));
        Assert.Equal("item_ironhide_tincture", pending.GetProperty("def_id").GetString());
    }
}
