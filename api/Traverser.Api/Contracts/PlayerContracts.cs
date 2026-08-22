namespace Traverser.Api.Contracts;

// tech-02 §2 — snake_case on the wire, so these property names map 1:1 onto tech-01's column names
// and a payload can be read against the schema with no mental translation. The policy is set once
// in Program.cs (JsonNamingPolicy.SnakeCaseLower); nothing here carries a [JsonPropertyName].

/// <summary>
/// <c>POST /api/v1/players</c>. Exactly the three fields tech-02 §3 names — the birth year GDD 10
/// Screen 3 collects arrives through <c>PATCH /players/me/settings</c> instead, so registration
/// stays the one call that must succeed before anything else can.
/// </summary>
/// <param name="PlayerId">↯ Client-minted at first launch (tech-02 §1.4), never generated here.</param>
/// <param name="TraverserName">GDD 10 §5.1 — 20 characters, defaulting to "Traverser".</param>
/// <param name="Timezone">IANA, e.g. <c>America/New_York</c>.</param>
public sealed record RegisterPlayerRequest(Guid PlayerId, string TraverserName, string Timezone);

/// <summary>
/// The token is returned exactly once per call and never again — only its SHA-256 is stored, so
/// there is no endpoint that can re-read it. Losing it means re-registering (which is why
/// registration is idempotent) or restoring it from the tech-06 §13.1 export.
/// </summary>
public sealed record RegisterPlayerResponse(string Token, PlayerProfileResponse Profile);

/// <summary>
/// <c>GET /api/v1/players/me</c> — the full authoritative snapshot, and the mirror's one-shot
/// repair path (tech-02 §3): when the client suspects drift it refetches this whole document rather
/// than reconciling field by field. Anything the mirror persists has to appear here, or a repair
/// would silently leave that field stale.
/// </summary>
public sealed record PlayerProfileResponse(
    PlayerStateResponse Player,
    long Leagues,
    StreakResponse Streak,
    PlayerSettingsResponse Settings,
    IReadOnlyList<string> UnlockedZoneIds,
    IReadOnlyList<PlayerGearResponse> Gear,
    IReadOnlyList<PlayerItemResponse> Items);

/// <summary>
/// An owned gear instance. <c>Id</c> is the server's, and that is the point of carrying it: the
/// client mirrors these rows verbatim so both tiers name the same physical object.
/// </summary>
/// <param name="EquippedSlot">Null when owned but not worn. At most one row per slot (tech-01 §4).</param>
/// <param name="BonusPrimary">
/// **Frozen at drop time (GDD 8 §3.2)** — sent as stored and never recomputed by either tier.
/// <c>LevelAtDrop</c> travels alongside purely so it *can* be re-derived for verification.
/// </param>
public sealed record PlayerGearResponse(
    Guid Id,
    string GearDefId,
    string? EquippedSlot,
    int LevelAtDrop,
    int BonusPrimary,
    int? BonusSecondary,
    DateTime AcquiredAt);

/// <summary>
/// One row per *physical* item, not a stack (GDD 4 §5.1). <c>Id</c> is what a battle payload's
/// <c>items_consumed</c> names, so the client cannot invent one — it mirrors what is sent here.
/// </summary>
public sealed record PlayerItemResponse(Guid Id, string ItemDefId, DateTime AcquiredAt);

/// <param name="XpToNext">
/// From the seeded <c>xp_curve</c>, never recomputed (tech-01) — <c>round(100 × L^1.05)</c> is
/// trivial, but .NET's banker's rounding and JS's <c>Math.round</c> disagree at exact halves and
/// the two tiers must never disagree about whether the player levelled. **Null at Level 60**, which
/// is the schema's way of saying XP accrual stops there with nothing banked (GDD 1 §4).
/// </param>
/// <param name="VigorCurrent">
/// Raw stored value, as at <c>VigorAnchorAt</c>. Passive regen is not applied here: it needs max
/// Vigor, which needs the equipped gear and the live local-midnight boundary — both the client's
/// (GDD 2 §6, T2 §2). The client derives recovery from these two fields on read.
/// </param>
/// <param name="VigorAnchorAt">
/// When <c>VigorCurrent</c> was last set by a battle, a restore or registration. The client's regen
/// clock, not the server's — nothing here reads it.
/// </param>
public sealed record PlayerStateResponse(
    Guid PlayerId,
    string TraverserName,
    string Timezone,
    DateTime CreatedAt,
    int Level,
    int XpCurrent,
    int? XpToNext,
    long XpLifetime,
    int UnspentStatPoints,
    int AllocVigor,
    int AllocMight,
    int AllocResolve,
    int AllocFavor,
    int AllocAegis,
    int AllocStride,
    int VigorCurrent,
    DateTime VigorAnchorAt,
    long LifetimeSteps,
    int DailyStepGoal,
    DateTime? TutorialCompletedAt);

/// <param name="LastCreditedDate">
/// A bare <c>YYYY-MM-DD</c>, like every other date on this surface (§2) — the client owns the
/// local-midnight boundary, so a date here is never derived from an instant.
/// </param>
public sealed record StreakResponse(int Current, int Longest, DateOnly? LastCreditedDate);

/// <param name="MusicVolume">
/// ↯ A decimal <em>string</em>, not a JSON number — tech-02 §2: "integers or decimal strings, never
/// floats". These are the only non-integers on M1's wire, and sending them as JSON numbers would
/// hand them to JavaScript's binary float parser for no benefit.
/// </param>
/// <param name="BirthYear">
/// Null means <em>not yet collected</em>, not "unknown age" — HR tier thresholds cannot be derived
/// without it, so tier minutes are not charged at all rather than defaulting to some assumed age
/// (T3 §1.4). Step XP is unaffected either way.
/// </param>
public sealed record PlayerSettingsResponse(
    TimeOnly? DailyReminderTime,
    string MusicVolume,
    string SfxVolume,
    int? BirthYear);
