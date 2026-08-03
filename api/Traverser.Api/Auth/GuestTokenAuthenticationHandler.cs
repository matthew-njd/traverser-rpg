using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Traverser.Api.Data;
using Traverser.Api.Http;

namespace Traverser.Api.Auth;

/// <summary>
/// Authenticates the opaque guest bearer token (tech-02 §1.4).
/// <para>
/// ↯ This exists because tech-06 §8 puts the API on a tailnet rather than on localhost. An
/// unauthenticated write surface reachable from anything on the tailnet is not acceptable even for
/// a single-player app — the token is what makes tech-02 §1.4 load-bearing rather than ceremonial
/// (tech-06 §13's T2 obligation).
/// </para>
/// <para>
/// ↯ An <see cref="IEndpointFilter"/> was the obvious shape for this and is the wrong one:
/// minimal-API <em>parameter binding runs before endpoint filters</em>, so a filter cannot publish
/// anything a bound parameter is able to read — <see cref="CurrentPlayer.BindAsync"/> would run
/// first and find nothing. Authentication middleware runs before routing's endpoint execution
/// entirely, which is the ordering this needs.
/// </para>
/// </summary>
public sealed class GuestTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    TraverserDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "GuestToken";

    /// <summary>The claim carrying <c>player.id</c>. Read only by <see cref="CurrentPlayer"/>.</summary>
    public const string PlayerIdClaimType = "traverser:player_id";

    private const string BearerPrefix = "Bearer ";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!TryReadBearer(out var token))
        {
            // NoResult, not Fail: "this request carried no credential" is not the same as "this
            // credential is wrong", and only the former should stay silent on an open endpoint.
            return AuthenticateResult.NoResult();
        }

        var hash = GuestToken.Hash(token);
        var ct = Context.RequestAborted;

        // The hash is the primary key, so this is a single index seek on every request.
        var authToken = await db.AuthTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (authToken is null || authToken.RevokedAt is not null)
        {
            return AuthenticateResult.Fail("Unknown or revoked token.");
        }

        // Diagnostics only — nothing reads this to make a decision, and it must not become session
        // expiry without a spec change (tech-01's auth_token). Written on every authenticated
        // request rather than throttled: it is one UPDATE against one row on a single-player API,
        // and "when did this device last reach the server" is exactly the question worth being able
        // to answer on the day a sync silently stops happening.
        authToken.LastUsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var identity = new ClaimsIdentity(
            [new Claim(PlayerIdClaimType, authToken.PlayerId.ToString())],
            SchemeName);

        return AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    /// <summary>
    /// The 401 body. Written here rather than left to the framework because tech-02 §2 requires
    /// RFC 9457 <c>ProblemDetails</c> with a <c>code</c> the client switches on, and the default
    /// challenge produces an empty response with a <c>WWW-Authenticate</c> header instead.
    /// </summary>
    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        // Re-reading the header is how missing and invalid are told apart at this point; the
        // authenticate result is not carried into the challenge, and one boolean of state on the
        // request is not worth the coupling.
        var code = TryReadBearer(out _) ? ApiProblem.InvalidBearerToken : ApiProblem.MissingBearerToken;

        var detail = code == ApiProblem.MissingBearerToken
            ? "Supply the guest token as 'Authorization: Bearer <token>'."
            : "The supplied token is not valid for this server.";

        await ApiProblem.Unauthorized(code, detail).ExecuteAsync(Context);
    }

    private bool TryReadBearer(out string token)
    {
        token = string.Empty;

        var header = Request.Headers.Authorization;

        // Exactly one header value. Two Authorization headers is not a case with a right answer.
        if (header.Count != 1)
        {
            return false;
        }

        var value = header[0];

        if (string.IsNullOrEmpty(value) || !value.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        token = value[BearerPrefix.Length..].Trim();

        return token.Length > 0;
    }
}
