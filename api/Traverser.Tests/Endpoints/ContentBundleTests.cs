using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// <c>GET /content/bundle</c> (tech-02 §3, T4 §5.1).
/// <para>
/// Nothing here re-asserts a content <em>value</em>: <c>ContentSeedTests</c> checks the rows
/// against the fixtures already, and the bundle is a projection of those rows. What this covers is
/// the projection itself — that every table is in the payload, that the numbers survive the wire as
/// decimal strings, and that the ETag negotiation works.
/// </para>
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class ContentBundleTests(TraverserApiFixture api)
{
    private async Task<JsonElement> GetBundleAsync()
    {
        var (_, token) = await api.RegisterAsync();
        var response = await api.CreateAuthenticatedClient(token).GetAsync("/api/v1/content/bundle");

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
    }

    /// <summary>
    /// Row-for-row against the database, table by table. A table the endpoint forgets to select is
    /// the whole failure mode here — the payload still parses, still validates, and the client
    /// silently holds no gear.
    /// </summary>
    [Fact]
    public async Task Bundle_carries_every_content_row()
    {
        var bundle = await GetBundleAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var expected = new Dictionary<string, int>
        {
            ["game_types"] = await db.GameTypes.CountAsync(),
            ["type_effectiveness"] = await db.TypeEffectiveness.CountAsync(),
            ["zones"] = await db.Zones.CountAsync(),
            ["zone_gates"] = await db.ZoneGates.CountAsync(),
            ["enemies"] = await db.Enemies.CountAsync(),
            ["enemy_stat_scaling"] = await db.EnemyStatScaling.CountAsync(),
            ["enemy_moves"] = await db.EnemyMoves.CountAsync(),
            ["enemy_drop_pool"] = await db.EnemyDropPools.CountAsync(),
            ["player_skill_defs"] = await db.PlayerSkillDefs.CountAsync(),
            ["gear_moves"] = await db.GearMoves.CountAsync(),
            ["gear_defs"] = await db.GearDefs.CountAsync(),
            ["gear_tier_bonuses"] = await db.GearTierBonuses.CountAsync(),
            ["item_defs"] = await db.ItemDefs.CountAsync(),
            ["drop_rates"] = await db.DropRates.CountAsync(),
            ["level_milestones"] = await db.LevelMilestones.CountAsync(),
            ["streak_milestones"] = await db.StreakMilestones.CountAsync(),
            ["xp_curve"] = await db.XpCurve.CountAsync(),
        };

        foreach (var (field, count) in expected)
        {
            Assert.Equal(count, bundle.GetProperty(field).GetArrayLength());
            Assert.True(count > 0, $"{field} is empty in the database, so this proves nothing");
        }

        Assert.Equal(
            await db.ContentVersions.Select(v => v.Version).SingleAsync(),
            bundle.GetProperty("content_version").GetInt32());
    }

    /// <summary>
    /// tech-02 §2 — "integers or decimal strings, never floats". Asserted as raw JSON text, because
    /// a deserialiser that parses `"0.50"` and one that parses `0.5` both hand back 0.5m.
    /// </summary>
    [Fact]
    public async Task Decimals_travel_as_strings_at_their_column_scale()
    {
        var bundle = await GetBundleAsync();

        var multiplier = bundle.GetProperty("type_effectiveness")[0].GetProperty("multiplier");

        Assert.Equal(JsonValueKind.String, multiplier.ValueKind);
        Assert.Matches(@"^\d\.\d{2}$", multiplier.GetString());

        var rate = bundle.GetProperty("enemy_stat_scaling")[0].GetProperty("rate");

        Assert.Equal(JsonValueKind.String, rate.ValueKind);
        Assert.Matches(@"^\d+\.\d{3}$", rate.GetString());
    }

    /// <summary>Closed sets travel as their stored text, matching the CHECK constraints.</summary>
    [Fact]
    public async Task Enums_travel_as_snake_case_text()
    {
        var bundle = await GetBundleAsync();

        var roles = bundle.GetProperty("enemies").EnumerateArray()
            .Select(e => e.GetProperty("role").GetString())
            .ToHashSet();

        Assert.Contains("tutorial", roles);
        Assert.Subset(new HashSet<string?> { "wild", "mid_boss", "zone_boss", "tutorial" }, roles);
    }

    [Fact]
    public async Task Bundle_is_etagged_with_the_content_version_and_304s_on_a_match()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var first = await client.GetAsync("/api/v1/content/bundle");

        first.EnsureSuccessStatusCode();

        var etag = first.Headers.ETag;

        Assert.NotNull(etag);

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();
        var version = await db.ContentVersions.Select(v => v.Version).SingleAsync();

        Assert.Equal($"\"{version}\"", etag.Tag);

        client.DefaultRequestHeaders.IfNoneMatch.Add(etag);

        var second = await client.GetAsync("/api/v1/content/bundle");

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    /// <summary>A stale tag is the case that must still serve — a 304 here is a client stuck on old content.</summary>
    [Fact]
    public async Task A_stale_etag_serves_the_bundle()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        client.DefaultRequestHeaders.IfNoneMatch.Add(new EntityTagHeaderValue("\"0\""));

        var response = await client.GetAsync("/api/v1/content/bundle");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
