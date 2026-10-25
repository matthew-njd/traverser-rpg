using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>GDD 4 §5.2 and GDD 8 §5.5's overflow: discards, and resolving a parked reward (T2 §3).</summary>
[Collection(TraverserApiCollection.Name)]
public class OverflowTests(TraverserApiFixture api)
{
    private async Task<T> ReadAsync<T>(Func<TraverserDbContext, Task<T>> read)
    {
        await using var scope = api.NewScope();

        return await read(scope.ServiceProvider.GetRequiredService<TraverserDbContext>());
    }

    private async Task<Guid> ParkAsync(Guid playerId, PendingReward reward)
    {
        reward.PlayerId = playerId;
        reward.CreatedAt = DateTime.UtcNow;

        return await ReadAsync(async db =>
        {
            db.PendingRewards.Add(reward);
            await db.SaveChangesAsync();

            return reward.Id;
        });
    }

    [Fact]
    public async Task Discarding_an_item_removes_it_and_a_replay_is_harmless()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var salve = await ReadAsync(db => db.PlayerItems.Where(i => i.PlayerId == playerId).Select(i => i.Id).FirstAsync());

        (await client.PostAsync($"/api/v1/players/me/items/{salve}/discard", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/v1/players/me/items/{salve}/discard", null)).EnsureSuccessStatusCode();

        Assert.False(await ReadAsync(db => db.PlayerItems.AnyAsync(i => i.Id == salve)));
    }

    /// <summary>Registration equips the starter Blade, so it is the worn piece to refuse.</summary>
    [Fact]
    public async Task A_worn_piece_cannot_be_discarded()
    {
        var (playerId, token) = await api.RegisterAsync();
        var blade = await ReadAsync(db => db.PlayerGear.Where(g => g.PlayerId == playerId).Select(g => g.Id).SingleAsync());

        var response = await api.CreateAuthenticatedClient(token).PostAsync($"/api/v1/players/me/gear/{blade}/discard", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True(await ReadAsync(db => db.PlayerGear.AnyAsync(g => g.Id == blade)));
    }

    /// <summary>The device mints the id and has already inserted the row, so both tiers name it.</summary>
    [Fact]
    public async Task Keeping_a_parked_reward_lands_it_once_with_the_device_id()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var reward = await ParkAsync(playerId, new PendingReward
        {
            Kind = PendingRewardKind.Gear, GearDefId = "gear_armor_heroic", LevelAtDrop = 15, BonusPrimary = 4, Source = "level_milestone",
        });
        var newId = Guid.CreateVersion7();
        var body = new { resolution = "kept", new_id = newId };

        (await client.PostAsJsonAsync($"/api/v1/players/me/pending-rewards/{reward}", body, TraverserApiFixture.Json)).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/v1/players/me/pending-rewards/{reward}", body, TraverserApiFixture.Json)).EnsureSuccessStatusCode();

        var piece = await ReadAsync(db => db.PlayerGear.SingleAsync(g => g.Id == newId));

        Assert.Equal(4, piece.BonusPrimary);
        Assert.Equal(PendingRewardResolution.Kept, await ReadAsync(db => db.PendingRewards.Where(r => r.Id == reward).Select(r => r.Resolution).SingleAsync()));
    }

    [Fact]
    public async Task Discarding_a_parked_reward_grants_nothing()
    {
        var (playerId, token) = await api.RegisterAsync();
        var reward = await ParkAsync(playerId, new PendingReward
        {
            Kind = PendingRewardKind.Item, ItemDefId = "item_sunder_oil", Source = "level_milestone",
        });

        (await api.CreateAuthenticatedClient(token).PostAsJsonAsync(
            $"/api/v1/players/me/pending-rewards/{reward}", new { resolution = "discarded" }, TraverserApiFixture.Json)).EnsureSuccessStatusCode();

        Assert.False(await ReadAsync(db => db.PlayerItems.AnyAsync(i => i.PlayerId == playerId && i.ItemDefId == "item_sunder_oil")));
    }

    /// <summary>GDD 4 §5.1 — the guaranteed daily item is drawn only from commons with room.</summary>
    [Fact]
    public async Task The_daily_goal_skips_a_common_at_its_maximum()
    {
        var (playerId, token) = await api.RegisterAsync();

        // Pick 0 lands on item_battlebrand (max 3), so fill it to its maximum.
        await ReadAsync(async db =>
        {
            for (var i = 0; i < 3; i++)
            {
                db.PlayerItems.Add(new PlayerItem
                {
                    PlayerId = playerId, ItemDefId = "item_battlebrand", AcquiredAt = DateTime.UtcNow, Source = ItemSource.WildDrop,
                });
            }

            return await db.SaveChangesAsync();
        });

        var response = await api.CreateAuthenticatedClient(token).PostAsJsonAsync("/api/v1/sync", new
        {
            deltas = new[]
            {
                new
                {
                    client_delta_id = Guid.CreateVersion7(), activity_date = new DateOnly(2026, 10, 2), source = "steps",
                    steps_delta = 8000, minutes_delta = 0, hr_tier = (int?)null, recorded_at = DateTime.UtcNow,
                },
            },
            content_version = 1,
            local_date = new DateOnly(2026, 10, 2),
        }, TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        Assert.Equal(3, await ReadAsync(db => db.PlayerItems.CountAsync(i => i.PlayerId == playerId && i.ItemDefId == "item_battlebrand")));
        Assert.Equal(1, await ReadAsync(db => db.PlayerItems.CountAsync(i => i.PlayerId == playerId && i.Source == ItemSource.DailyGoal)));
    }
}
