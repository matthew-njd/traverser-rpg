using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using Traverser.Api.Contracts;
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

        // tech-02 §3 — the whole seeded set in one response, fetched only when the version moved.
        routes.MapGet("/content/bundle", async (
                HttpContext http,
                TraverserDbContext db,
                CancellationToken ct) =>
            {
                var version = await db.ContentVersions.AsNoTracking().SingleAsync(ct);
                var etag = new EntityTagHeaderValue($"\"{version.Version}\"");

                // ↯ The ETag is the content version, not a hash of the body. Two servers on the same
                // seed must produce the same tag, and a hash would also change when a serializer
                // reorders a field — turning a client's cached bundle stale for a payload that did
                // not change. `content_version` is already the thing the client negotiates on.
                http.Response.Headers.ETag = etag.ToString();

                if (http.Request.Headers.IfNoneMatch.Count > 0 &&
                    EntityTagHeaderValue.TryParseList(http.Request.Headers.IfNoneMatch, out var tags) &&
                    tags.Any(tag => tag.Compare(etag, useStrongComparison: false)))
                {
                    return Results.StatusCode(StatusCodes.Status304NotModified);
                }

                return Results.Ok(await BuildBundleAsync(db, version.Version, version.GeneratedAt, ct));
            })
            .WithName("GetContentBundle")
            .WithSummary("The whole seeded content set; ETagged with content_version.");
    }

    /// <summary>
    /// Every content table, read straight through with no joins — the client stores the rows as it
    /// receives them and resolves the references itself (T4 §5.1).
    /// </summary>
    private static async Task<ContentBundleResponse> BuildBundleAsync(
        TraverserDbContext db,
        int version,
        DateTime generatedAt,
        CancellationToken ct) =>
        new(
            ContentVersion: version,
            GeneratedAt: generatedAt,

            // Ordered by key throughout. Nothing reads the order — this is so a bundle diffs
            // cleanly between versions and the client's embedded copy (T4 §5.1) is byte-stable.
            GameTypes: await db.GameTypes.AsNoTracking()
                .OrderBy(t => t.CycleOrdinal)
                .Select(t => new GameTypeResponse(t.Id, t.DisplayName, t.CycleOrdinal))
                .ToListAsync(ct),

            // ↯ Materialised before the projection, unlike the integer-only tables above and below.
            // `Decimal` is a local method and EF cannot translate it, so composing it inside the
            // query throws at runtime rather than at compile time. The rows are a few dozen either
            // way — the split is about where the formatting happens, not about cost.
            TypeEffectiveness: (await db.TypeEffectiveness.AsNoTracking()
                    .OrderBy(t => t.AttackerTypeId).ThenBy(t => t.DefenderTypeId)
                    .ToListAsync(ct))
                .Select(t => new TypeEffectivenessResponse(
                    t.AttackerTypeId, t.DefenderTypeId, Decimal(t.Multiplier, 2)))
                .ToList(),

            Zones: await db.Zones.AsNoTracking()
                .OrderBy(z => z.Ordinal)
                .Select(z => new ZoneResponse(z.Id, z.DisplayName, z.Ordinal, z.IsReleased))
                .ToListAsync(ct),

            ZoneGates: await db.ZoneGates.AsNoTracking()
                .OrderBy(g => g.Id)
                .Select(g => new ZoneGateResponse(
                    g.Id, g.ZoneId, g.EnemyId, g.GateKind, g.LeagueThreshold, g.UnlocksZoneId, g.IsHardGate))
                .ToListAsync(ct),

            Enemies: await db.Enemies.AsNoTracking()
                .OrderBy(e => e.Id)
                .Select(e => new EnemyResponse(e.Id, e.DisplayName, e.ZoneId, e.TypeId, e.Role))
                .ToListAsync(ct),

            EnemyStatScaling: (await db.EnemyStatScaling.AsNoTracking()
                    .OrderBy(s => s.EnemyId).ThenBy(s => s.Stat)
                    .ToListAsync(ct))
                .Select(s => new EnemyStatScalingResponse(
                    s.EnemyId, s.Stat, Decimal(s.Base, 2), Decimal(s.Rate, 3)))
                .ToList(),

            EnemyMoves: await db.EnemyMoves.AsNoTracking()
                .OrderBy(m => m.EnemyId).ThenBy(m => m.Ordinal)
                .Select(m => new EnemyMoveResponse(
                    m.Id, m.EnemyId, m.DisplayName, m.Category, m.TypeId, m.Power, m.AiWeight, m.Ordinal))
                .ToListAsync(ct),

            EnemyDropPool: await db.EnemyDropPools.AsNoTracking()
                .OrderBy(d => d.EnemyId).ThenBy(d => d.EncounterKind).ThenBy(d => d.Ordinal)
                .Select(d => new EnemyDropPoolResponse(d.EnemyId, d.EncounterKind, d.ItemDefId, d.Weight, d.Ordinal))
                .ToListAsync(ct),

            PlayerSkillDefs: await db.PlayerSkillDefs.AsNoTracking()
                .OrderBy(s => s.UnlockLevel).ThenBy(s => s.Id)
                .Select(s => new PlayerSkillDefResponse(
                    s.Id, s.DisplayName, s.Category, s.TypeId, s.Power, s.Uses, s.UnlockLevel))
                .ToListAsync(ct),

            GearMoves: await db.GearMoves.AsNoTracking()
                .OrderBy(m => m.Id)
                .Select(m => new GearMoveResponse(m.Id, m.DisplayName, m.TypeId, m.Power, m.Uses, m.Effect))
                .ToListAsync(ct),

            GearDefs: await db.GearDefs.AsNoTracking()
                .OrderBy(g => g.Id)
                .Select(g => new GearDefResponse(
                    g.Id, g.DisplayName, g.Slot, g.Tier, g.ZoneId, g.GrantsMoveId, g.Flavor))
                .ToListAsync(ct),

            GearTierBonuses: (await db.GearTierBonuses.AsNoTracking()
                    .OrderBy(b => b.Tier)
                    .ToListAsync(ct))
                .Select(b => new GearTierBonusResponse(
                    b.Tier, Decimal(b.Rate, 3), b.Flat, Decimal(b.TrinketSplit, 2)))
                .ToList(),

            ItemDefs: await db.ItemDefs.AsNoTracking()
                .OrderBy(i => i.Id)
                .Select(i => new ItemDefResponse(
                    i.Id, i.DisplayName, i.Category, i.Rarity, i.TypeId, i.HealPct, i.Effect,
                    i.MaxStack, i.BattleOnly, i.Flavor))
                .ToListAsync(ct),

            DropRates: (await db.DropRates.AsNoTracking()
                    .OrderBy(r => r.EncounterKind).ThenBy(r => r.RewardKind)
                    .ToListAsync(ct))
                .Select(r => new DropRateResponse(
                    r.EncounterKind, r.RewardKind, Decimal(r.Chance, 3), r.QtyMin, r.QtyMax, r.Tier))
                .ToList(),

            LevelMilestones: await db.LevelMilestones.AsNoTracking()
                .OrderBy(m => m.Level).ThenBy(m => m.RewardKind)
                .Select(m => new LevelMilestoneResponse(m.Level, m.RewardKind, m.ItemDefId, m.GearTier))
                .ToListAsync(ct),

            StreakMilestones: await db.StreakMilestones.AsNoTracking()
                .OrderBy(m => m.Day)
                .Select(m => new StreakMilestoneResponse(m.Day, m.Slot, m.Tier))
                .ToListAsync(ct),

            XpCurve: await db.XpCurve.AsNoTracking()
                .OrderBy(c => c.Level)
                .Select(c => new XpCurveResponse(c.Level, c.XpToNext, c.Cumulative))
                .ToListAsync(ct));

    /// <summary>
    /// A decimal at its column's own scale, invariant culture. Fixed scale rather than
    /// <c>ToString()</c>: the value's stored scale is what makes the payload byte-stable, and a
    /// comma separator would be a wire break.
    /// </summary>
    private static string Decimal(decimal value, int scale) =>
        value.ToString($"F{scale}", CultureInfo.InvariantCulture);
}

/// <summary>
/// tech-02 §3 calls this "a single integer", but it ships as a one-member object: everything on
/// tech-02's wire is a snake_case JSON body, and a bare scalar has nowhere to grow if the bundle
/// poll ever needs to carry a second field.
/// </summary>
public sealed record ContentVersionResponse(int ContentVersion);
