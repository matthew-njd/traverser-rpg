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
/// Steps 1–11. The order is normative, and steps 3–6 in particular cannot be reordered without
/// changing outcomes.
/// </para>
/// </summary>
public static class SyncEndpoints
{
    /// <summary>GDD 11 §8.1 — cumulative Tier 1+ minutes in one session.</summary>
    private const int OveractivityMinutes = 90;

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
        IRandomSource rng,
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

        // ---- Step 2. Ingest battles, their drops, and the bestiary ------------------------------
        var newBattles = await IngestBattlesAsync(db, player, request.Battles ?? [], ct);

        // Battle XP joins step 4's derivation. Grouped by the client's own local date, because
        // `activity_day` is keyed by it and the server never derives one from an instant (§2).
        var battleXpByDate = newBattles
            .GroupBy(b => b.ActivityDate)
            .ToDictionary(g => g.Key, g => g.Sum(BattleXp));

        foreach (var date in battleXpByDate.Keys)
        {
            if (!touchedDates.Contains(date))
            {
                touchedDates.Add(date);
            }
        }

        touchedDates.Sort();

        // Hoisted out of the block below because steps 8's grants charge against day rows too, and a
        // sync that only carries an Explore tap never enters it.
        var days = new Dictionary<DateOnly, ActivityDay>();
        var stepsBefore = player.LifetimeSteps;

        if (newDeltas.Count > 0 || newBattles.Count > 0)
        {
            // ---- Steps 3 & 4. Roll up, and derive XP against the post-merge cumulative ----------
            var (xpByDelta, merged) = await MergeAndDeriveXpAsync(db, player, newDeltas, touchedDates, ct);

            days = merged;

            // The per-delta XP is written back onto the ledger rows themselves so a day's total can
            // always be traced to the contributions that produced it (tech-01's sync_delta).
            var storedDeltas = await db.SyncDeltas
                .Where(d => d.PlayerId == player.Id && accepted.Contains(d.ClientDeltaId))
                .ToListAsync(ct);

            foreach (var stored in storedDeltas)
            {
                stored.XpDelta = xpByDelta[stored.ClientDeltaId];
            }

            // Battle XP lands on the day's row alongside step and HR XP, so the activity log stays
            // the one place a day's total can be reconciled against what produced it.
            // Battle XP lands on the day rows step 3 already created or loaded — never re-queried,
            // because a row added there is not yet in the database and a second lookup would miss it
            // and add a duplicate for the same (player_id, activity_date).
            foreach (var (date, awarded) in battleXpByDate)
            {
                days[date].XpAwarded += awarded;
            }

            // ---- Step 5. Apply XP and walk the curve --------------------------------------------
            var xpGained = xpByDelta.Values.Sum() + battleXpByDate.Values.Sum();
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

            // Flushed before step 7 rather than folded into the one save below: step 7 reads
            // `player_bestiary`, and the row step 2 just added for a boss's first defeat is what
            // opens the gate. Left unsaved, the dual gate misses its own trigger by one sync.
            await db.SaveChangesAsync(ct);
        }

        // ---- Step 7. Gate evaluation ------------------------------------------------------------
        var (unlockedZoneIds, zonesOpen) = await EvaluateGatesAsync(db, player, ct);

        // ---- Step 8. Encounter checkpoints ------------------------------------------------------
        var sessions = await UpsertSessionsAsync(db, player, request.Sessions ?? [], ct);
        var grants = await IssueEncountersAsync(
            db, player, request, sessions, stepsBefore, newDeltas, days, zonesOpen, rng, ct);

        // ---- Step 9. Streak evaluation ----------------------------------------------------------
        if (request.LocalDate is { } today)
        {
            // Into the response too, so a day credited from the window reaches the mirror.
            touchedDates.AddRange(new[] { today.AddDays(-2), today.AddDays(-1), today }.Except(touchedDates));

            await EvaluateStreakAsync(db, player, today, touchedDates, ct);
        }

        await db.SaveChangesAsync(ct);

        // ---- Step 10. Deterministic rewards -----------------------------------------------------
        var (rewards, pending) = await SyncRewards.GrantAsync(db, player, touchedDates, rng, ct);

        // ---- Step 11. Overactivity --------------------------------------------------------------
        var warnings = new List<WarningResponse>();

        foreach (var (session, _) in sessions)
        {
            if (session.OveractivityWarnedAt is null
                && session.Tier1Minutes + session.Tier2Minutes + session.Tier3Minutes >= OveractivityMinutes)
            {
                session.OveractivityWarnedAt = DateTime.UtcNow;
                warnings.Add(new WarningResponse("overactivity", session.ExternalSessionId!));
            }
        }

        await db.SaveChangesAsync(ct);

        var profile = await PlayerProfile.LoadAsync(db, player.Id, ct)
            ?? throw new InvalidOperationException($"Profile for {player.Id} vanished mid-sync.");

        var activityDays = await db.ActivityDays
            .AsNoTracking()
            .Where(a => a.PlayerId == player.Id && touchedDates.Contains(a.ActivityDate))
            .OrderBy(a => a.ActivityDate)
            .Select(a => new ActivityDayResponse(
                a.ActivityDate, a.Steps, a.Tier1Minutes, a.Tier2Minutes, a.Tier3Minutes,
                a.XpAwarded, a.StepGoalSnapshot, a.GoalMet, a.StreakCreditMethod, a.RestTaggedAt))
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
            DuplicateDeltaIds: duplicateIds,
            EncounterGrants: grants,
            UnlockedZoneIds: unlockedZoneIds,
            RewardsGranted: rewards,
            PendingRewards: pending,
            Warnings: warnings));
    }

    /// <summary>
    /// T2 §4 step 9. Credits each uncredited day in reach, then recounts the run back from today.
    /// <para>
    /// A break writes nothing — no flag, no notification (GDD 11 §4). It is only a null credit,
    /// and the run stops at it.
    /// </para>
    /// </summary>
    private static async Task EvaluateStreakAsync(
        TraverserDbContext db,
        Player player,
        DateOnly today,
        IReadOnlyList<DateOnly> touchedDates,
        CancellationToken ct)
    {
        var todayRow = await db.ActivityDays.FindAsync([player.Id, today], ct);

        if (todayRow is null)
        {
            todayRow = new ActivityDay
            {
                PlayerId = player.Id,
                ActivityDate = today,
                StepGoalSnapshot = player.DailyStepGoal,
            };

            db.ActivityDays.Add(todayRow);
        }

        todayRow.SyncedSameDay = true;

        // GDD 11 §3.2: 48 hours back, 3 per rolling 30 days.
        var graceFrom = today.AddDays(-2);
        var graceUsed = await db.ActivityDays.CountAsync(a =>
            a.PlayerId == player.Id
            && a.StreakCreditMethod == StreakCreditMethod.AutoSyncGrace
            && a.ActivityDate > today.AddDays(-30), ct);

        foreach (var date in touchedDates.Where(d => d <= today).Order())
        {
            var day = await db.ActivityDays.FindAsync([player.Id, date], ct);

            // An existing credit is never revisited (T2 §6.4).
            if (day is null || day.StreakCreditMethod is not null)
            {
                continue;
            }

            if (day.RestTaggedAt is not null)
            {
                day.StreakCreditMethod = StreakCreditMethod.RestDayTag;
            }
            else if (day.GoalMet && day.SyncedSameDay)
            {
                day.StreakCreditMethod = StreakCreditMethod.GoalHit;
            }
            else if (day.GoalMet && date >= graceFrom && graceUsed < 3)
            {
                day.StreakCreditMethod = StreakCreditMethod.AutoSyncGrace;
                graceUsed++;
            }
        }

        await db.SaveChangesAsync(ct);

        var credited = await db.ActivityDays
            .Where(a => a.PlayerId == player.Id && a.StreakCreditMethod != null && a.ActivityDate <= today)
            .OrderByDescending(a => a.ActivityDate)
            .Select(a => a.ActivityDate)
            .ToListAsync(ct);

        // Today still uncredited is not a break — the day has not passed (GDD 11 §3.3).
        var cursor = credited.FirstOrDefault() == today ? today : today.AddDays(-1);
        var current = 0;

        foreach (var date in credited.SkipWhile(d => d > cursor))
        {
            if (date != cursor)
            {
                break;
            }

            current++;
            cursor = cursor.AddDays(-1);
        }

        var state = await db.StreakStates.SingleAsync(s => s.PlayerId == player.Id, ct);

        state.CurrentStreak = current;
        state.LongestStreak = Math.Max(state.LongestStreak, current);
        state.LastCreditedDate = credited.Count > 0 ? credited[0] : null;
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
    /// T2 §4 step 2 — battles, their client-rolled drops, and the bestiary.
    /// <para>
    /// ↯ <c>ON CONFLICT (player_id, client_battle_id) DO NOTHING RETURNING</c>, and then
    /// <b>everything downstream reads the returned set and never the request</b> — the same shape as
    /// step 1 and for the same reason. A replayed battle returns no row, so its <c>drops</c> array is
    /// never read, no duplicate <c>player_item</c> is written, and the bestiary does not move.
    /// §4.1 names the alternative and why it is wrong: deriving this from an "already granted?"
    /// lookup is how a boss's Divine drop gets granted twice.
    /// </para>
    /// </summary>
    private static async Task<List<BattleRequest>> IngestBattlesAsync(
        TraverserDbContext db,
        Player player,
        IReadOnlyList<BattleRequest> battles,
        CancellationToken ct)
    {
        if (battles.Count == 0)
        {
            return [];
        }

        // Same intra-batch rule as deltas: first occurrence wins, the rest are simply not inserted.
        var seen = new HashSet<Guid>();
        var unique = battles.Where(b => seen.Add(b.ClientBattleId)).ToList();

        var ids = unique.Select(_ => Guid.CreateVersion7()).ToArray();
        var clientBattleIds = unique.Select(b => b.ClientBattleId).ToArray();
        var grantIds = unique.Select(b => b.GrantId).ToArray();
        var enemyIds = unique.Select(b => b.EnemyId).ToArray();
        var kinds = unique.Select(b => SnakeCase(b.EncounterKind)).ToArray();
        var levels = unique.Select(b => b.EnemyLevel).ToArray();
        var outcomes = unique.Select(b => SnakeCase(b.Outcome)).ToArray();
        var startedAt = unique.Select(b => b.StartedAt.ToUniversalTime()).ToArray();
        var endedAt = unique.Select(b => b.EndedAt.ToUniversalTime()).ToArray();

        // Battle XP is derived here and stored on the row, but it is applied to the player by step 5
        // along with everything else — this column is the audit trail, not a second source of truth.
        var xp = unique.Select(b => BattleXp(b)).ToArray();

        var returned = await db.Database
            .SqlQueryRaw<Guid>(
                """
                INSERT INTO battle
                    (id, player_id, client_battle_id, grant_id, enemy_id, encounter_kind,
                     enemy_level, outcome, xp_awarded, started_at, ended_at)
                SELECT u.id, {0}, u.client_battle_id, u.grant_id, u.enemy_id, u.encounter_kind,
                       u.enemy_level, u.outcome, u.xp_awarded, u.started_at, u.ended_at
                FROM unnest({1}::uuid[], {2}::uuid[], {3}::uuid[], {4}::text[], {5}::text[],
                            {6}::int[], {7}::text[], {8}::int[], {9}::timestamptz[], {10}::timestamptz[])
                     AS u(id, client_battle_id, grant_id, enemy_id, encounter_kind,
                          enemy_level, outcome, xp_awarded, started_at, ended_at)
                ON CONFLICT (player_id, client_battle_id) DO NOTHING
                RETURNING client_battle_id AS "Value"
                """,
                player.Id, ids, clientBattleIds, grantIds, enemyIds, kinds,
                levels, outcomes, xp, startedAt, endedAt)
            .ToListAsync(ct);

        var accepted = returned.ToHashSet();
        var inserted = unique.Where(b => accepted.Contains(b.ClientBattleId)).ToList();

        if (inserted.Count == 0)
        {
            return [];
        }

        await ApplyBattleEffectsAsync(db, player, inserted, ct);

        return inserted;
    }

    /// <summary>
    /// The bestiary, the drops, the Vigor result and the consumed items — <b>only for newly-inserted
    /// battles</b>, which is what the caller passes and the only thing it ever passes.
    /// </summary>
    private static async Task ApplyBattleEffectsAsync(
        TraverserDbContext db,
        Player player,
        IReadOnlyList<BattleRequest> inserted,
        CancellationToken ct)
    {
        var enemyIds = inserted.Select(b => b.EnemyId).Distinct().ToList();

        var bestiary = await db.PlayerBestiary
            .Where(b => b.PlayerId == player.Id && enemyIds.Contains(b.EnemyId))
            .ToDictionaryAsync(b => b.EnemyId, ct);

        // Every id the seed can actually grant. A drop naming anything else is skipped rather than
        // inserted, because a foreign-key violation here fails the whole sync and the client retries
        // a 500 forever — one bad drop would wedge every later sync behind it.
        var knownGear = (await db.GearDefs.AsNoTracking().Select(g => g.Id).ToListAsync(ct)).ToHashSet();
        var knownItems = (await db.ItemDefs.AsNoTracking().Select(i => i.Id).ToListAsync(ct)).ToHashSet();

        foreach (var battle in inserted)
        {
            if (!bestiary.TryGetValue(battle.EnemyId, out var row))
            {
                row = new PlayerBestiary
                {
                    PlayerId = player.Id,
                    EnemyId = battle.EnemyId,
                    FirstSeenAt = battle.StartedAt.ToUniversalTime(),
                    EncounterCount = 0,
                    DefeatCount = 0,
                };

                db.PlayerBestiary.Add(row);
                bestiary[battle.EnemyId] = row;
            }

            row.EncounterCount += 1;

            if (battle.Outcome == BattleOutcome.Win)
            {
                row.DefeatCount += 1;
            }

            foreach (var drop in battle.Drops ?? [])
            {
                if (drop.Kind == "item")
                {
                    if (!knownItems.Contains(drop.DefId))
                    {
                        continue;
                    }

                    var item = new PlayerItem
                    {
                        PlayerId = player.Id,
                        ItemDefId = drop.DefId,
                        AcquiredAt = battle.EndedAt.ToUniversalTime(),
                        Source = SourceFor(battle.EncounterKind),
                    };

                    // ↯ The device's id when it sent one, so its row and this one are the same
                    // physical object and `items_consumed` can name it (T5 §10.3). Only reachable
                    // for a newly-inserted battle, so a replay cannot re-insert the same id.
                    if (drop.PlayerItemId is Guid itemId)
                    {
                        item.Id = itemId;
                    }

                    db.PlayerItems.Add(item);

                    continue;
                }

                // ↯ **A drop naming a gear piece this seed does not have is skipped, not inserted.**
                // T5 §10.1 has the client send a *tier* (`mortal`) because GDD 8's loot table is M3;
                // T2 §4.1's example sends a `gear_def_id`. The two disagree, and inserting the tier
                // raised a foreign-key violation that failed the whole sync — which, on a 500, the
                // client retries forever, so one gear drop wedged every later sync behind it.
                // Skipping keeps the battle row, the XP and the item drops flowing while GDD 8's
                // table is still M3's work. See DECISIONS 2026-08-20.
                if (!knownGear.Contains(drop.DefId))
                {
                    continue;
                }

                db.PlayerGear.Add(new PlayerGear
                {
                    // The device's id when it sent one, for the same reason as an item's.
                    Id = drop.PlayerGearId ?? Guid.CreateVersion7(),
                    PlayerId = player.Id,
                    GearDefId = drop.DefId,
                    // Stored as sent: frozen at drop time by design (T2 §4.1, tech-01 §4).
                    LevelAtDrop = drop.LevelAtDrop ?? battle.EnemyLevel,
                    BonusPrimary = drop.BonusPrimary ?? 0,
                    BonusSecondary = drop.BonusSecondary,
                    AcquiredAt = battle.EndedAt.ToUniversalTime(),
                    Source = drop.Kind,
                });
            }
        }

        // The Vigor result of the **last battle to end**, not of whichever arrived last in the array:
        // a client that syncs two fights in one payload must not have the earlier one's leftover
        // Vigor win by ordering accident.
        var latest = inserted.OrderByDescending(b => b.EndedAt).First();

        player.VigorCurrent = latest.VigorAfter;
        player.VigorAnchorAt = latest.EndedAt.ToUniversalTime();

        // GDD 10 §6 — the tutorial is one-time, and the battle row is the proof it happened, so
        // there is no separate endpoint to call and nothing to get out of step. Set once: a replayed
        // payload returns no rows at all, and the null check keeps the original instant even if a
        // second tutorial battle somehow arrived.
        var tutorial = inserted
            .Where(b => b.EncounterKind == BattleEncounterKind.Tutorial && b.Outcome == BattleOutcome.Win)
            .OrderBy(b => b.EndedAt)
            .FirstOrDefault();

        if (tutorial is not null && player.TutorialCompletedAt is null)
        {
            player.TutorialCompletedAt = tutorial.EndedAt.ToUniversalTime();
        }

        var consumed = inserted.SelectMany(b => b.ItemsConsumed ?? []).Distinct().ToList();

        if (consumed.Count > 0)
        {
            // Idempotent by primary key: a row already gone deletes nothing and is not an error.
            await db.PlayerItems
                .Where(i => i.PlayerId == player.Id && consumed.Contains(i.Id))
                .ExecuteDeleteAsync(ct);
        }
    }

    /// <summary>
    /// T2 §4 step 7 — recompute gate state from the new Waymarker and open whatever the dual gate
    /// now allows. Gate state itself is never stored (tech-01 §4); the only durable consequence is a
    /// <c>player_zone_progress</c> row, and only a final-boss gate has one.
    /// <para>
    /// Mid-boss gates are absent from the query on purpose: they are soft, they unlock nothing, and
    /// GDD 9 §4.2 has the player walk straight past an undefeated Cyclops.
    /// </para>
    /// </summary>
    /// <returns>The zones this sync opened, and every zone the player now holds.</returns>
    private static async Task<(List<string> Unlocked, HashSet<string> Open)> EvaluateGatesAsync(
        TraverserDbContext db,
        Player player,
        CancellationToken ct)
    {
        var leagues = player.LifetimeSteps / EncounterCheckpoints.StepsPerLeague;

        var open = (await db.PlayerZoneProgress
            .AsNoTracking()
            .Where(p => p.PlayerId == player.Id)
            .Select(p => p.ZoneId)
            .ToListAsync(ct)).ToHashSet();

        var reachable = await db.ZoneGates
            .AsNoTracking()
            .Where(g => g.UnlocksZoneId != null && g.LeagueThreshold <= leagues)
            .Join(db.Zones, g => g.UnlocksZoneId, z => z.Id, (g, z) => new { g.EnemyId, Zone = z })
            // `egypt_tbd` seeds unreleased (GDD 9 §3.1). Its gate still exists so the Map can draw a
            // locked terminus, but opening it would hand the player a zone with no content in it.
            .Where(x => x.Zone.IsReleased && !open.Contains(x.Zone.Id))
            .ToListAsync(ct);

        var unlocked = new List<string>();

        if (reachable.Count == 0)
        {
            return (unlocked, open);
        }

        var gateEnemies = reachable.Select(x => x.EnemyId).ToList();

        var defeated = (await db.PlayerBestiary
            .AsNoTracking()
            .Where(b => b.PlayerId == player.Id && b.DefeatCount > 0 && gateEnemies.Contains(b.EnemyId))
            .Select(b => b.EnemyId)
            .ToListAsync(ct)).ToHashSet();

        foreach (var candidate in reachable.Where(x => defeated.Contains(x.EnemyId)))
        {
            db.PlayerZoneProgress.Add(new PlayerZoneProgress
            {
                PlayerId = player.Id,
                ZoneId = candidate.Zone.Id,
                UnlockedAt = DateTime.UtcNow,
            });

            open.Add(candidate.Zone.Id);
            unlocked.Add(candidate.Zone.Id);
        }

        return (unlocked, open);
    }

    /// <summary>
    /// T2 §4 step 8 — GDD 9 §5's three sources against one daily pool.
    /// <para>
    /// ↯ Nothing here reads <c>request.Deltas</c>. Travel rolls come from the *change in*
    /// <c>lifetime_steps</c> that step 6 just applied, so a replayed batch — which merged nothing —
    /// crosses no Leagues and issues no grants. That is the same replay property steps 1 and 2 rest
    /// on, arrived at from the other end.
    /// </para>
    /// </summary>
    private static async Task<List<EncounterGrantResponse>> IssueEncountersAsync(
        TraverserDbContext db,
        Player player,
        SyncRequest request,
        IReadOnlyList<(HrSession Row, HrSessionRequest Sent)> sessions,
        long stepsBefore,
        IReadOnlyList<SyncDeltaRequest> newDeltas,
        Dictionary<DateOnly, ActivityDay> days,
        HashSet<string> zonesOpen,
        IRandomSource rng,
        CancellationToken ct)
    {
        var explores = request.Explores ?? [];
        var travelRolls = EncounterCheckpoints.TravelRolls(stepsBefore, player.LifetimeSteps);

        var grants = new List<EncounterGrantResponse>();

        if (travelRolls == 0 && sessions.Count == 0 && explores.Count == 0)
        {
            return grants;
        }

        var zones = await db.Zones.AsNoTracking().OrderByDescending(z => z.Ordinal).ToListAsync(ct);

        // A zone's entry threshold is the League threshold of the gate that unlocks it; `olympion`
        // is unlocked by no gate and starts at 0.
        var entryThreshold = await db.ZoneGates
            .AsNoTracking()
            .Where(g => g.UnlocksZoneId != null)
            .ToDictionaryAsync(g => g.UnlocksZoneId!, g => (long)g.LeagueThreshold, ct);

        var wildByZone = (await db.Enemies
                .AsNoTracking()
                .Where(e => e.Role == EnemyRole.Wild && e.ZoneId != null)
                .Select(e => new { e.Id, ZoneId = e.ZoneId! })
                .ToListAsync(ct))
            .GroupBy(e => e.ZoneId)
            .ToDictionary(g => g.Key, g => g.Select(e => e.Id).ToList());

        // GDD 9 §5.1 — "the zone segment that League falls within", narrowed to segments the player
        // has actually opened. Ordinal descending, so the furthest one whose entry is behind the
        // League wins and an unopened Valheon simply leaves the roll in Olympion.
        string? SegmentFor(long league) => zones
            .FirstOrDefault(z => zonesOpen.Contains(z.Id) && entryThreshold.GetValueOrDefault(z.Id, 0L) <= league)
            ?.Id;

        async Task<ActivityDay> DayAsync(DateOnly date)
        {
            if (days.TryGetValue(date, out var known))
            {
                return known;
            }

            var day = await db.ActivityDays
                .FirstOrDefaultAsync(a => a.PlayerId == player.Id && a.ActivityDate == date, ct);

            if (day is null)
            {
                day = new ActivityDay
                {
                    PlayerId = player.Id,
                    ActivityDate = date,
                    StepGoalSnapshot = player.DailyStepGoal,
                };

                db.ActivityDays.Add(day);
            }

            days[date] = day;

            return day;
        }

        // Issues iff the day has room. The return value is what the session counter advances on, so
        // a capped-out roll is not recorded as granted.
        bool Issue(ActivityDay day, long league, EncounterGrantSource source, string? zoneId = null)
        {
            if (day.EncountersUsed >= EncounterCheckpoints.DailyCap)
            {
                return false;
            }

            zoneId ??= SegmentFor(league);

            if (zoneId is null || !wildByZone.TryGetValue(zoneId, out var roster) || roster.Count == 0)
            {
                return false;
            }

            // GDD 5–7 give the wild rosters no selection weights, so the draw is uniform
            // (DECISIONS 2026-08-22).
            var grant = new EncounterGrant
            {
                PlayerId = player.Id,
                ZoneId = zoneId,
                EnemyId = roster[rng.Next(roster.Count)],
                Source = source,
                ActivityDate = day.ActivityDate,
                IssuedAt = DateTime.UtcNow,
            };

            db.EncounterGrants.Add(grant);
            day.EncountersUsed += 1;
            grants.Add(new EncounterGrantResponse(
                grant.Id, grant.ZoneId, grant.EnemyId, source, day.ActivityDate));

            return true;
        }

        // ---- Forward travel ---------------------------------------------------------------------
        if (travelRolls > 0 && newDeltas.Any(d => d.StepsDelta > 0))
        {
            // The day the crossing landed on, which is the client's own date and not the server's.
            var travelDay = await DayAsync(newDeltas.Where(d => d.StepsDelta > 0).Max(d => d.ActivityDate));
            var leaguesBefore = stepsBefore / EncounterCheckpoints.StepsPerLeague;

            for (var crossed = 1; crossed <= travelRolls; crossed += 1)
            {
                if (rng.NextDouble() < EncounterCheckpoints.TravelChance)
                {
                    Issue(travelDay, leaguesBefore + crossed, EncounterGrantSource.Travel);
                }
            }
        }

        var leaguesNow = player.LifetimeSteps / EncounterCheckpoints.StepsPerLeague;

        // ---- Workout session bonus --------------------------------------------------------------
        foreach (var (session, sent) in sessions)
        {
            // "Tier 1 or above" (GDD 9 §5.1) — all three tiers count toward the 15-minute step.
            var owed = EncounterCheckpoints.SessionRolls(
                sent.Tier1Minutes + sent.Tier2Minutes + sent.Tier3Minutes,
                session.EncounterRollsGranted);

            if (owed == 0)
            {
                continue;
            }

            var day = await DayAsync(sent.ActivityDate);

            for (var i = 0; i < owed; i += 1)
            {
                // Guaranteed, not rolled — §5.1 calls this the reward for a structured workout.
                if (!Issue(day, leaguesNow, EncounterGrantSource.Workout))
                {
                    break;
                }

                session.EncounterRollsGranted += 1;
            }
        }

        // ---- Explore ----------------------------------------------------------------------------
        foreach (var explore in explores)
        {
            var first = await db.Database.ExecuteSqlAsync(
                $"""
                 INSERT INTO client_operation (player_id, operation_id, endpoint)
                 VALUES ({player.Id}, {explore.OperationId}, {"POST /sync (explore)"})
                 ON CONFLICT (player_id, operation_id) DO NOTHING
                 """,
                ct);

            // Zero rows means this tap already spent its roll. Silent, like every other replay here.
            // GDD 9 §4.3 allows Explore only on a segment already unlocked, re-checked rather than
            // trusted — the tap names the zone.
            if (first == 1 && zonesOpen.Contains(explore.ZoneId))
            {
                Issue(await DayAsync(explore.ActivityDate), leaguesNow, EncounterGrantSource.Explore, explore.ZoneId);
            }
        }

        return grants;
    }

    /// <summary>
    /// T2 §6.3 — a session's tier minutes are <b>set, not added</b>, because the device re-sends the
    /// same growing session every pass. Keyed on <c>external_session_id</c>, which T3 §6.1 freezes at
    /// the session's start for exactly this reason.
    /// </summary>
    private static async Task<List<(HrSession Row, HrSessionRequest Sent)>> UpsertSessionsAsync(
        TraverserDbContext db,
        Player player,
        IReadOnlyList<HrSessionRequest> sent,
        CancellationToken ct)
    {
        if (sent.Count == 0)
        {
            return [];
        }

        var seen = new HashSet<string>();
        var unique = sent.Where(s => seen.Add(s.ExternalSessionId)).ToList();
        var keys = unique.Select(s => s.ExternalSessionId).ToList();

        var existing = await db.HrSessions
            .Where(h => h.PlayerId == player.Id && keys.Contains(h.ExternalSessionId!))
            .ToDictionaryAsync(h => h.ExternalSessionId!, ct);

        var resolved = new List<(HrSession, HrSessionRequest)>();

        foreach (var session in unique)
        {
            if (!existing.TryGetValue(session.ExternalSessionId, out var row))
            {
                row = new HrSession
                {
                    PlayerId = player.Id,
                    ExternalSessionId = session.ExternalSessionId,
                    StartedAt = session.StartedAt.ToUniversalTime(),
                };

                db.HrSessions.Add(row);
                existing[session.ExternalSessionId] = row;
            }

            row.EndedAt = session.EndedAt?.ToUniversalTime();
            row.Tier1Minutes = session.Tier1Minutes;
            row.Tier2Minutes = session.Tier2Minutes;
            row.Tier3Minutes = session.Tier3Minutes;

            resolved.Add((row, session));
        }

        return resolved;
    }

    /// <summary>GDD 1 §2.3 — wins only, at the level the battle was fought at. Losses award 0.</summary>
    private static int BattleXp(BattleRequest battle) =>
        battle.Outcome == BattleOutcome.Win ? 15 + (battle.EnemyLevel * 2) : 0;

    /// <summary>Which <c>item_source</c> a drop is attributed to, from the encounter it fell out of.</summary>
    private static ItemSource SourceFor(BattleEncounterKind kind) => kind switch
    {
        BattleEncounterKind.MiniBoss => ItemSource.MinibossDrop,
        BattleEncounterKind.ZoneBoss => ItemSource.BossDrop,
        BattleEncounterKind.Tutorial => ItemSource.Tutorial,
        _ => ItemSource.WildDrop,
    };

    /// <summary>
    /// T2 §4 steps 3 and 4, together because step 4's Tier 3 cap needs step 3's <em>pre-merge</em>
    /// totals and its own running total within the batch.
    /// </summary>
    private static async Task<(Dictionary<Guid, int> XpByDelta, Dictionary<DateOnly, ActivityDay> Days)> MergeAndDeriveXpAsync(
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
                // `day.Steps` is the running cumulative and must stay un-incremented until after
                // this line — it is what the step remainder is carried against.
                var xp = XpRates.ForSteps(delta.StepsDelta, day.Steps);

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

        return (xpByDelta, existing);
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

    /// <summary>Same reason as above: the raw INSERT bypasses EF's value converter.</summary>
    private static string SnakeCase(BattleEncounterKind kind) => kind switch
    {
        BattleEncounterKind.Wild => "wild",
        BattleEncounterKind.MiniBoss => "mini_boss",
        BattleEncounterKind.ZoneBoss => "zone_boss",
        BattleEncounterKind.Tutorial => "tutorial",
        BattleEncounterKind.Explore => "explore",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown battle encounter kind."),
    };

    private static string SnakeCase(BattleOutcome outcome) => outcome switch
    {
        BattleOutcome.Win => "win",
        BattleOutcome.Loss => "loss",
        BattleOutcome.Flee => "flee",
        _ => throw new ArgumentOutOfRangeException(nameof(outcome), outcome, "Unknown battle outcome."),
    };
}
