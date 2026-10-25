using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>Out-of-battle healing (GDD 4 §4, T2 §3).</summary>
[Collection(TraverserApiCollection.Name)]
public class ItemUseTests(TraverserApiFixture api)
{
    private async Task<Guid> GiveItemAsync(Guid playerId, string itemDefId)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var item = new PlayerItem
        {
            PlayerId = playerId,
            ItemDefId = itemDefId,
            AcquiredAt = DateTime.UtcNow,
            Source = ItemSource.WildDrop,
        };

        db.PlayerItems.Add(item);
        await db.SaveChangesAsync();

        return item.Id;
    }

    private async Task<(bool Held, int Vigor)> StateOfAsync(Guid playerId, Guid itemId)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        return (
            await db.PlayerItems.AnyAsync(i => i.Id == itemId),
            (await db.Players.SingleAsync(p => p.Id == playerId)).VigorCurrent);
    }

    private async Task SetVigorAsync(Guid playerId, int vigor)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        await db.Players.Where(p => p.Id == playerId).ExecuteUpdateAsync(s => s.SetProperty(p => p.VigorCurrent, vigor));
    }

    private static async Task<HttpResponseMessage> UseAsync(HttpClient client, Guid itemId, int vigorAfter) =>
        await client.PostAsJsonAsync(
            $"/api/v1/players/me/items/{itemId}/use",
            new { vigor_after = vigorAfter },
            TraverserApiFixture.Json);

    [Fact]
    public async Task Using_a_heal_spends_it_and_sets_vigor()
    {
        var (playerId, token) = await api.RegisterAsync();
        var salve = await GiveItemAsync(playerId, "item_travelers_salve");

        await SetVigorAsync(playerId, 10);
        (await UseAsync(api.CreateAuthenticatedClient(token), salve, 14)).EnsureSuccessStatusCode();

        Assert.Equal((false, 14), await StateOfAsync(playerId, salve));
    }

    /// <summary>
    /// The mutation this guards: applying Vigor whenever the call arrives. A replay landing after a
    /// battle would then roll that battle's damage back.
    /// </summary>
    [Fact]
    public async Task A_replay_after_the_item_is_gone_changes_nothing()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var salve = await GiveItemAsync(playerId, "item_travelers_salve");

        (await UseAsync(client, salve, 14)).EnsureSuccessStatusCode();
        await SetVigorAsync(playerId, 6);
        (await UseAsync(client, salve, 14)).EnsureSuccessStatusCode();

        Assert.Equal((false, 6), await StateOfAsync(playerId, salve));
    }

    [Fact]
    public async Task A_battle_only_item_is_refused_and_kept()
    {
        var (playerId, token) = await api.RegisterAsync();
        var charm = await GiveItemAsync(playerId, "item_warhex");

        var response = await UseAsync(api.CreateAuthenticatedClient(token), charm, 20);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await StateOfAsync(playerId, charm)).Held);
    }

    [Fact]
    public async Task Another_players_item_is_left_alone()
    {
        var (ownerId, _) = await api.RegisterAsync();
        var (_, otherToken) = await api.RegisterAsync();
        var salve = await GiveItemAsync(ownerId, "item_travelers_salve");

        (await UseAsync(api.CreateAuthenticatedClient(otherToken), salve, 20)).EnsureSuccessStatusCode();

        Assert.True((await StateOfAsync(ownerId, salve)).Held);
    }

    [Fact]
    public async Task Using_requires_a_token()
    {
        var response = await UseAsync(api.CreateClient(), Guid.CreateVersion7(), 20);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
