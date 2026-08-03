namespace Traverser.Api.Http;

/// <summary>
/// RFC 9457 <c>ProblemDetails</c> with the <c>code</c> extension member the client switches on
/// (tech-02 §2).
/// </summary>
internal static class ApiProblem
{
    // ↯ The client branches on `code`, never on the status code or on `detail`. Status codes are
    // too coarse (two different 400s mean different things to the UI) and `detail` is prose meant
    // for a human reading a log. Every problem response on this surface therefore carries a code,
    // and the codes are snake_case like everything else on the wire (§2).

    /// <summary>No <c>Authorization</c> header, or one that is not a well-formed bearer.</summary>
    public const string MissingBearerToken = "missing_bearer_token";

    /// <summary>
    /// Unknown or revoked token. ↯ Revoked deliberately collapses into the same code as unknown —
    /// <c>auth_token.revoked_at</c> exists so the operator can tell the two apart <em>in the
    /// table</em>, which is where that distinction is useful; spelling it out in the response would
    /// only confirm to a caller that a given token once existed.
    /// </summary>
    public const string InvalidBearerToken = "invalid_bearer_token";

    /// <summary>Body failed a server-side sanity check. <c>detail</c> names the field.</summary>
    public const string ValidationFailed = "validation_failed";

    /// <summary>
    /// An allocation asked for more points than the player has unspent. Its own code rather than
    /// <see cref="ValidationFailed"/> because the request is well-formed and the client can act on
    /// it specifically — refetch the profile, the level-up it assumed did not happen.
    /// </summary>
    public const string InsufficientStatPoints = "insufficient_stat_points";

    public static IResult Unauthorized(string code, string detail) =>
        Create(StatusCodes.Status401Unauthorized, code, "Unauthorized", detail);

    public static IResult BadRequest(string code, string detail) =>
        Create(StatusCodes.Status400BadRequest, code, "Bad Request", detail);

    public static IResult Create(int statusCode, string code, string title, string detail) =>
        Results.Problem(
            statusCode: statusCode,
            title: title,
            detail: detail,
            extensions: new Dictionary<string, object?> { ["code"] = code });
}
