using System.Data;
using Microsoft.EntityFrameworkCore;
using Traverser.Api.Auth;
using Traverser.Api.Contracts;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;
using Traverser.Api.Http;
using Traverser.Api.Progression;

namespace Traverser.Api.Endpoints;

/// <summary>
/// <c>POST /api/v1/sync</c> — T2 §4. The only endpoint that advances progression.
/// <para>
/// M1 implements steps <b>1, 3, 4, 5, 6</b>. Step 2 (battles, drops, bestiary) and step 8 (encounter
/// checkpoints) arrive with the battle engine at M2; step 7 (gates) needs the Map at M3; steps 9–11
/// (streak, deterministic rewards, overactivity) are GDD 11's and land at M4. The order of what is
/// here is normative and steps 3–6 in particular cannot be reordered without changing outcomes.
/// </para>
/// </summary>
public static class SyncEndpoints
{
    public static void MapSync(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/sync", SyncAsync)
            .WithName("Sync")
            .WithSummary("Ingest queued deltas, roll up activity, derive and apply XP.");
    }

    /// <summary>
    /// ↯ One transaction, <c>READ COMMITTED</c>, opening on <c>SELECT … FOR UPDATE</c> against the
    /// player row. The lock is what makes two overlapping syncs from a retrying client serialize
    /// rather than interleave — and it is also what lets the <c>activity_day</c> merge below be a
    /// read-modify-write instead of T2 §4 step 3's literal <c>ON CONFLICT DO UPDATE … + EXCLUDED</c>.
    /// Both express the same normative rule (always add, never assign); the lock is what makes the
    /// readable form safe. Remove the lock and the SQL form becomes mandatory again.
    /// </summary>
    private static async Task<IResult> SyncAsync(
        SyncRequest request,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.Deltas is null)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "deltas is required (send [] for a no-op sync).");
        }

        if (Validate(request.Deltas) is { } invalid)
        {
            return invalid;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var player = await db.Players
            .FromSql($"SELECT * FROM player WHERE id = {current.PlayerId} FOR UPDATE")
            .FirstOrDefaultAsync(ct);

        if (player is null)
        {
            return ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.");
        }

        // Two deltas with one client_delta_id inside a single payload is a client bug, but it must
        // not become a database error. First occurrence wins and the rest are reported as duplicates,
        // which is the same answer the client would get by sending them in two batches.
        var seen = new HashSet<Guid>();
        var deltas = request.Deltas.Where(d => seen.Add(d.ClientDeltaId)).ToList();
        var intraBatchDuplicates = request.Deltas.Count - deltas.Count;

        // ---- Step 1. Ingest deltas -------------------------------------------------------------
        var accepted = await InsertDeltasAsync(db, player.Id, deltas, ct);

        // ↯ Everything below is computed from `accepted` and never from `request`. That single fact
        // is the whole double-count defence: a replayed batch inserts nothing, so the rest of the
        // transaction has an empty working set and the response's player block comes back
        // byte-identical. T2 §8 says that if a future change breaks the design, it breaks here.
        var newDeltas = deltas.Where(d => accepted.Contains(d.ClientDeltaId)).ToList();

        var duplicateIds = deltas.Where(d => !accepted.Contains(d.ClientDeltaId))
            .Select(d => d.ClientDeltaId)
            .ToList();

        var levelUps = new List<LevelUpResponse>();
        var touchedDates = newDeltas.Select(d => d.ActivityDate).Distinct().Order().ToList();

        if (newDeltas.Count > 0)
        {
            // ---- Steps 3 & 4. Roll up, and derive XP against the post-merge cumulative ----------
            var xpByDelta = await MergeAndDeriveXpAsync(db, player, newDeltas, touchedDates, ct);

            // The per-delta XP is written back onto the ledger rows themselves so a day's total can
            // always be traced to the contributions that produced it (tech-01's sync_delta).
            var storedDeltas = await db.SyncDeltas
                .Where(d => d.PlayerId == player.Id && accepted.Contains(d.ClientDeltaId))
                .ToListAsync(ct);

            foreach (var stored in storedDeltas)
            {
                stored.XpDelta = xpByDelta[stored.ClientDeltaId];
            }

            // ---- Step 5. Apply XP and walk the curve --------------------------------------------
            var xpGained = xpByDelta.Values.Sum();
            var curve = await db.XpCurve.AsNoTracking().ToDictionaryAsync(x => x.Level, x => x.XpToNext, ct);
            var walk = LevelCurve.Apply(player.Level, player.XpCurrent, xpGained, curve);

            player.Level = walk.Level;
            player.XpCurrent = walk.XpCurrent;

            // Accrues even at the cap, where xp_current does not — it is a display of total effort
            // rather than progress toward a level that will never arrive (T2 §4 step 5).
            player.XpLifetime += xpGained;
            player.UnspentStatPoints += walk.LevelUps.Sum(l => l.StatPointsAwarded);

            levelUps.AddRange(walk.LevelUps.Select(l => new LevelUpResponse(l.Level, l.StatPointsAwarded)));

            // ---- Step 6. Leagues -----------------------------------------------------------------
            // Monotonic by construction: this is the only writer and there is no path that subtracts.
            // Leagues themselves are lifetime_steps / 1000, derived on read and never stored.
            player.LifetimeSteps += newDeltas.Sum(d => (long)d.StepsDelta);

            await db.SaveChangesAsync(ct);
        }

        var profile = await PlayerProfile.LoadAsync(db, player.Id, ct)
            ?? throw new InvalidOperationException($"Profile for {player.Id} vanished mid-sync.");

        var activityDays = await db.ActivityDays
            .AsNoTracking()
            .Where(a => a.PlayerId == player.Id && touchedDates.Contains(a.ActivityDate))
            .OrderBy(a => a.ActivityDate)
            .Select(a => new ActivityDayResponse(
                a.ActivityDate, a.Steps, a.Tier1Minutes, a.Tier2Minutes, a.Tier3Minutes,
                a.XpAwarded, a.StepGoalSnapshot, a.GoalMet, a.StreakCreditMethod))
            .ToListAsync(ct);

        var contentVersion = await db.ContentVersions.AsNoTracking().Select(c => c.Version).SingleAsync(ct);

        await transaction.CommitAsync(ct);

        return Results.Ok(new SyncResponse(
            ServerTime: DateTime.UtcNow,
            ContentVersion: contentVersion,
            Player: profile.Player,
            Leagues: profile.Leagues,
            Streak: profile.Streak,
            LevelUps: levelUps,
            ActivityDays: activityDays,
            AcceptedDeltaIds: [.. newDeltas.Select(d => d.ClientDeltaId)],
            // Intra-batch duplicates are folded in here rather than reported separately: to the
            // client both mean the same thing — stop resending this.
            DuplicateDeltaIds: duplicateIds));
    }

    /// <summary>
    /// T2 §4 step 1, kept as the spec's literal statement because it is load-bearing.
    /// <c>ON CONFLICT DO NOTHING RETURNING</c> against the <c>(player_id, client_delta_id)</c> unique
    /// index is the entire idempotency mechanism, and expressing it any other way — a pre-check for
    /// existing IDs, say — reintroduces the race it exists to close.
    /// <para>
    /// Sent as parallel arrays through <c>unnest</c> so the batch costs one round trip whatever its
    /// size; T2 §5 caps the client queue at 5,000 entries, and a statement per delta would make a
    /// long offline stretch a five-thousand-round-trip sync.
    /// </para>
    /// </summary>
    private static async Task<HashSet<Guid>> InsertDeltasAsync(
        TraverserDbContext db,
        Guid playerId,
        IReadOnlyList<SyncDeltaRequest> deltas,
        CancellationToken ct)
    {
        if (deltas.Count == 0)
        {
            return [];
        }

        var ids = deltas.Select(_ => Guid.CreateVersion7()).ToArray();
        var clientDeltaIds = deltas.Select(d => d.ClientDeltaId).ToArray();
        var activityDates = deltas.Select(d => d.ActivityDate).ToArray();
        var sources = deltas.Select(d => SnakeCase(d.Source)).ToArray();
        var steps = deltas.Select(d => d.StepsDelta).ToArray();
        var minutes = deltas.Select(d => d.MinutesDelta).ToArray();
        var hrTiers = deltas.Select(d => d.HrTier).ToArray();
        var recordedAt = deltas.Select(d => d.RecordedAt.ToUniversalTime()).ToArray();

        var returned = await db.Database
            .SqlQueryRaw<Guid>(
                """
                INSERT INTO sync_delta
                    (id, player_id, client_delta_id, activity_date, source,
                     steps_delta, minutes_delta, hr_tier, xp_delta, recorded_at)
                SELECT u.id, {0}, u.client_delta_id, u.activity_date, u.source,
                       u.steps_delta, u.minutes_delta, u.hr_tier, 0, u.recorded_at
                FROM unnest({1}::uuid[], {2}::uuid[], {3}::date[], {4}::text[],
                            {5}::int[], {6}::int[], {7}::int[], {8}::timestamptz[])
                     AS u(id, client_delta_id, activity_date, source,
                          steps_delta, minutes_delta, hr_tier, recorded_at)
                ON CONFLICT (player_id, client_delta_id) DO NOTHING
                RETURNING client_delta_id AS "Value"
                """,
                playerId, ids, clientDeltaIds, activityDates, sources, steps, minutes, hrTiers, recordedAt)
            .ToListAsync(ct);

        return [.. returned];
    }

    /// <summary>
    /// T2 §4 steps 3 and 4, together because step 4's Tier 3 cap needs step 3's <em>pre-merge</em>
    /// totals and its own running total within the batch.
    /// </summary>
    private static async Task<Dictionary<Guid, int>> MergeAndDeriveXpAsync(
        TraverserDbContext db,
        Player player,
        IReadOnlyList<SyncDeltaRequest> newDeltas,
        IReadOnlyList<DateOnly> touchedDates,
        CancellationToken ct)
    {
        var existing = await db.ActivityDays
            .Where(a => a.PlayerId == player.Id && touchedDates.Contains(a.ActivityDate))
            .ToDictionaryAsync(a => a.ActivityDate, ct);

        var xpByDelta = new Dictionary<Guid, int>();

        foreach (var date in touchedDates)
        {
            if (!existing.TryGetValue(date, out var day))
            {
                day = new ActivityDay
                {
                    PlayerId = player.Id,
                    ActivityDate = date,

                    // ↯ Captured on insert only and never updated afterwards (tech-01 §4). Raising
                    // the goal must not retroactively un-hit a day that was legitimately earned.
                    StepGoalSnapshot = player.DailyStepGoal,
                };

                db.ActivityDays.Add(day);
                existing[date] = day;
            }

            // Ordered so the Tier 3 cap consumes the day's allowance deterministically when one
            // batch carries several Peak deltas for the same date. recorded_at is the device clock;
            // client_delta_id breaks ties, since UUIDv7 sorts by mint time.
            var forDate = newDeltas
                .Where(d => d.ActivityDate == date)
                .OrderBy(d => d.RecordedAt)
                .ThenBy(d => d.ClientDeltaId);

            // The day's Tier 3 total *before* this batch — the running figure the cap is charged
            // against, advanced as each delta in the batch is billed.
            var cumulativeTier3 = day.Tier3Minutes;
            var dayXp = 0;

            foreach (var delta in forDate)
            {
                var xp = XpRates.ForSteps(delta.StepsDelta);

                if (delta.HrTier is int tier && delta.MinutesDelta > 0)
                {
                    xp += XpRates.ForTierMinutes(tier, delta.MinutesDelta, cumulativeTier3);

                    switch (tier)
                    {
                        case 1: day.Tier1Minutes += delta.MinutesDelta; break;
                        case 2: day.Tier2Minutes += delta.MinutesDelta; break;
                        case 3:
                            day.Tier3Minutes += delta.MinutesDelta;

                            // ↯ Advanced by the *raw* minutes, not by the portion billed at the Peak
                            // rate. The stored total is what the player actually did (fixtures §11.6
                            // — a day of 15 then 12 Peak minutes stores 27, not 20); the cap governs
                            // the rate, never the record.
                            cumulativeTier3 += delta.MinutesDelta;
                            break;
                    }
                }

                day.Steps += delta.StepsDelta;
                dayXp += xp;
                xpByDelta[delta.ClientDeltaId] = xp;
            }

            day.XpAwarded += dayXp;

            // Not part of T2 §4 step 3's SQL, but a pure function of two columns in the same row and
            // read by the M1 activity log. The streak *credit method* this feeds is step 9's, at M4.
            day.GoalMet = day.Steps >= day.StepGoalSnapshot;
        }

        return xpByDelta;
    }

    private static IResult? Validate(IReadOnlyList<SyncDeltaRequest> deltas)
    {
        foreach (var delta in deltas)
        {
            if (delta.ClientDeltaId == Guid.Empty)
            {
                return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "client_delta_id must be a non-empty UUID.");
            }

            // Negative steps or minutes would make the merge subtractive, and T2 §6.1 makes additive
            // merge the whole conflict model — there is no legitimate producer of a negative delta,
            // since a downward revision from Health Connect is handled by the client's high-water
            // mark and simply mints nothing (fixtures §11.7).
            if (delta.StepsDelta < 0 || delta.MinutesDelta < 0)
            {
                return ApiProblem.BadRequest(
                    ApiProblem.ValidationFailed,
                    $"steps_delta and minutes_delta must be >= 0 (client_delta_id {delta.ClientDeltaId}).");
            }

            if (delta.HrTier is int tier && tier is < 1 or > 3)
            {
                return ApiProblem.BadRequest(
                    ApiProblem.ValidationFailed,
                    $"hr_tier must be 1, 2, or 3 (client_delta_id {delta.ClientDeltaId}).");
            }

            if (delta.Source == SyncDeltaSource.Hr && delta.HrTier is null)
            {
                return ApiProblem.BadRequest(
                    ApiProblem.ValidationFailed,
                    $"hr_tier is required when source is 'hr' (client_delta_id {delta.ClientDeltaId}).");
            }
        }

        return null;
    }

    /// <summary>
    /// Matches <c>SnakeCaseEnumConverter</c>'s mapping. The raw INSERT bypasses EF's value
    /// converters, so the text has to be produced here or the <c>ck_sync_delta_source</c> CHECK
    /// rejects it.
    /// </summary>
    private static string SnakeCase(SyncDeltaSource source) => source switch
    {
        SyncDeltaSource.Steps => "steps",
        SyncDeltaSource.Hr => "hr",
        SyncDeltaSource.Battle => "battle",
        SyncDeltaSource.Manual => "manual",
        _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Unknown sync_delta source."),
    };
}
