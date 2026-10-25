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
    int ContentVersion,
    /// <summary>
    /// Completed battles with their client-rolled drops (T2 §4.1). Optional so an M1-era client, and
    /// every sync that fought nothing, keeps sending exactly what it sent before.
    /// </summary>
    IReadOnlyList<BattleRequest>? Battles = null,
    /// <summary>
    /// HR sessions as the device derived them (T3 §6). Step 8's session bonus is the only reader,
    /// and until M3/P5 there was none — which is why nothing uploaded them.
    /// </summary>
    IReadOnlyList<HrSessionRequest>? Sessions = null,
    /// <summary>
    /// GDD 9 §4.3's Explore taps, queued while offline (T2 §1.3). Each consumes one roll from the
    /// same daily pool as travel and the session bonus.
    /// </summary>
    IReadOnlyList<ExploreRequest>? Explores = null,
    /// <summary>
    /// The device's local date when it synced (T2 §4). Step 9 reads it as "today": the day this sync
    /// marks as opened, and where the streak's run is counted back from. Null skips step 9.
    /// </summary>
    DateOnly? LocalDate = null);

/// <param name="ExternalSessionId">
/// ↯ <c>hr:{started_at epoch seconds}</c>, frozen by the device's ledger (T3 §6.1). Tier minutes are
/// **set, not added** on re-observation (T2 §6.3), which only works while a growing session keeps
/// the same key — so a late-arriving sample that shifts the start must not mint a second id.
/// </param>
/// <param name="ActivityDate">
/// The local date this session's bonus rolls are charged against, supplied by the client like every
/// other date on this surface (§2). A session carries instants, and the server does not own the
/// player's midnight — so it cannot derive which day's cap the bonus spends from.
/// </param>
public sealed record HrSessionRequest(
    string ExternalSessionId,
    DateTime StartedAt,
    DateTime? EndedAt,
    DateOnly ActivityDate,
    int Tier1Minutes,
    int Tier2Minutes,
    int Tier3Minutes);

/// <param name="OperationId">
/// Client-minted and never regenerated. An Explore tap spends a roll, so a replayed request that
/// slipped through would spend a second one — the operation ledger is what stops that.
/// </param>
/// <param name="ZoneId">
/// The segment the player was looking at, which GDD 9 §4.3 requires to be one they have already
/// unlocked. The server re-checks that rather than trusting the tap.
/// </param>
public sealed record ExploreRequest(Guid OperationId, string ZoneId, DateOnly ActivityDate);

/// <param name="ClientBattleId">
/// ↯ Minted at battle start and never re-derived (T2 §5, T5 §8). **This is the entire idempotency
/// mechanism for a battle** — a resumed fight keeps the id it began with, so a payload that arrives
/// twice inserts once and its drops are granted once.
/// </param>
/// <param name="EnemyLevel">
/// Recorded as sent. It equals the player's level at encounter time and is history, not a live
/// value — an old battle's row keeps the level it was fought at (tech-01 §4).
/// </param>
/// <param name="ItemsConsumed">`player_item` ids spent during the fight. Deleted, idempotent by key.</param>
public sealed record BattleRequest(
    Guid ClientBattleId,
    Guid? GrantId,
    /// <summary>
    /// The local calendar date the battle's XP belongs to, supplied by the client like every other
    /// date on this surface (§2) — the server never derives one from an instant, because it does not
    /// own the player's midnight. Not in T2 §4.1's original payload sketch; added 2026-08-17 because
    /// step 4 credits battle XP to `activity_day.xp_awarded` and had no date to credit it to.
    /// </summary>
    DateOnly ActivityDate,
    string EnemyId,
    BattleEncounterKind EncounterKind,
    int EnemyLevel,
    BattleOutcome Outcome,
    DateTime StartedAt,
    DateTime EndedAt,
    int VigorAfter,
    IReadOnlyList<Guid> ItemsConsumed,
    IReadOnlyList<BattleDropRequest> Drops);

/// <param name="LevelAtDrop">
/// Gear and trinket only. Stored alongside the frozen bonus purely so it *can* be re-derived for
/// verification — never to re-derive it in practice (T2 §4.1, tech-01 §4).
/// </param>
/// <param name="BonusPrimary">
/// ↯ The **frozen** rolled bonus, supplied by the client. This is the only place in the API where
/// the client sends a value the server could otherwise derive, and it is deliberate: the bonus is
/// frozen at drop time by design, so re-deriving it server-side would be the bug rather than the
/// check. Null for items, which carry no bonus.
/// </param>
/// <param name="PlayerItemId">
/// ↯ **Item drops only, and minted on the device** (T5 §10.3, amended 2026-08-22). The client has
/// already inserted this row locally, so the satchel holds the drop before the next sync — and
/// <c>items_consumed</c> then names a row that exists on both tiers. Null falls back to a
/// server-minted id, which is what an M2-era client sends.
/// </param>
public sealed record BattleDropRequest(
    string Kind,
    string DefId,
    int? LevelAtDrop = null,
    int? BonusPrimary = null,
    int? BonusSecondary = null,
    Guid? PlayerItemId = null);

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
    IReadOnlyList<Guid> DuplicateDeltaIds,
    /// <summary>
    /// Encounters this sync issued (T2 §1.3). The zone and enemy are already resolved and the grant
    /// is already charged against the day's cap, so the client spends it whenever — online or not.
    /// </summary>
    IReadOnlyList<EncounterGrantResponse> EncounterGrants,
    /// <summary>Zones this sync unlocked, from step 7's dual gate (GDD 9 §3).</summary>
    IReadOnlyList<string> UnlockedZoneIds,
    /// <summary>
    /// Step 10's rewards that landed this sync. The ids are the server's, so the device mirrors these
    /// rows verbatim — the response carries no inventory otherwise.
    /// </summary>
    IReadOnlyList<RewardResponse> RewardsGranted,
    /// <summary>Every unresolved reward parked past a cap (GDD 4 §5.2, GDD 8 §5.5).</summary>
    IReadOnlyList<PendingRewardResponse> PendingRewards);

/// <param name="Kind"><c>item</c> or <c>gear</c>.</param>
/// <param name="Source">The <c>player_item.source</c> or <c>player_gear.source</c> it was stored with.</param>
public sealed record RewardResponse(
    string Kind,
    Guid Id,
    string DefId,
    string Source,
    int? LevelAtDrop,
    int? BonusPrimary,
    int? BonusSecondary,
    DateTime AcquiredAt);

public sealed record PendingRewardResponse(
    Guid Id,
    string Kind,
    string DefId,
    int? LevelAtDrop,
    int? BonusPrimary,
    int? BonusSecondary,
    DateTime CreatedAt);

/// <param name="Source">Which of GDD 9 §5.1's three sources produced it. All share one daily pool.</param>
public sealed record EncounterGrantResponse(
    Guid GrantId,
    string ZoneId,
    string EnemyId,
    EncounterGrantSource Source,
    DateOnly ActivityDate);

/// <param name="Level">The level reached, not the one left behind.</param>
public sealed record LevelUpResponse(int Level, int StatPointsAwarded);

/// <param name="StepGoalSnapshot">
/// The goal as it stood when the day was first created, never updated afterwards (tech-01 §4) —
/// raising the goal must not retroactively un-hit a day that was legitimately earned.
/// </param>
/// <param name="StreakCreditMethod">Why the day counts toward the streak (T2 §4 step 9), or null.</param>
/// <param name="RestTaggedAt">When the player tagged the day (GDD 11 §3.1), or null.</param>
public sealed record ActivityDayResponse(
    DateOnly ActivityDate,
    int Steps,
    int Tier1Minutes,
    int Tier2Minutes,
    int Tier3Minutes,
    int XpAwarded,
    int StepGoalSnapshot,
    bool GoalMet,
    StreakCreditMethod? StreakCreditMethod,
    DateTime? RestTaggedAt);

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

/// <summary>
/// <c>POST /api/v1/players/me/rest-days</c> — GDD 11 §3.1's manual tag, which is also GDD 2 §6's
/// Vigor restore. One tag, one action, two effects.
/// <para>
/// No operation id, unlike an allocation: every field here is set to a value rather than added to
/// one, so a replayed tag lands on the same row with the same result.
/// </para>
/// </summary>
/// <param name="ActivityDate">
/// The player's own local calendar date, never derived from an instant here (T2 §2). GDD 11 §3.1's
/// 24-hour retroactive window is the client's to enforce, for the same reason.
/// </param>
/// <param name="VigorAfter">
/// ↯ The restored value, sent rather than computed. 100% of max needs max Vigor, which needs the
/// equipped gear and GDD 8's tier bonuses — the client's, exactly as <c>vigor_after</c> on a battle
/// payload is (T5 §1.6).
/// </param>
public sealed record TagRestDayRequest(DateOnly ActivityDate, int VigorAfter);

/// <summary>
/// <c>PUT /api/v1/players/me/gear/{player_gear_id}/equipped</c> — GDD 8 §2. Set, not added, so a
/// replay lands the same result and needs no operation id (T2 §6.3).
/// </summary>
/// <param name="EquippedSlot">The slot to wear the piece in, or null to unequip it.</param>
/// <param name="VigorAfter">
/// Sent only when unequipping Vigor gear left current Vigor above the new max, so the client clamped
/// it. Null leaves Vigor alone. The client's number, as on a Rest Day (T5 §1.6).
/// </param>
public sealed record EquipGearRequest(GearSlot? EquippedSlot, int? VigorAfter);

/// <summary>
/// <c>POST /api/v1/players/me/items/{player_item_id}/use</c> — GDD 4 §4's out-of-battle heal.
/// </summary>
/// <param name="VigorAfter">
/// The healed value, the client's as on a Rest Day: the heal is a percentage of max Vigor, which
/// needs the equipped gear (T5 §1.6).
/// </param>
public sealed record UseItemRequest(int VigorAfter);

/// <summary>
/// <c>PUT /api/v1/players/me/skills</c> — GDD 2 §5's loadout, sent whole. Set, not added, so a replay
/// lands the same result and needs no operation id (T2 §6.3).
/// </summary>
/// <param name="SkillIds">Slot order, at most four. Skills and worn Trinket moves alike (GDD 3 §4.1).</param>
public sealed record SetSkillsRequest(IReadOnlyList<string> SkillIds);
