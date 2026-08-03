using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// <c>GET /api/v1/players/me</c> — the mirror's one-shot repair path (tech-02 §3). When the client
/// suspects drift it replaces its whole local state with this document, so a field that is wrong or
/// absent here becomes wrong or absent on the device.
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class PlayerProfileTests(TraverserApiFixture api)
{
    private async Task<JsonElement> GetProfileAsync(string token) =>
        await api.CreateAuthenticatedClient(token)
            .GetFromJsonAsync<JsonElement>("/api/v1/players/me", TraverserApiFixture.Json);

    /// <summary>
    /// Named field by field rather than by round-tripping a DTO: the point of the check is that the
    /// *wire* carries snake_case matching tech-01's column names 1:1 (tech-02 §2), and a
    /// deserialization test would pass just as happily against camelCase.
    /// </summary>
    [Fact]
    public async Task The_snapshot_carries_every_mirrored_field_in_snake_case()
    {
        var (playerId, token) = await api.RegisterAsync();

        var profile = await GetProfileAsync(token);
        var player = profile.GetProperty("player");

        Assert.Equal(playerId, player.GetProperty("player_id").GetGuid());

        foreach (var field in new[]
        {
            "traverser_name", "timezone", "created_at", "level", "xp_current", "xp_to_next",
            "xp_lifetime", "unspent_stat_points", "alloc_vigor", "alloc_might", "alloc_resolve",
            "alloc_favor", "alloc_aegis", "alloc_stride", "vigor_current", "lifetime_steps",
            "daily_step_goal", "tutorial_completed_at",
        })
        {
            Assert.True(player.TryGetProperty(field, out _), $"player block is missing '{field}'");
        }

        foreach (var field in new[] { "player", "leagues", "streak", "settings", "unlocked_zone_ids" })
        {
            Assert.True(profile.TryGetProperty(field, out _), $"snapshot is missing '{field}'");
        }
    }

    /// <summary>
    /// **The Waymarker.** Leagues are <c>lifetime_steps / 1000</c> derived on read (GDD 9 §2.1) —
    /// storing them would create two numbers that can disagree. Integer division, so it floors.
    /// </summary>
    [Theory]
    [InlineData(0, 0)]
    [InlineData(999, 0)]
    [InlineData(1000, 1)]
    [InlineData(219_200, 219)]
    public async Task Leagues_are_derived_from_lifetime_steps(long steps, long expectedLeagues)
    {
        var (playerId, token) = await api.RegisterAsync();

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            await db.Players.Where(p => p.Id == playerId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.LifetimeSteps, steps));
        }

        var profile = await GetProfileAsync(token);

        Assert.Equal(expectedLeagues, profile.GetProperty("leagues").GetInt64());
    }

    /// <summary>
    /// <c>xp_to_next</c> comes from the seeded <c>xp_curve</c>, never recomputed — .NET's banker's
    /// rounding and JS's <c>Math.round</c> disagree at exact halves, and the two tiers must never
    /// disagree about whether the player levelled. Values are fixtures §4.
    /// </summary>
    [Theory]
    [InlineData(1, 100)]
    [InlineData(2, 207)]
    [InlineData(10, 1122)]
    [InlineData(59, 7234)]
    public async Task Xp_to_next_comes_from_the_seeded_curve(int level, int expected)
    {
        var (playerId, token) = await api.RegisterAsync();

        await SetLevelAsync(playerId, level);

        var profile = await GetProfileAsync(token);

        Assert.Equal(expected, profile.GetProperty("player").GetProperty("xp_to_next").GetInt32());
    }

    /// <summary>
    /// ↯ Null at 60, which is the schema's way of saying XP accrual stops there with nothing banked
    /// (GDD 1 §4). A 0 or a missing key would both read as "needs 0 XP to level", which is the
    /// opposite of the intent — the client renders MAX off this being null.
    /// </summary>
    [Fact]
    public async Task Xp_to_next_is_null_at_the_level_cap()
    {
        var (playerId, token) = await api.RegisterAsync();

        await SetLevelAsync(playerId, 60);

        var profile = await GetProfileAsync(token);
        var xpToNext = profile.GetProperty("player").GetProperty("xp_to_next");

        Assert.Equal(JsonValueKind.Null, xpToNext.ValueKind);
    }

    // The curve's own values are not re-asserted here. `ContentSeedTests` already checks all 21 of
    // fixtures §4's anchors against the seed and fails the build on a mismatch — repeating them
    // would test the same fact later and more weakly. What is worth pinning at this level is only
    // that the endpoint *reads the curve* rather than recomputing it, which the anchors above do.

    /// <summary>
    /// tech-02 §2: "integers or decimal strings, never floats". The volumes are the only
    /// non-integers on M1's wire.
    /// </summary>
    [Fact]
    public async Task Volumes_are_decimal_strings_not_json_numbers()
    {
        var (_, token) = await api.RegisterAsync();

        var settings = (await GetProfileAsync(token)).GetProperty("settings");

        foreach (var field in new[] { "music_volume", "sfx_volume" })
        {
            var value = settings.GetProperty(field);

            Assert.Equal(JsonValueKind.String, value.ValueKind);
            Assert.Equal("1.00", value.GetString());
        }
    }

    /// <summary>
    /// Null means <em>not yet collected</em> rather than "unknown age" (T3 §1.4): without it HR
    /// tier thresholds cannot be derived, so tier minutes are not charged at all. A default age
    /// here would silently start awarding tier XP against thresholds nobody chose.
    /// </summary>
    [Fact]
    public async Task Birth_year_starts_null_rather_than_defaulted()
    {
        var (_, token) = await api.RegisterAsync();

        var settings = (await GetProfileAsync(token)).GetProperty("settings");

        Assert.Equal(JsonValueKind.Null, settings.GetProperty("birth_year").ValueKind);
    }

    [Fact]
    public async Task A_new_profile_reports_an_empty_streak()
    {
        var (_, token) = await api.RegisterAsync();

        var streak = (await GetProfileAsync(token)).GetProperty("streak");

        Assert.Equal(0, streak.GetProperty("current").GetInt32());
        Assert.Equal(0, streak.GetProperty("longest").GetInt32());
        Assert.Equal(JsonValueKind.Null, streak.GetProperty("last_credited_date").ValueKind);
    }

    /// <summary>
    /// A live token whose player is gone is a credential problem, not a missing resource — 401
    /// rather than 404, because the client's correct response is to re-register rather than to
    /// retry. Reached here by deleting the player, which cascades the token away with it.
    /// </summary>
    [Fact]
    public async Task A_token_whose_player_was_deleted_is_unauthorized()
    {
        var (playerId, token) = await api.RegisterAsync();

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            await db.Players.Where(p => p.Id == playerId).ExecuteDeleteAsync();
        }

        var response = await api.CreateAuthenticatedClient(token).GetAsync("/api/v1/players/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task SetLevelAsync(Guid playerId, int level)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        await db.Players.Where(p => p.Id == playerId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Level, level));
    }
}
