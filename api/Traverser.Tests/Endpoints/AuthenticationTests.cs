using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// The bearer-token scheme (tech-02 §1.4). These matter more than they look: tech-06 §8 puts this
/// API on a tailnet, so the token is the only thing standing between the fitness history and
/// anything else on it.
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class AuthenticationTests(TraverserApiFixture api)
{
    /// <summary>
    /// Every secured route, checked as a set rather than one at a time. A new endpoint mapped onto
    /// the open group by mistake is the failure this is guarding against, and it is invisible in a
    /// per-endpoint test that nobody remembered to add.
    /// </summary>
    public static TheoryData<string> SecuredRoutes() => new() { "/api/v1/players/me", "/api/v1/content/version" };

    [Theory]
    [MemberData(nameof(SecuredRoutes))]
    public async Task Secured_routes_reject_a_request_with_no_token(string route)
    {
        var response = await api.CreateClient().GetAsync(route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("missing_bearer_token", problem.GetProperty("code").GetString());
    }

    [Theory]
    [MemberData(nameof(SecuredRoutes))]
    public async Task Secured_routes_accept_a_valid_token(string route)
    {
        var (_, token) = await api.RegisterAsync();

        var response = await api.CreateAuthenticatedClient(token).GetAsync(route);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// DECISIONS 2026-08-01 left this open deliberately — it shipped unauthenticated at M0 because
    /// the token had nowhere to be stored yet, and called the choice "defensible, and that should
    /// be a decision rather than an oversight". P3 is where it becomes a decision.
    /// </summary>
    [Fact]
    public async Task Content_version_is_no_longer_anonymous()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/content/version");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_token_is_rejected_as_invalid_rather_than_missing()
    {
        var response = await api.CreateAuthenticatedClient("not-a-real-token").GetAsync("/api/v1/players/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("invalid_bearer_token", problem.GetProperty("code").GetString());
    }

    /// <summary>
    /// <c>revoked_at</c> is set instead of deleting the row so that "this device was
    /// de-authorised" stays distinguishable from "this token never existed" when something 401s
    /// unexpectedly (tech-01's <c>auth_token</c>). That distinction lives in the table; the response
    /// deliberately reports both the same way.
    /// </summary>
    [Fact]
    public async Task A_revoked_token_is_rejected()
    {
        var (playerId, token) = await api.RegisterAsync();

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            await db.AuthTokens
                .Where(t => t.PlayerId == playerId)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
        }

        var response = await api.CreateAuthenticatedClient(token).GetAsync("/api/v1/players/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("invalid_bearer_token", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_non_bearer_scheme_is_not_accepted()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateClient();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", token);

        var response = await client.GetAsync("/api/v1/players/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>The scheme is matched case-insensitively, per RFC 9110.</summary>
    [Fact]
    public async Task The_bearer_scheme_is_case_insensitive()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $"bEaReR {token}");

        var response = await client.GetAsync("/api/v1/players/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task An_empty_bearer_value_is_treated_as_a_missing_token()
    {
        var client = api.CreateClient();

        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer ");

        var response = await client.GetAsync("/api/v1/players/me");

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("missing_bearer_token", problem.GetProperty("code").GetString());
    }

    /// <summary>Registration is the one route that cannot require a token — it mints them.</summary>
    [Fact]
    public async Task Registration_stays_anonymous()
    {
        var response = await api.CreateClient().PostAsJsonAsync(
            "/api/v1/players",
            new { player_id = Guid.NewGuid(), traverser_name = "Matthew", timezone = "UTC" },
            TraverserApiFixture.Json);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    /// <summary>
    /// ↯ The token is never stored, only its SHA-256 — losing it means re-registering or restoring
    /// from the tech-06 §13.1 export. If a plaintext token ever appears in this table, that recovery
    /// story and the off-machine dumps that carry it (§10.5) both change meaning.
    /// </summary>
    [Fact]
    public async Task Only_the_hash_of_the_token_is_stored()
    {
        var (playerId, token) = await api.RegisterAsync();

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        var stored = await db.AuthTokens.Where(t => t.PlayerId == playerId).ToListAsync();

        var row = Assert.Single(stored);

        Assert.Equal(32, row.TokenHash.Length);
        Assert.Equal(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)), row.TokenHash);
    }

    /// <summary>Diagnostics only — but a column nothing ever writes is worse than no column.</summary>
    [Fact]
    public async Task Authenticating_stamps_last_used_at()
    {
        var (playerId, token) = await api.RegisterAsync();

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            Assert.Null(await db.AuthTokens.Where(t => t.PlayerId == playerId)
                .Select(t => t.LastUsedAt).SingleAsync());
        }

        await api.CreateAuthenticatedClient(token).GetAsync("/api/v1/players/me");

        await using (var scope = api.NewScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

            Assert.NotNull(await db.AuthTokens.Where(t => t.PlayerId == playerId)
                .Select(t => t.LastUsedAt).SingleAsync());
        }
    }

    /// <summary>
    /// One player's token must never read another's profile. Trivially true today because the
    /// claim comes from the token row itself — which is exactly why it is worth pinning before
    /// P4 adds endpoints that take identifiers from the caller.
    /// </summary>
    [Fact]
    public async Task A_token_only_ever_resolves_its_own_player()
    {
        var (firstId, firstToken) = await api.RegisterAsync("First");
        var (secondId, secondToken) = await api.RegisterAsync("Second");

        var first = await api.CreateAuthenticatedClient(firstToken)
            .GetFromJsonAsync<JsonElement>("/api/v1/players/me", TraverserApiFixture.Json);
        var second = await api.CreateAuthenticatedClient(secondToken)
            .GetFromJsonAsync<JsonElement>("/api/v1/players/me", TraverserApiFixture.Json);

        Assert.Equal(firstId, first.GetProperty("player").GetProperty("player_id").GetGuid());
        Assert.Equal(secondId, second.GetProperty("player").GetProperty("player_id").GetGuid());
    }
}
