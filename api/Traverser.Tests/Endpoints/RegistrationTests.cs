using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary><c>POST /api/v1/players</c> — tech-02 §3, Identity.</summary>
[Collection(TraverserApiCollection.Name)]
public class RegistrationTests(TraverserApiFixture api)
{
    private static StringContent RawJson(string json) => new(json, Encoding.UTF8, "application/json");

    private static async Task<HttpResponseMessage> RegisterAsync(
        HttpClient client, Guid playerId, string name = "Matthew", string timezone = "America/New_York") =>
        await client.PostAsJsonAsync(
            "/api/v1/players",
            new { player_id = playerId, traverser_name = name, timezone },
            TraverserApiFixture.Json);

    [Fact]
    public async Task Registering_creates_the_profile_and_returns_a_token()
    {
        var playerId = Guid.NewGuid();

        var response = await RegisterAsync(api.CreateClient(), playerId, "Odysseus");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
        var player = body.GetProperty("profile").GetProperty("player");

        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("token").GetString()));
        Assert.Equal(playerId, player.GetProperty("player_id").GetGuid());
        Assert.Equal("Odysseus", player.GetProperty("traverser_name").GetString());
        Assert.Equal(1, player.GetProperty("level").GetInt32());
        Assert.Equal(0, player.GetProperty("xp_current").GetInt32());
        Assert.Equal(0, player.GetProperty("unspent_stat_points").GetInt32());
    }

    /// <summary>
    /// tech-02 §3 names this explicitly: only zone entry is recorded, and <c>olympion</c> is
    /// inserted at profile creation. Gate state is derived on every read, so this row is the whole
    /// of what registration owes the map.
    /// </summary>
    [Fact]
    public async Task Registering_unlocks_olympion()
    {
        var (playerId, _) = await api.RegisterAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var zones = await db.PlayerZoneProgress
            .Where(z => z.PlayerId == playerId)
            .Select(z => z.ZoneId)
            .ToListAsync();

        Assert.Equal(["olympion"], zones);
    }

    /// <summary>
    /// The 1:1 rows the profile snapshot requires. Without them <c>GET /players/me</c> throws
    /// rather than inventing defaults, so their absence would be a 500 on the mirror's repair path.
    /// </summary>
    [Fact]
    public async Task Registering_creates_the_settings_and_streak_rows()
    {
        var (playerId, _) = await api.RegisterAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.True(await db.PlayerSettings.AnyAsync(s => s.PlayerId == playerId));
        Assert.True(await db.StreakStates.AnyAsync(s => s.PlayerId == playerId));
    }

    /// <summary>
    /// GDD 2 §6's "base Vigor pool of 20". <c>vigor_current</c> has no store default, so an
    /// unset value would insert 0 — a Traverser created already defeated.
    /// </summary>
    [Fact]
    public async Task Registering_starts_vigor_at_the_level_1_base()
    {
        var (playerId, _) = await api.RegisterAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var player = await db.Players.SingleAsync(p => p.Id == playerId);

        Assert.Equal(20, player.VigorCurrent);
        Assert.NotEqual(default, player.VigorAnchorAt);
        Assert.NotEqual(default, player.CreatedAt);
    }

    /// <summary>
    /// ↯ The whole reason registration is idempotent (tech-02 §3): a response lost on a flaky
    /// tailnet link must not strand a device whose profile already exists server-side. 409 here
    /// would leave that device permanently unable to register or to reach the profile it created.
    /// </summary>
    [Fact]
    public async Task Re_registering_the_same_player_id_returns_the_existing_profile()
    {
        var playerId = Guid.NewGuid();
        var client = api.CreateClient();

        var first = await RegisterAsync(client, playerId, "Odysseus");
        var second = await RegisterAsync(client, playerId, "Somebody Else", "Europe/London");

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var body = await second.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);
        var player = body.GetProperty("profile").GetProperty("player");

        // Idempotent means the second call *reads*, never writes. A registration that quietly
        // renamed the profile would make the retry path a data-loss path.
        Assert.Equal("Odysseus", player.GetProperty("traverser_name").GetString());
        Assert.Equal("America/New_York", player.GetProperty("timezone").GetString());

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(1, await db.Players.CountAsync(p => p.Id == playerId));
    }

    /// <summary>
    /// tech-01's <c>auth_token</c> allows several live rows per player for exactly this reason:
    /// only the SHA-256 is stored, so the original token is unrecoverable and a re-registration has
    /// nothing to return but a fresh one. Both must keep working — the caller does not know which
    /// of its attempts the server actually received.
    /// </summary>
    [Fact]
    public async Task Re_registering_mints_a_second_token_and_leaves_the_first_working()
    {
        var playerId = Guid.NewGuid();
        var client = api.CreateClient();

        var first = await RegisterAsync(client, playerId);
        var second = await RegisterAsync(client, playerId);

        var firstToken = (await first.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json))
            .GetProperty("token").GetString()!;
        var secondToken = (await second.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json))
            .GetProperty("token").GetString()!;

        Assert.NotEqual(firstToken, secondToken);

        foreach (var token in new[] { firstToken, secondToken })
        {
            var response = await api.CreateAuthenticatedClient(token).GetAsync("/api/v1/players/me");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    /// <summary>
    /// The retry that idempotency exists for, arriving twice at once. One insert wins the primary
    /// key and the loser must resolve to the same profile rather than surfacing a 500 — which is
    /// what an unhandled <c>23505</c> would be.
    /// </summary>
    [Fact]
    public async Task Concurrent_registrations_of_one_player_id_all_succeed()
    {
        var playerId = Guid.NewGuid();

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 4).Select(_ => RegisterAsync(api.CreateClient(), playerId)));

        Assert.All(responses, r => Assert.True(
            r.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK,
            $"expected 200 or 201, got {(int)r.StatusCode}"));

        // Exactly one of them created the row; the rest found it.
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(1, await db.Players.CountAsync(p => p.Id == playerId));
    }

    [Theory]
    // GDD 10 §5.1's 20-character limit, enforced server-side because the column is `text`.
    [InlineData("123456789012345678901", "America/New_York")]
    [InlineData("", "America/New_York")]
    [InlineData("   ", "America/New_York")]
    // A bad zone would put the local-midnight boundary in the wrong place for every activity_day
    // that follows, silently and only for this player.
    [InlineData("Matthew", "Mars/Olympus")]
    [InlineData("Matthew", "")]
    public async Task Invalid_registrations_are_rejected_with_validation_failed(string name, string timezone)
    {
        var response = await RegisterAsync(api.CreateClient(), Guid.NewGuid(), name, timezone);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("validation_failed", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task An_empty_player_id_is_rejected()
    {
        var response = await RegisterAsync(api.CreateClient(), Guid.Empty);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_name_of_exactly_twenty_characters_is_accepted()
    {
        var response = await RegisterAsync(api.CreateClient(), Guid.NewGuid(), new string('a', 20));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    /// <summary>
    /// A whitespace-padded name is trimmed rather than rejected — the naming screen's text input
    /// will produce them, and a 400 for a trailing space is a bad first experience.
    /// </summary>
    [Fact]
    public async Task Names_are_trimmed()
    {
        var response = await RegisterAsync(api.CreateClient(), Guid.NewGuid(), "  Odysseus  ");

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("Odysseus", body.GetProperty("profile").GetProperty("player")
            .GetProperty("traverser_name").GetString());
    }

    /// <summary>
    /// ↯ Regression guard. Registering the ProblemDetails exception handler takes over the
    /// framework's own translation of <c>BadHttpRequestException</c>, whose default answer is 500 —
    /// so a syntactically broken body reported "the server is broken" until
    /// <c>StatusCodeSelector</c> was added. That is a client bug that sends someone into server logs.
    /// </summary>
    [Fact]
    public async Task A_malformed_body_is_a_400_not_a_500()
    {
        var response = await api.CreateClient().PostAsync("/api/v1/players", RawJson("{not json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
