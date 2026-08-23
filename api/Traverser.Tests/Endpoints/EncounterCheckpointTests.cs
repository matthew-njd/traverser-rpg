using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// <c>POST /api/v1/sync</c> — T2 §4 <b>steps 7 and 8</b>: gate evaluation, and GDD 9 §5's three
/// encounter sources against one daily pool.
/// <para>
/// ↯ Every test here scripts <see cref="TraverserApiFixture.Random"/> and resets it afterwards. The
/// source is a singleton shared with every other class in the collection, and a leaked
/// <c>Always(0.0)</c> turns some unrelated test's setup steps into five encounters.
/// </para>
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class EncounterCheckpointTests(TraverserApiFixture api) : IDisposable
{
    private static readonly DateOnly Day = new(2026, 8, 22);

    public void Dispose() => api.Random.Reset();

    private static object Steps(int steps, DateOnly? date = null) => new
    {
        client_delta_id = Guid.NewGuid(),
        activity_date = date ?? Day,
        source = "steps",
        steps_delta = steps,
        minutes_delta = 0,
        hr_tier = (int?)null,
        recorded_at = DateTime.UtcNow,
    };

    private static object Session(string key, int tier1, DateOnly? date = null) => new
    {
        external_session_id = key,
        started_at = DateTime.UtcNow.AddHours(-1),
        ended_at = (DateTime?)null,
        activity_date = date ?? Day,
        tier1_minutes = tier1,
        tier2_minutes = 0,
        tier3_minutes = 0,
    };

    private static object Explore(Guid operationId, string zoneId, DateOnly? date = null) => new
    {
        operation_id = operationId,
        zone_id = zoneId,
        activity_date = date ?? Day,
    };

    private static object BossWin(string enemyId) => new
    {
        client_battle_id = Guid.NewGuid(),
        grant_id = (Guid?)null,
        activity_date = Day,
        enemy_id = enemyId,
        encounter_kind = "zone_boss",
        enemy_level = 20,
        outcome = "win",
        started_at = DateTime.UtcNow.AddMinutes(-3),
        ended_at = DateTime.UtcNow,
        vigor_after = 9,
        items_consumed = Array.Empty<Guid>(),
        drops = Array.Empty<object>(),
    };

    private static async Task<JsonElement> SyncAsync(
        HttpClient client,
        object[]? deltas = null,
        object[]? sessions = null,
        object[]? explores = null,
        object[]? battles = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new
            {
                deltas = deltas ?? [],
                content_version = 2,
                battles = battles ?? [],
                sessions = sessions ?? [],
                explores = explores ?? [],
            },
            TraverserApiFixture.Json);

        if (!response.IsSuccessStatusCode)
        {
            Assert.Fail($"sync failed {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private static int GrantCount(JsonElement body) => body.GetProperty("encounter_grants").GetArrayLength();

    private static string[] Grants(JsonElement body, string property) =>
        [.. body.GetProperty("encounter_grants").EnumerateArray().Select(g => g.GetProperty(property).GetString()!)];

    private async Task<T> ReadAsync<T>(Func<TraverserDbContext, T> read)
    {
        await using var scope = api.NewScope();

        return read(scope.ServiceProvider.GetRequiredService<TraverserDbContext>());
    }

    /// <summary>
    /// ↯ Returns the id as well as the client, and every row assertion below filters on it. One
    /// database serves the whole collection, so `ActivityDays.Single(a => a.ActivityDate == Day)`
    /// finds every player that ever synced that date.
    /// </summary>
    private async Task<(Guid PlayerId, HttpClient Client)> PlayerAsync()
    {
        var (playerId, token) = await api.RegisterAsync();

        return (playerId, api.CreateAuthenticatedClient(token));
    }

    // ---- Step 8: forward travel ---------------------------------------------------------------

    /// <summary>
    /// ↯ **The arithmetic the whole source rests on** — <c>floor(new/1000) - floor(old/1000)</c>
    /// rolls, not one per sync. Uploading is not what earns a chance; crossing a thousandth step is.
    /// </summary>
    [Fact]
    public async Task Travel_rolls_once_per_newly_crossed_league()
    {
        var (playerId, client) = await PlayerAsync();

        api.Random.Always(0.0);

        var first = await SyncAsync(client, [Steps(3_400)]);

        Assert.Equal(3, GrantCount(first));

        // 3,400 → 3,900 crosses nothing, however many times the client syncs.
        var second = await SyncAsync(client, [Steps(500)]);

        Assert.Equal(0, GrantCount(second));

        // And the 600 that completes League 4 pays out exactly once.
        var third = await SyncAsync(client, [Steps(600)]);

        Assert.Equal(1, GrantCount(third));
    }

    /// <summary>A roll above the 25% chance grants nothing, and costs the day nothing either.</summary>
    [Fact]
    public async Task A_failed_travel_roll_spends_no_room_in_the_pool()
    {
        var (playerId, client) = await PlayerAsync();

        api.Random.Always(0.99);

        var body = await SyncAsync(client, [Steps(4_000)]);

        Assert.Equal(0, GrantCount(body));

        var used = await ReadAsync(db => db.ActivityDays.Single(a => a.PlayerId == playerId && a.ActivityDate == Day).EncountersUsed);

        Assert.Equal(0, used);
    }

    /// <summary>
    /// GDD 9 §5.3 — a week walked offline and synced at once still yields 5. The steps, the XP and
    /// the Leagues all land in full; only the encounters stop.
    /// </summary>
    [Fact]
    public async Task The_daily_cap_holds_when_one_sync_crosses_many_leagues()
    {
        var (playerId, client) = await PlayerAsync();

        api.Random.Always(0.0);

        var body = await SyncAsync(client, [Steps(40_000)]);

        Assert.Equal(5, GrantCount(body));
        Assert.Equal(40, body.GetProperty("leagues").GetInt64());

        var day = await ReadAsync(db => db.ActivityDays.Single(a => a.PlayerId == playerId && a.ActivityDate == Day));

        Assert.Equal(5, day.EncountersUsed);
        Assert.Equal(40_000, day.Steps);
    }

    /// <summary>
    /// T2 §8's replay property, reached from step 8's end: a resent batch merges nothing, so
    /// <c>lifetime_steps</c> does not move, so no League is crossed and no grant is issued.
    /// </summary>
    [Fact]
    public async Task A_replayed_payload_issues_no_second_grant()
    {
        var (playerId, client) = await PlayerAsync();
        var delta = Steps(2_000);

        api.Random.Always(0.0);

        var first = await SyncAsync(client, [delta]);
        var replay = await SyncAsync(client, [delta]);

        Assert.Equal(2, GrantCount(first));
        Assert.Equal(0, GrantCount(replay));

        var stored = await ReadAsync(db => db.EncounterGrants.Count(g => g.PlayerId == playerId && g.ActivityDate == Day));

        Assert.Equal(2, stored);
    }

    /// <summary>
    /// GDD 9 §5.1 — "the zone segment that League falls within". A player who has opened Valheon
    /// draws Valheon's roster past League 220 and Olympion's before it.
    /// </summary>
    [Fact]
    public async Task A_roll_draws_from_the_segment_its_league_falls_within()
    {
        var (playerId, client) = await PlayerAsync();

        // Short of the gate, then beat Cerberus — half the dual gate, so nothing opens yet.
        await SyncAsync(client, [Steps(218_000)]);
        await SyncAsync(client, battles: [BossWin("enemy_cerberus")]);

        api.Random.Always(0.0);

        // Step 7 runs first and opens Valheon inside this same sync, so the three Leagues crossed
        // straddle the seam: 219 is still Olympion, and 220 is Valheon's first.
        var body = await SyncAsync(client, [Steps(3_000)]);

        Assert.Equal(["valheon"], body.GetProperty("unlocked_zone_ids").EnumerateArray().Select(z => z.GetString()));
        Assert.Equal(["olympion", "valheon", "valheon"], Grants(body, "zone_id"));
    }

    // ---- Step 8: the workout session bonus -----------------------------------------------------

    /// <summary>
    /// GDD 9 §5.1 — 1 guaranteed roll per 15 Tier 1+ minutes, max 2 per session. Guaranteed means
    /// the scripted source is left declining everything and the grants arrive anyway.
    /// </summary>
    [Fact]
    public async Task A_session_grants_one_roll_per_fifteen_minutes_capped_at_two()
    {
        var (playerId, client) = await PlayerAsync();

        var body = await SyncAsync(client, sessions: [Session("hr:1", tier1: 47)]);

        Assert.Equal(2, GrantCount(body));
        Assert.Equal(["workout", "workout"], Grants(body, "source"));
    }

    /// <summary>
    /// ↯ The reason <c>encounter_rolls_granted</c> exists. T2 §6.3 has a growing session re-sent
    /// every pass with its minutes **set, not added** — so the same workout is seen over and over,
    /// and only the difference is owed.
    /// </summary>
    [Fact]
    public async Task A_re_observed_session_grants_only_what_it_has_not_already()
    {
        var (playerId, client) = await PlayerAsync();

        var first = await SyncAsync(client, sessions: [Session("hr:2", tier1: 16)]);
        var grown = await SyncAsync(client, sessions: [Session("hr:2", tier1: 31)]);
        var finished = await SyncAsync(client, sessions: [Session("hr:2", tier1: 62)]);

        Assert.Equal(1, GrantCount(first));
        Assert.Equal(1, GrantCount(grown));

        // Two is the ceiling; an hour-long session is not four.
        Assert.Equal(0, GrantCount(finished));

        var session = await ReadAsync(db => db.HrSessions.Single(h => h.PlayerId == playerId && h.ExternalSessionId == "hr:2"));

        Assert.Equal(2, session.EncounterRollsGranted);
        Assert.Equal(62, session.Tier1Minutes);
    }

    /// <summary>A capped-out day does not record a roll the session never received.</summary>
    [Fact]
    public async Task A_session_roll_the_cap_refused_is_not_counted_as_granted()
    {
        var (playerId, client) = await PlayerAsync();

        api.Random.Always(0.0);

        await SyncAsync(client, [Steps(5_000)]);

        api.Random.Always(1.0);

        var body = await SyncAsync(client, sessions: [Session("hr:3", tier1: 30)]);

        Assert.Equal(0, GrantCount(body));

        var session = await ReadAsync(db => db.HrSessions.Single(h => h.PlayerId == playerId && h.ExternalSessionId == "hr:3"));

        Assert.Equal(0, session.EncounterRollsGranted);
    }

    // ---- Step 8: Explore ------------------------------------------------------------------------

    /// <summary>GDD 9 §4.3 — a tap is guaranteed, and it spends from the same pool.</summary>
    [Fact]
    public async Task An_explore_tap_grants_an_encounter_from_the_shared_pool()
    {
        var (playerId, client) = await PlayerAsync();

        var body = await SyncAsync(client, explores: [Explore(Guid.NewGuid(), "olympion")]);

        Assert.Equal(1, GrantCount(body));
        Assert.Equal(["explore"], Grants(body, "source"));

        var used = await ReadAsync(db => db.ActivityDays.Single(a => a.PlayerId == playerId && a.ActivityDate == Day).EncountersUsed);

        Assert.Equal(1, used);
    }

    /// <summary>
    /// The operation ledger, not the payload, is what stops a second spend — a queued tap is resent
    /// until the client sees an answer, and each resend would otherwise be a free encounter.
    /// </summary>
    [Fact]
    public async Task A_replayed_explore_tap_spends_no_second_roll()
    {
        var (playerId, client) = await PlayerAsync();
        var tap = Explore(Guid.NewGuid(), "olympion");

        var first = await SyncAsync(client, explores: [tap]);
        var replay = await SyncAsync(client, explores: [tap]);

        Assert.Equal(1, GrantCount(first));
        Assert.Equal(0, GrantCount(replay));
    }

    /// <summary>GDD 9 §4.3 allows Explore only on an already-unlocked segment, re-checked here.</summary>
    [Fact]
    public async Task An_explore_tap_on_a_locked_zone_grants_nothing()
    {
        var (playerId, client) = await PlayerAsync();

        var body = await SyncAsync(client, explores: [Explore(Guid.NewGuid(), "valheon")]);

        Assert.Equal(0, GrantCount(body));
    }

    // ---- Step 7: gate evaluation ----------------------------------------------------------------

    /// <summary>GDD 9 §3's dual gate — distance <b>and</b> the prior boss, and neither alone.</summary>
    [Fact]
    public async Task Distance_alone_unlocks_nothing()
    {
        var (playerId, client) = await PlayerAsync();

        var body = await SyncAsync(client, [Steps(300_000)]);

        Assert.Empty(body.GetProperty("unlocked_zone_ids").EnumerateArray());

        var zones = await ReadAsync(db => db.PlayerZoneProgress.Count(z => z.PlayerId == playerId && z.ZoneId == "valheon"));

        Assert.Equal(0, zones);
    }

    [Fact]
    public async Task A_defeated_boss_short_of_the_threshold_unlocks_nothing()
    {
        var (playerId, client) = await PlayerAsync();

        await SyncAsync(client, [Steps(100_000)]);

        var body = await SyncAsync(client, battles: [BossWin("enemy_cerberus")]);

        Assert.Empty(body.GetProperty("unlocked_zone_ids").EnumerateArray());
    }

    /// <summary>
    /// Exactly one zone, and only once. A gate already walked through must not re-announce itself on
    /// every later sync — the client treats the list as news.
    /// </summary>
    [Fact]
    public async Task The_dual_gate_unlocks_exactly_one_zone_exactly_once()
    {
        var (playerId, client) = await PlayerAsync();

        await SyncAsync(client, [Steps(220_000)]);

        var opened = await SyncAsync(client, battles: [BossWin("enemy_cerberus")]);
        var later = await SyncAsync(client, [Steps(1_000)]);

        Assert.Equal(["valheon"], opened.GetProperty("unlocked_zone_ids").EnumerateArray().Select(z => z.GetString()));
        Assert.Empty(later.GetProperty("unlocked_zone_ids").EnumerateArray());
    }

    /// <summary>
    /// GDD 9 §3.1 — Cacus's gate exists so the Map can draw a locked terminus, but <c>egypt_tbd</c>
    /// seeds unreleased and opening it would hand the player a zone with nothing in it.
    /// </summary>
    [Fact]
    public async Task The_unreleased_terminus_stays_shut_even_when_both_halves_are_met()
    {
        var (playerId, client) = await PlayerAsync();

        await SyncAsync(client, [Steps(2_900_000)]);

        var body = await SyncAsync(client, battles: [BossWin("enemy_cacus")]);

        Assert.DoesNotContain("egypt_tbd", body.GetProperty("unlocked_zone_ids").EnumerateArray().Select(z => z.GetString()));
    }
}
