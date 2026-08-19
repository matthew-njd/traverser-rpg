using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// <c>POST /api/v1/sync</c> — T2 §4 <b>step 2</b>: battles, their client-rolled drops, the bestiary,
/// the Vigor result, and consumed items.
/// <para>
/// The file's centre of gravity is the replay test. T2 §8: if a future change breaks the design, it
/// breaks here — and for battles "unchanged" has to mean no duplicate drop and no second bestiary
/// increment, not merely no second XP award.
/// </para>
/// <para>
/// ↯ Every inventory assertion filters out <c>Tutorial</c>-sourced rows. Registration grants GDD 10
/// §5.2's Blade and three Salves, so "the player holds one item" stopped being the same claim as
/// "this battle granted one item" — and only the second is what these tests are about.
/// </para>
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class BattleSyncTests(TraverserApiFixture api)
{
    private static readonly DateOnly Day = new(2026, 8, 17);

    private static object Battle(
        Guid clientBattleId,
        string outcome = "win",
        string enemyId = "enemy_harpy",
        int level = 15,
        int vigorAfter = 13,
        object[]? drops = null,
        Guid[]? itemsConsumed = null,
        string encounterKind = "wild") => new
        {
            client_battle_id = clientBattleId,
            grant_id = (Guid?)null,
            activity_date = Day,
            enemy_id = enemyId,
            encounter_kind = encounterKind,
            enemy_level = level,
            outcome,
            started_at = DateTime.UtcNow.AddMinutes(-3),
            ended_at = DateTime.UtcNow,
            vigor_after = vigorAfter,
            items_consumed = itemsConsumed ?? [],
            drops = drops ?? [],
        };

    private static object ItemDrop(string defId) => new { kind = "item", def_id = defId };

    private static object GearDrop(string defId, int level, int bonus) => new
    {
        kind = "gear",
        def_id = defId,
        level_at_drop = level,
        bonus_primary = bonus,
    };

    private static async Task<JsonElement> SyncAsync(HttpClient client, object[] battles, object[]? deltas = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas = deltas ?? [], content_version = 2, battles },
            TraverserApiFixture.Json);

        if (!response.IsSuccessStatusCode)
        {
            // The body carries the ProblemDetails; EnsureSuccessStatusCode alone hides why.
            Assert.Fail($"sync failed {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private async Task<T> ReadAsync<T>(Func<TraverserDbContext, T> read)
    {
        await using var scope = api.NewScope();

        return read(scope.ServiceProvider.GetRequiredService<TraverserDbContext>());
    }

    [Fact]
    public async Task A_won_battle_records_the_row_the_drops_and_the_bestiary()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, [Battle(Guid.CreateVersion7(), drops: [ItemDrop("item_stormveil")])]);

        var battles = await ReadAsync(db => db.Battles.Where(b => b.PlayerId == playerId).ToList());
        var items = await ReadAsync(db => db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).ToList());
        var bestiary = await ReadAsync(db => db.PlayerBestiary.Where(b => b.PlayerId == playerId).ToList());

        Assert.Single(battles);
        Assert.Equal("enemy_harpy", battles[0].EnemyId);
        Assert.Equal(45, battles[0].XpAwarded);

        Assert.Single(items);
        Assert.Equal("item_stormveil", items[0].ItemDefId);

        Assert.Single(bestiary);
        Assert.Equal(1, bestiary[0].EncounterCount);
        Assert.Equal(1, bestiary[0].DefeatCount);
    }

    /// <summary>
    /// ↯ **The replay test, extended.** M1's asserts 0 XP and a byte-identical player block; a battle
    /// payload must also grant **0 duplicate drops and 0 bestiary increments**. Deriving the gate
    /// from an "already granted?" lookup instead of from the `RETURNING` set is exactly how a boss's
    /// Divine drop gets granted twice (T2 §4.1), and this is what would catch it.
    /// </summary>
    [Fact]
    public async Task Replaying_a_battle_payload_grants_nothing_twice()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        object[] payload =
        [
            Battle(
                Guid.CreateVersion7(),
                drops: [ItemDrop("item_stormveil"), GearDrop("gear_weapon_mortal", 15, 2)]),
        ];

        var first = await SyncAsync(client, payload);
        var second = await SyncAsync(client, payload);

        // The spec's own wording for the player block is "byte-identical".
        Assert.Equal(
            first.GetProperty("player").GetRawText(),
            second.GetProperty("player").GetRawText());

        Assert.Single(await ReadAsync(db => db.Battles.Where(b => b.PlayerId == playerId).ToList()));
        Assert.Single(await ReadAsync(db => db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).ToList()));
        Assert.Single(await ReadAsync(db => db.PlayerGear.Where(g => g.PlayerId == playerId && g.Source != "tutorial").ToList()));

        var bestiary = await ReadAsync(db => db.PlayerBestiary.Single(b => b.PlayerId == playerId));

        Assert.Equal(1, bestiary.EncounterCount);
        Assert.Equal(1, bestiary.DefeatCount);
    }

    /// <summary>Same id twice inside one payload is a client bug that must not become two rows.</summary>
    [Fact]
    public async Task A_duplicate_inside_one_payload_inserts_once()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var battleId = Guid.CreateVersion7();

        await SyncAsync(client, [
            Battle(battleId, drops: [ItemDrop("item_stormveil")]),
            Battle(battleId, drops: [ItemDrop("item_stormveil")]),
        ]);

        Assert.Single(await ReadAsync(db => db.Battles.Where(b => b.PlayerId == playerId).ToList()));
        Assert.Single(await ReadAsync(db => db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).ToList()));
    }

    [Fact]
    public async Task A_mixed_payload_credits_only_the_new_battle()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);
        var replayed = Guid.CreateVersion7();

        await SyncAsync(client, [Battle(replayed, drops: [ItemDrop("item_stormveil")])]);
        await SyncAsync(client, [
            Battle(replayed, drops: [ItemDrop("item_stormveil")]),
            Battle(Guid.CreateVersion7(), drops: [ItemDrop("item_travelers_salve")]),
        ]);

        var items = await ReadAsync(db =>
            db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).Select(i => i.ItemDefId).ToList());

        Assert.Equal(2, items.Count);
        Assert.Contains("item_stormveil", items);
        Assert.Contains("item_travelers_salve", items);

        var bestiary = await ReadAsync(db => db.PlayerBestiary.Single(b => b.PlayerId == playerId));

        Assert.Equal(2, bestiary.EncounterCount);
    }

    // ---- XP (step 4) ----------------------------------------------------------------------------

    [Fact]
    public async Task Battle_xp_is_15_plus_twice_the_level_on_a_win()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var response = await SyncAsync(client, [Battle(Guid.CreateVersion7(), level: 15)]);

        // fixtures §10.8: 15 + 15 × 2 = 45.
        Assert.Equal(45, response.GetProperty("player").GetProperty("xp_current").GetInt32());

        var day = await ReadAsync(db => db.ActivityDays.Single(a => a.PlayerId == playerId));

        // Visible on the activity log, where a day's total can be reconciled against what made it.
        Assert.Equal(45, day.XpAwarded);
        Assert.Equal(Day, day.ActivityDate);
    }

    /// <summary>GDD 1 §2.3 — a loss awards nothing and costs nothing.</summary>
    [Fact]
    public async Task A_lost_battle_awards_no_xp()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var response = await SyncAsync(client, [Battle(Guid.CreateVersion7(), outcome: "loss", vigorAfter: 5)]);

        Assert.Equal(0, response.GetProperty("player").GetProperty("xp_current").GetInt32());

        var battle = await ReadAsync(db => db.Battles.Single(b => b.PlayerId == playerId));

        Assert.Equal(0, battle.XpAwarded);

        // The encounter still counts; only the defeat does not.
        var bestiary = await ReadAsync(db => db.PlayerBestiary.Single(b => b.PlayerId == playerId));

        Assert.Equal(1, bestiary.EncounterCount);
        Assert.Equal(0, bestiary.DefeatCount);
    }

    [Fact]
    public async Task A_fled_battle_awards_no_xp_and_no_defeat()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, [Battle(Guid.CreateVersion7(), outcome: "flee", vigorAfter: 20)]);

        var bestiary = await ReadAsync(db => db.PlayerBestiary.Single(b => b.PlayerId == playerId));

        Assert.Equal(1, bestiary.EncounterCount);
        Assert.Equal(0, bestiary.DefeatCount);
        Assert.Equal(0, await ReadAsync(db => db.Battles.Where(b => b.PlayerId == playerId).Sum(b => b.XpAwarded)));
    }

    // ---- Vigor and consumed items ---------------------------------------------------------------

    [Fact]
    public async Task Vigor_after_is_applied_and_the_anchor_reset()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var before = await ReadAsync(db => db.Players.Single(p => p.Id == playerId).VigorAnchorAt);

        await SyncAsync(client, [Battle(Guid.CreateVersion7(), vigorAfter: 7)]);

        var player = await ReadAsync(db => db.Players.Single(p => p.Id == playerId));

        Assert.Equal(7, player.VigorCurrent);
        Assert.True(player.VigorAnchorAt > before);
    }

    /// <summary>
    /// Two fights in one payload: the Vigor that stands is the one from the battle that ended last,
    /// not whichever happened to be last in the array.
    /// </summary>
    [Fact]
    public async Task The_last_battle_to_end_owns_the_vigor_result()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var earlier = Battle(Guid.CreateVersion7(), vigorAfter: 30) as dynamic;
        var later = Battle(Guid.CreateVersion7(), vigorAfter: 11);

        await SyncAsync(client, [
            later,
            new
            {
                client_battle_id = Guid.CreateVersion7(),
                grant_id = (Guid?)null,
                activity_date = Day,
                enemy_id = "enemy_harpy",
                encounter_kind = "wild",
                enemy_level = 15,
                outcome = "win",
                started_at = DateTime.UtcNow.AddMinutes(-30),
                ended_at = DateTime.UtcNow.AddMinutes(-20),
                vigor_after = 30,
                items_consumed = Array.Empty<Guid>(),
                drops = Array.Empty<object>(),
            },
        ]);

        _ = earlier;

        Assert.Equal(11, await ReadAsync(db => db.Players.Single(p => p.Id == playerId).VigorCurrent));
    }

    [Fact]
    public async Task Consumed_items_are_deleted_only_for_a_newly_inserted_battle()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        // Grant two Salves through a first battle, then spend one in a second.
        await SyncAsync(client, [
            Battle(Guid.CreateVersion7(), drops: [ItemDrop("item_travelers_salve"), ItemDrop("item_travelers_salve")]),
        ]);

        var salves = await ReadAsync(db =>
            db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).Select(i => i.Id).ToList());

        Assert.Equal(2, salves.Count);

        object[] spending = [Battle(Guid.CreateVersion7(), itemsConsumed: [salves[0]])];

        await SyncAsync(client, spending);
        await SyncAsync(client, spending);

        var remaining = await ReadAsync(db =>
            db.PlayerItems.Where(i => i.PlayerId == playerId && i.Source != ItemSource.Tutorial).Select(i => i.Id).ToList());

        Assert.Single(remaining);
        Assert.Equal(salves[1], remaining[0]);
    }

    // ---- The tutorial (GDD 10 §6) ---------------------------------------------------------------

    /// <summary>
    /// The battle row <em>is</em> the proof the tutorial happened, so there is no separate endpoint
    /// to call and nothing that can get out of step with it.
    /// </summary>
    [Fact]
    public async Task A_won_tutorial_battle_marks_the_tutorial_complete()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        Assert.Null(await ReadAsync(db => db.Players.Single(p => p.Id == playerId).TutorialCompletedAt));

        await SyncAsync(client, [
            Battle(Guid.CreateVersion7(), encounterKind: "tutorial", enemyId: "enemy_waystone_wisp", level: 1),
        ]);

        Assert.NotNull(await ReadAsync(db => db.Players.Single(p => p.Id == playerId).TutorialCompletedAt));
    }

    /// <summary>
    /// ↯ Set once. A replayed payload returns no rows at all, so the instant cannot move — which
    /// matters because it is the flag a restored device reads to know it has already been through
    /// onboarding, and a moving timestamp would be a fact about syncing rather than about playing.
    /// </summary>
    [Fact]
    public async Task Replaying_the_tutorial_battle_does_not_move_the_completion_instant()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        object[] payload = [
            Battle(Guid.CreateVersion7(), encounterKind: "tutorial", enemyId: "enemy_waystone_wisp", level: 1),
        ];

        await SyncAsync(client, payload);

        var first = await ReadAsync(db => db.Players.Single(p => p.Id == playerId).TutorialCompletedAt);

        await SyncAsync(client, payload);

        Assert.Equal(first, await ReadAsync(db => db.Players.Single(p => p.Id == playerId).TutorialCompletedAt));
    }

    /// <summary>An ordinary wild fight is not the tutorial, however early it happens.</summary>
    [Fact]
    public async Task A_wild_battle_leaves_the_tutorial_flag_alone()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await SyncAsync(client, [Battle(Guid.CreateVersion7())]);

        Assert.Null(await ReadAsync(db => db.Players.Single(p => p.Id == playerId).TutorialCompletedAt));
    }

    // ---- Shape ----------------------------------------------------------------------------------

    /// <summary>An M1-era client sends no `battles` key at all, and must keep working unchanged.</summary>
    [Fact]
    public async Task A_payload_with_no_battles_key_is_accepted()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas = Array.Empty<object>(), content_version = 2 },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();
    }
}
