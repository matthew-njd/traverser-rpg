using System.Security.Claims;

namespace Traverser.Api.Auth;

/// <summary>
/// The player <see cref="GuestTokenAuthenticationHandler"/> resolved for this request. Taking it as
/// a handler parameter is what makes "which player is this?" impossible to get wrong — there is no
/// ambient lookup and no route parameter to mistype, which matters because every secured endpoint
/// on this surface is scoped to exactly one player and none of them name it in the path.
/// </summary>
public sealed record CurrentPlayer(Guid PlayerId)
{
    /// <summary>
    /// Minimal-API parameter binding, reading the claim the authentication middleware already
    /// established. Binding runs after middleware and before the handler, so the principal is
    /// always populated by this point on a secured route.
    /// </summary>
    public static ValueTask<CurrentPlayer?> BindAsync(HttpContext context)
    {
        var claim = context.User.FindFirst(GuestTokenAuthenticationHandler.PlayerIdClaimType);

        if (claim is not null && Guid.TryParse(claim.Value, out var playerId))
        {
            return ValueTask.FromResult<CurrentPlayer?>(new CurrentPlayer(playerId));
        }

        // ↯ Throwing, not returning null. Reaching here means an endpoint asked for the current
        // player without RequireAuthorization() in front of it — a wiring mistake that would
        // otherwise surface as a NullReferenceException deep inside a handler, or worse, as a
        // handler that quietly treats "no player" as a valid state and reads somebody's profile
        // with an empty GUID. Fail at the seam instead.
        throw new InvalidOperationException(
            $"{nameof(CurrentPlayer)} was requested by an endpoint that is not authenticated. " +
            "Map it on the secured route group.");
    }
}
