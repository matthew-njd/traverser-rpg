using Microsoft.EntityFrameworkCore;
using Traverser.Api.Auth;
using Traverser.Api.Contracts;
using Traverser.Api.Data;
using Traverser.Api.Http;
using Traverser.Api.Progression;

namespace Traverser.Api.Endpoints;

/// <summary>
/// <c>GET /api/v1/players/me/map</c> — GDD 9's Road (tech-02 §3).
/// <para>
/// ↯ **A read with no state of its own.** Every node state below is derived on the spot from
/// <c>lifetime_steps</c>, the seeded <c>zone_gate</c> rows and <c>player_bestiary</c> (tech-01 §4).
/// Nothing is written, nothing is cached, and there is no map row anywhere — which is what makes a
/// threshold rebalance a seed change rather than a migration over every player's stored map.
/// </para>
/// <para>
/// Deliberately not sharing code with <c>SyncEndpoints</c>'s step 7. They answer different
/// questions: step 7 asks "did this sync open a zone", which needs the write; this asks "what does
/// the Road look like now", which must never write. The one line they have in common is
/// <c>lifetime_steps / 1000</c>.
/// </para>
/// </summary>
public static class MapEndpoints
{
    public static void MapRoadReads(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/players/me/map", GetMapAsync)
            .WithName("GetMap")
            .WithSummary("Derived Road state: the Waymarker, zone segments, and per-gate node state.");
    }

    private static async Task<IResult> GetMapAsync(
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        var player = await db.Players
            .AsNoTracking()
            .Where(p => p.Id == current.PlayerId)
            .Select(p => new { p.LifetimeSteps })
            .FirstOrDefaultAsync(ct);

        if (player is null)
        {
            return ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.");
        }

        var leagues = player.LifetimeSteps / EncounterCheckpoints.StepsPerLeague;

        var gates = await db.ZoneGates
            .AsNoTracking()
            .OrderBy(g => g.LeagueThreshold)
            .ToListAsync(ct);

        var zones = await db.Zones.AsNoTracking().OrderBy(z => z.Ordinal).ToListAsync(ct);

        var unlockedZoneIds = (await db.PlayerZoneProgress
            .AsNoTracking()
            .Where(z => z.PlayerId == current.PlayerId)
            .Select(z => z.ZoneId)
            .ToListAsync(ct)).ToHashSet();

        // Only the gate bosses matter here, and only whether the count is above zero — GDD 9 §3's
        // condition is "defeated", and bosses are repeat-fightable (§5), so the tally is not it.
        var gateEnemyIds = gates.Select(g => g.EnemyId).ToList();

        var defeated = (await db.PlayerBestiary
            .AsNoTracking()
            .Where(b => b.PlayerId == current.PlayerId && b.DefeatCount > 0 && gateEnemyIds.Contains(b.EnemyId))
            .Select(b => b.EnemyId)
            .ToListAsync(ct)).ToHashSet();

        // A zone's entry threshold is the League threshold of the gate that unlocks it. `olympion`
        // is unlocked by no gate and starts at 0.
        var entryThreshold = gates
            .Where(g => g.UnlocksZoneId is not null)
            .ToDictionary(g => g.UnlocksZoneId!, g => (long)g.LeagueThreshold);

        return Results.Ok(new MapResponse(
            Leagues: leagues,

            Zones: [.. zones.Select(z => new MapZoneResponse(
                ZoneId: z.Id,
                DisplayName: z.DisplayName,
                Ordinal: z.Ordinal,
                EntryThresholdLeagues: entryThreshold.GetValueOrDefault(z.Id, 0L),
                Unlocked: unlockedZoneIds.Contains(z.Id),
                IsReleased: z.IsReleased))],

            Gates: [.. gates.Select(g => new MapGateResponse(
                GateId: g.Id,
                ZoneId: g.ZoneId,
                EnemyId: g.EnemyId,
                GateKind: g.GateKind,
                LeagueThreshold: g.LeagueThreshold,
                IsHardGate: g.IsHardGate,
                UnlocksZoneId: g.UnlocksZoneId,
                State: StateOf(g.EnemyId, g.LeagueThreshold, leagues, defeated)))]));
    }

    /// <summary>
    /// GDD 9 §4.2's ladder. Defeated outranks the threshold: a boss beaten at its gate stays
    /// defeated, and there is no path back down.
    /// <para>
    /// ↯ <c>&gt;=</c>, not <c>&gt;</c>. A player standing exactly on a threshold has reached the
    /// gate — off-by-one here locks a player out of a fight they walked the full distance for, and
    /// it stays locked until they walk another thousand steps, so nothing about it looks like a bug.
    /// </para>
    /// </summary>
    private static MapGateState StateOf(
        string enemyId,
        int threshold,
        long leagues,
        HashSet<string> defeated) =>
        defeated.Contains(enemyId) ? MapGateState.Defeated
            : leagues >= threshold ? MapGateState.Available
            : MapGateState.Locked;
}
