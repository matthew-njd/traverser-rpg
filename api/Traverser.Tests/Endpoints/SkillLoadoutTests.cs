using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Endpoints;

/// <summary>The skill loadout (GDD 2 §5, GDD 3 §4.1, T2 §3).</summary>
[Collection(TraverserApiCollection.Name)]
public class SkillLoadoutTests(TraverserApiFixture api)
{
    private async Task<(Guid PlayerId, HttpClient Client)> PlayerAtAsync(int level)
    {
        var (playerId, token) = await api.RegisterAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        await db.Players.Where(p => p.Id == playerId).ExecuteUpdateAsync(s => s.SetProperty(p => p.Level, level));

        return (playerId, api.CreateAuthenticatedClient(token));
    }

    private async Task WearTrinketAsync(Guid playerId, string gearDefId)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        db.PlayerGear.Add(new PlayerGear
        {
            PlayerId = playerId,
            GearDefId = gearDefId,
            LevelAtDrop = 15,
            BonusPrimary = 4,
            BonusSecondary = 4,
            EquippedSlot = GearSlot.Trinket,
            AcquiredAt = DateTime.UtcNow,
            Source = "battle_drop",
        });

        await db.SaveChangesAsync();
    }

    private static async Task<HttpResponseMessage> SetAsync(HttpClient client, params string[] ids) =>
        await client.PutAsJsonAsync("/api/v1/players/me/skills", new { skill_ids = ids }, TraverserApiFixture.Json);

    private static async Task<string[]> LoadoutOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        return body.GetProperty("equipped_skills").EnumerateArray()
            .Select(s => s.GetProperty("skill_id").GetString()!)
            .ToArray();
    }

    [Fact]
    public async Task Sets_the_loadout_in_slot_order_and_returns_it_on_the_profile()
    {
        var (_, client) = await PlayerAtAsync(22);

        var response = await SetAsync(client, "skill_titans_reach", "skill_iron_advance");

        response.EnsureSuccessStatusCode();
        Assert.Equal(["skill_titans_reach", "skill_iron_advance"], await LoadoutOf(response));
    }

    /// <summary>Sent whole, so a second call replaces rather than merges.</summary>
    [Fact]
    public async Task A_second_loadout_replaces_the_first()
    {
        var (_, client) = await PlayerAtAsync(22);

        (await SetAsync(client, "skill_titans_reach", "skill_iron_advance")).EnsureSuccessStatusCode();
        var response = await SetAsync(client, "skill_shadowstep");

        Assert.Equal(["skill_shadowstep"], await LoadoutOf(response));
    }

    [Fact]
    public async Task A_worn_trinket_move_can_take_a_slot()
    {
        var (playerId, client) = await PlayerAtAsync(16);

        await WearTrinketAsync(playerId, "gear_gatekeepers_ruse");

        var response = await SetAsync(client, "move_gatekeepers_ruse", "skill_shadowstep");

        response.EnsureSuccessStatusCode();
        Assert.Equal(["move_gatekeepers_ruse", "skill_shadowstep"], await LoadoutOf(response));
    }

    [Theory]
    [InlineData("skill_titans_reach")] // unlocks at 22
    [InlineData("skill_basic_attack")] // never takes a slot
    [InlineData("move_gatekeepers_ruse")] // no Trinket worn
    [InlineData("skill_nonexistent")]
    public async Task An_unavailable_id_is_refused(string id)
    {
        var (_, client) = await PlayerAtAsync(16);

        Assert.Equal(HttpStatusCode.BadRequest, (await SetAsync(client, id)).StatusCode);
    }

    [Fact]
    public async Task Five_slots_or_a_duplicate_are_refused()
    {
        var (_, client) = await PlayerAtAsync(30);

        var five = await SetAsync(
            client, "skill_iron_advance", "skill_thunderers_wrath", "skill_warlords_advance", "skill_shadowstep", "skill_titans_reach");
        var twice = await SetAsync(client, "skill_iron_advance", "skill_iron_advance");

        Assert.Equal(HttpStatusCode.BadRequest, five.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, twice.StatusCode);
    }
}
