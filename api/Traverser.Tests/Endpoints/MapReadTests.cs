using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// <c>GET /api/v1/players/me/map</c> — GDD 9's Road, derived on every read (tech-01 §4).
/// <para>
/// The property this file is really about: <b>nothing is stored</b>. Every assertion below sets up
/// its state through steps and battles and then reads the map, because a map that was written
/// somewhere would pass these tests once and drift afterwards.
/// </para>
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class MapReadTests(TraverserApiFixture api) : IDisposable
{
    private static readonly DateOnly Day = new(2026, 8, 22);

    public void Dispose() => api.Random.Reset();

    private static object Steps(int steps) => new
    {
        client_delta_id = Guid.NewGuid(),
        activity_date = Day,
        source = "steps",
        steps_delta = steps,
        minutes_delta = 0,
        hr_tier = (int?)null,
        recorded_at = DateTime.UtcNow,
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

    private static async Task SyncAsync(HttpClient client, object[]? deltas = null, object[]? battles = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync",
            new { deltas = deltas ?? [], content_version = 2, battles = battles ?? [] },
            TraverserApiFixture.Json);

        if (!response.IsSuccessStatusCode)
        {
            Assert.Fail($"sync failed {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }
    }

    private static async Task<JsonElement> MapAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/v1/players/me/map");

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    private static JsonElement Gate(JsonElement map, string gateId) =>
        map.GetProperty("gates").EnumerateArray().Single(g => g.GetProperty("gate_id").GetString() == gateId);

    private static JsonElement Zone(JsonElement map, string zoneId) =>
        map.GetProperty("zones").EnumerateArray().Single(z => z.GetProperty("zone_id").GetString() == zoneId);

    private static string StateOf(JsonElement map, string gateId) =>
        Gate(map, gateId).GetProperty("state").GetString()!;

    private async Task<HttpClient> PlayerAsync()
    {
        var (_, token) = await api.RegisterAsync();

        return api.CreateAuthenticatedClient(token);
    }

    [Fact]
    public async Task A_fresh_player_stands_at_zero_leagues_with_every_gate_locked()
    {
        var map = await MapAsync(await PlayerAsync());

        Assert.Equal(0, map.GetProperty("leagues").GetInt64());
        Assert.All(
            map.GetProperty("gates").EnumerateArray(),
            gate => Assert.Equal("locked", gate.GetProperty("state").GetString()));

        // Olympion is entered at registration; nothing beyond it is.
        Assert.True(Zone(map, "olympion").GetProperty("unlocked").GetBoolean());
        Assert.False(Zone(map, "valheon").GetProperty("unlocked").GetBoolean());
    }

    /// <summary>
    /// ↯ The off-by-one that would not look like a bug. A player standing on exactly the threshold
    /// has walked the full distance, and locking them out means walking another thousand steps for
    /// a fight they already earned — with nothing on screen to say why.
    /// </summary>
    [Fact]
    public async Task A_player_at_exactly_the_threshold_is_available_not_locked()
    {
        var client = await PlayerAsync();

        // 89 Leagues is one short of the Cyclops gate; 90 is standing on it.
        await SyncAsync(client, [Steps(89_999)]);

        Assert.Equal("locked", StateOf(await MapAsync(client), "gate_cyclops"));

        await SyncAsync(client, [Steps(1)]);

        var map = await MapAsync(client);

        Assert.Equal(90, map.GetProperty("leagues").GetInt64());
        Assert.Equal("available", StateOf(map, "gate_cyclops"));
    }

    /// <summary>A gate is defeated on <c>defeat_count &gt; 0</c>, and there is no path back down.</summary>
    [Fact]
    public async Task A_beaten_boss_reads_defeated()
    {
        var client = await PlayerAsync();

        await SyncAsync(client, [Steps(90_000)]);
        await SyncAsync(client, battles: [BossWin("enemy_cyclops")]);

        Assert.Equal("defeated", StateOf(await MapAsync(client), "gate_cyclops"));
    }

    /// <summary>
    /// GDD 9 §3's dual gate, read back off the map: distance opens the *gate*, and beating its boss
    /// is what opens the *zone*. Exactly one zone, not every zone behind the Waymarker.
    /// </summary>
    [Fact]
    public async Task A_defeated_final_boss_unlocks_exactly_one_zone()
    {
        var client = await PlayerAsync();

        await SyncAsync(client, [Steps(220_000)]);

        var beforeTheFight = await MapAsync(client);

        Assert.Equal("available", StateOf(beforeTheFight, "gate_cerberus"));
        Assert.False(Zone(beforeTheFight, "valheon").GetProperty("unlocked").GetBoolean());

        await SyncAsync(client, battles: [BossWin("enemy_cerberus")]);

        var map = await MapAsync(client);

        Assert.Equal(
            ["olympion", "valheon"],
            map.GetProperty("zones").EnumerateArray()
                .Where(z => z.GetProperty("unlocked").GetBoolean())
                .Select(z => z.GetProperty("zone_id").GetString()));
    }

    /// <summary>
    /// ↯ <b>A gate inside a locked zone stays locked, however far the Waymarker has gone.</b> Found
    /// on hardware at M3/P9: at 400 Leagues with Valheon still shut, Fenrir — a Valheon mid-boss at
    /// 380 — read <c>available</c> while the same response called his zone locked. Two contradicting
    /// claims in one document, and the fight is unreachable either way (GDD 9 §3). §4.2 defines
    /// availability by distance alone because it never anticipated this state; only the dual gate
    /// produces it.
    /// </summary>
    [Fact]
    public async Task A_gate_in_a_locked_zone_stays_locked_however_far_past_its_threshold()
    {
        var client = await PlayerAsync();

        await SyncAsync(client, [Steps(400_000)]);

        var map = await MapAsync(client);

        Assert.False(Zone(map, "valheon").GetProperty("unlocked").GetBoolean());
        Assert.Equal("locked", StateOf(map, "gate_fenrir"));
    }

    [Fact]
    public async Task That_same_gate_opens_the_moment_its_zone_does()
    {
        var client = await PlayerAsync();

        await SyncAsync(client, [Steps(400_000)]);
        await SyncAsync(client, battles: [BossWin("enemy_cerberus")]);

        var map = await MapAsync(client);

        Assert.True(Zone(map, "valheon").GetProperty("unlocked").GetBoolean());
        Assert.Equal("available", StateOf(map, "gate_fenrir"));
    }

    /// <summary>
    /// GDD 9 §4.1's segments are drawn to their own threshold range, not to scale — so the entry
    /// threshold is what the client fills against, and it has to arrive with the zone.
    /// </summary>
    [Fact]
    public async Task Each_zone_carries_the_threshold_its_segment_is_filled_against()
    {
        var map = await MapAsync(await PlayerAsync());

        long entryOf(string zoneId) => Zone(map, zoneId).GetProperty("entry_threshold_leagues").GetInt64();

        // Olympion is unlocked by no gate, so its segment starts at the origin (fixtures §8).
        Assert.Equal(0, entryOf("olympion"));
        Assert.Equal(220, entryOf("valheon"));
        Assert.Equal(900, entryOf("imperion"));
        Assert.Equal(2900, entryOf("egypt_tbd"));
    }

    /// <summary>
    /// GDD 9 §4.2's "coming soon" terminus is data, not a special case — the client greys it out
    /// from this flag rather than from a hardcoded zone id.
    /// </summary>
    [Fact]
    public async Task The_egyptian_terminus_reports_itself_unreleased()
    {
        var map = await MapAsync(await PlayerAsync());

        Assert.False(Zone(map, "egypt_tbd").GetProperty("is_released").GetBoolean());
        Assert.All(
            map.GetProperty("zones").EnumerateArray().Where(z => z.GetProperty("zone_id").GetString() != "egypt_tbd"),
            zone => Assert.True(zone.GetProperty("is_released").GetBoolean()));
    }

    /// <summary>
    /// GDD 9 §4.2 — a mid-boss is a recommended checkpoint the player walks past, a final boss is a
    /// wall. The client draws two different nodes from this, so the flag has to be on the wire.
    /// </summary>
    [Fact]
    public async Task Mid_boss_gates_are_soft_and_final_boss_gates_are_hard()
    {
        var map = await MapAsync(await PlayerAsync());

        Assert.False(Gate(map, "gate_cyclops").GetProperty("is_hard_gate").GetBoolean());
        Assert.Equal("mid_boss", Gate(map, "gate_cyclops").GetProperty("gate_kind").GetString());
        Assert.Null(Gate(map, "gate_cyclops").GetProperty("unlocks_zone_id").GetString());

        Assert.True(Gate(map, "gate_cerberus").GetProperty("is_hard_gate").GetBoolean());
        Assert.Equal("final_boss", Gate(map, "gate_cerberus").GetProperty("gate_kind").GetString());
        Assert.Equal("valheon", Gate(map, "gate_cerberus").GetProperty("unlocks_zone_id").GetString());
    }

    [Fact]
    public async Task The_map_needs_a_token()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/players/me/map");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
