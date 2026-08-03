using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data;

namespace Traverser.Api.Endpoints;

/// <summary>Content negotiation (tech-02 §3, Content).</summary>
public static class ContentEndpoints
{
    public static void MapContentEndpoints(this IEndpointRouteBuilder routes)
    {
        // tech-02 §3 — the client polls this at the start of every sync and fetches
        // /content/bundle only when the number moved.
        //
        // ↯ Now authenticated, closing the decision DECISIONS 2026-08-01 left open. It shipped
        // unauthenticated at M0 for the honest reason that tech-02 §1.4's token had nowhere to be
        // stored yet, and that entry called it "the only endpoint on the surface where staying
        // unauthenticated would be defensible — and that should be a decision rather than an
        // oversight." With registration built, the defence is gone: leaving one endpoint open would
        // mean the auth filter guards a surface with a hole in it, and the client already holds a
        // token by the time it polls. The bundle itself (M2) inherits the same treatment.
        routes.MapGet("/content/version", async (TraverserDbContext db, CancellationToken ct) =>
            {
                var version = await db.ContentVersions
                    .AsNoTracking()
                    .Select(c => c.Version)
                    .SingleAsync(ct);

                return Results.Ok(new ContentVersionResponse(version));
            })
            .WithName("GetContentVersion")
            .WithSummary("Cheap content-version poll; called at the start of every sync.");
    }
}

/// <summary>
/// tech-02 §3 calls this "a single integer", but it ships as a one-member object: everything on
/// tech-02's wire is a snake_case JSON body, and a bare scalar has nowhere to grow if the bundle
/// poll ever needs to carry a second field.
/// </summary>
public sealed record ContentVersionResponse(int ContentVersion);
