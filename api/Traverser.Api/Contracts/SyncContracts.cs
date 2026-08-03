using Traverser.Api.Data;

namespace Traverser.Api.Contracts;

/// <summary>
/// <c>POST /api/v1/sync</c>. M1 carries deltas only — T2 §4's request also lists completed battles,
/// <c>hr_session</c> upserts and queued Explore requests, all of which belong to transaction steps
/// (2, 8) that arrive with the battle engine at M2.
/// </summary>
/// <param name="ContentVersion">
/// The client's cached content version. Recorded in the response's echo but **not yet enforced** —
/// M1 decision §3.2 defers the content bundle to M2, so nothing this transaction touches depends on
/// which content the client holds. <c>content_version_stale</c> becomes reachable when the bundle does.
/// </param>
public sealed record SyncRequest(
    IReadOnlyList<SyncDeltaRequest> Deltas,
    int ContentVersion);

/// <param name="ClientDeltaId">
/// ↯ A UUIDv7 minted on-device when the delta was created and never regenerated on retry (T2 §5).
/// **This is the entire idempotency mechanism.** It must not be a hash of the payload: two
/// legitimately distinct deltas can be identical in content — the same step count, from the same
/// source, in the same minute — and a content-derived key would collide, the second would be
/// dropped, and the player would silently lose real steps.
/// </param>
/// <param name="ActivityDate">
/// A bare <c>YYYY-MM-DD</c>, always supplied by the client and never derived server-side from
/// <paramref name="RecordedAt"/> (T2 §2). The client owns the local-midnight boundary because it
/// owns the live timezone; a server deriving it would put the day boundary in the wrong place for
/// anyone who travels.
/// </param>
/// <param name="HrTier">1–3, and required when <paramref name="Source"/> is <c>hr</c>.</param>
public sealed record SyncDeltaRequest(
    Guid ClientDeltaId,
    DateOnly ActivityDate,
    SyncDeltaSource Source,
    int StepsDelta,
    int MinutesDelta,
    int? HrTier,
    DateTime RecordedAt);

/// <param name="AcceptedDeltaIds">
/// Newly inserted. Together with <paramref name="DuplicateDeltaIds"/> this is what lets the client
/// dequeue safely — both lists mean "stop resending this", and the split exists only so a
/// duplicate-heavy sync is visible in logs rather than invisible (T2 §4).
/// </param>
/// <param name="ActivityDays">Only the dates this sync touched, not the player's whole history.</param>
public sealed record SyncResponse(
    DateTime ServerTime,
    int ContentVersion,
    PlayerStateResponse Player,
    long Leagues,
    StreakResponse Streak,
    IReadOnlyList<LevelUpResponse> LevelUps,
    IReadOnlyList<ActivityDayResponse> ActivityDays,
    IReadOnlyList<Guid> AcceptedDeltaIds,
    IReadOnlyList<Guid> DuplicateDeltaIds);

/// <param name="Level">The level reached, not the one left behind.</param>
public sealed record LevelUpResponse(int Level, int StatPointsAwarded);

/// <param name="StepGoalSnapshot">
/// The goal as it stood when the day was first created, never updated afterwards (tech-01 §4) —
/// raising the goal must not retroactively un-hit a day that was legitimately earned.
/// </param>
/// <param name="StreakCreditMethod">
/// Always null in M1: T2 §4 step 9 is streak evaluation and GDD 11 is M4's section. Present on the
/// wire now because the column exists and the client mirrors it.
/// </param>
public sealed record ActivityDayResponse(
    DateOnly ActivityDate,
    int Steps,
    int Tier1Minutes,
    int Tier2Minutes,
    int Tier3Minutes,
    int XpAwarded,
    int StepGoalSnapshot,
    bool GoalMet,
    StreakCreditMethod? StreakCreditMethod);

/// <summary>
/// <c>POST /api/v1/players/me/allocations</c> — spend unspent stat points (T2 §3).
/// <para>
/// Six named fields rather than T2's "per-stat delta map": the six stats are locked by GDD 1 §5 and
/// by tech-01's <c>StatKind</c>, so a dictionary would buy an open key space that has to be
/// validated back down to exactly these six.
/// </para>
/// </summary>
/// <param name="OperationId">
/// Client-generated and minted once, never regenerated on retry. A replay is rejected on this ID —
/// not silently re-added, which for an additive write is the difference between idempotent and
/// doubling.
/// </param>
public sealed record AllocateStatPointsRequest(
    Guid OperationId,
    int Vigor,
    int Might,
    int Resolve,
    int Favor,
    int Aegis,
    int Stride)
{
    public int Total => Vigor + Might + Resolve + Favor + Aegis + Stride;

    public bool HasNegative => Vigor < 0 || Might < 0 || Resolve < 0 || Favor < 0 || Aegis < 0 || Stride < 0;
}

/// <summary>
/// <c>PATCH /api/v1/players/me/settings</c>. Null means "leave alone"; last-write-wins is correct
/// here because these are point-in-time preferences rather than accumulating values (T2 §6.3).
/// <para>
/// M1 exposes the two that M1 can act on. Reminder time and volumes are M5 (notifications and the
/// audio bus), and a settable field nothing reads would be a promise the app does not keep.
/// </para>
/// </summary>
public sealed record UpdateSettingsRequest(int? DailyStepGoal, int? BirthYear);
