using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>Equip and unequip (GDD 8 §2, T2 §3).</summary>
[Collection(TraverserApiCollection.Name)]
public class GearEquipTests(TraverserApiFixture api)
{
    private async Task<Guid> GiveGearAsync(Guid playerId, string gearDefId, int bonus = 2)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var gear = new PlayerGear
        {
            PlayerId = playerId,
            GearDefId = gearDefId,
            LevelAtDrop = 5,
            BonusPrimary = bonus,
            AcquiredAt = DateTime.UtcNow,
            Source = "battle_drop",
        };

        db.PlayerGear.Add(gear);
        await db.SaveChangesAsync();

        return gear.Id;
    }

    private async Task<List<PlayerGear>> GearOfAsync(Guid playerId)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        return await db.PlayerGear.Where(g => g.PlayerId == playerId).ToListAsync();
    }

    private static async Task<HttpResponseMessage> EquipAsync(
        HttpClient client, Guid gearId, string? slot, int? vigorAfter = null) =>
        await client.PutAsJsonAsync(
            $"/api/v1/players/me/gear/{gearId}/equipped",
            new { equipped_slot = slot, vigor_after = vigorAfter },
            TraverserApiFixture.Json);

    /// <summary>Registration equips the starter Blade, so a second weapon has to displace it.</summary>
    [Fact]
    public async Task Equipping_into_an_occupied_slot_displaces_the_occupant()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var starter = (await GearOfAsync(playerId)).Single();
        var sword = await GiveGearAsync(playerId, "gear_weapon_heroic");

        var response = await EquipAsync(client, sword, "weapon");

        response.EnsureSuccessStatusCode();

        var gear = await GearOfAsync(playerId);

        Assert.Equal(GearSlot.Weapon, gear.Single(g => g.Id == sword).EquippedSlot);
        Assert.Null(gear.Single(g => g.Id == starter.Id).EquippedSlot);

        // The response is the profile, so the client can reconcile from it.
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
        Assert.Equal(2, body.GetProperty("gear").GetArrayLength());
    }

    [Fact]
    public async Task Replaying_an_equip_lands_the_same_result()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var armor = await GiveGearAsync(playerId, "gear_armor_mortal");

        (await EquipAsync(client, armor, "armor")).EnsureSuccessStatusCode();
        (await EquipAsync(client, armor, "armor")).EnsureSuccessStatusCode();

        Assert.Equal(GearSlot.Armor, (await GearOfAsync(playerId)).Single(g => g.Id == armor).EquippedSlot);
    }

    [Fact]
    public async Task A_null_slot_unequips()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var starter = (await GearOfAsync(playerId)).Single();

        (await EquipAsync(client, starter.Id, null)).EnsureSuccessStatusCode();

        Assert.Null((await GearOfAsync(playerId)).Single().EquippedSlot);
    }

    [Fact]
    public async Task A_piece_is_rejected_from_a_slot_it_does_not_fit()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var armor = await GiveGearAsync(playerId, "gear_armor_mortal");

        var response = await EquipAsync(client, armor, "weapon");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null((await GearOfAsync(playerId)).Single(g => g.Id == armor).EquippedSlot);
    }

    [Fact]
    public async Task Another_players_gear_is_not_found()
    {
        var (ownerId, _) = await api.RegisterAsync();
        var (_, otherToken) = await api.RegisterAsync();
        var gear = await GiveGearAsync(ownerId, "gear_weapon_heroic");

        var response = await EquipAsync(api.CreateAuthenticatedClient(otherToken), gear, "weapon");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("gear_not_found", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    /// <summary>Unequipping Vigor gear can leave current above the new max; the client sends the clamp.</summary>
    [Fact]
    public async Task Vigor_after_is_applied_only_when_sent()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var charm = await GiveGearAsync(playerId, "gear_accessory_mortal");

        (await EquipAsync(client, charm, "accessory")).EnsureSuccessStatusCode();
        var before = await VigorOfAsync(playerId);

        (await EquipAsync(client, charm, null, vigorAfter: 17)).EnsureSuccessStatusCode();

        Assert.Equal(20, before);
        Assert.Equal(17, await VigorOfAsync(playerId));
    }

    private async Task<int> VigorOfAsync(Guid playerId)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        return (await db.Players.SingleAsync(p => p.Id == playerId)).VigorCurrent;
    }

    [Fact]
    public async Task Equipping_requires_a_token()
    {
        var response = await EquipAsync(api.CreateClient(), Guid.CreateVersion7(), "weapon");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
