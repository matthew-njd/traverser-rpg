using Traverser.Api.Data;

namespace Traverser.Api.Contracts;

/// <summary>
/// <c>GET /api/v1/content/bundle</c> — the whole seeded content set (tech-01 §3) in one response,
/// ETagged with <see cref="ContentVersion"/>.
/// <para>
/// One record per content table, named for the table, in tech-01 §3's own order. The client stores
/// these into mirror tables of the same names (T4 §5.1), so a field added here needs a column there
/// and nowhere in between.
/// </para>
/// <para>
/// ↯ Every non-integer travels as a decimal <em>string</em> at the column's own scale (tech-02 §2).
/// A type multiplier that arrives as the JSON number <c>0.5</c> is parsed by a binary float and the
/// damage pipeline floors twice (T5 §3.2) — the one place where a representation error does not
/// stay small.
/// </para>
/// </summary>
public sealed record ContentBundleResponse(
    int ContentVersion,
    DateTime GeneratedAt,
    IReadOnlyList<GameTypeResponse> GameTypes,
    IReadOnlyList<TypeEffectivenessResponse> TypeEffectiveness,
    IReadOnlyList<ZoneResponse> Zones,
    IReadOnlyList<ZoneGateResponse> ZoneGates,
    IReadOnlyList<EnemyResponse> Enemies,
    IReadOnlyList<EnemyStatScalingResponse> EnemyStatScaling,
    IReadOnlyList<EnemyMoveResponse> EnemyMoves,
    IReadOnlyList<EnemyDropPoolResponse> EnemyDropPool,
    IReadOnlyList<PlayerSkillDefResponse> PlayerSkillDefs,
    IReadOnlyList<GearMoveResponse> GearMoves,
    IReadOnlyList<GearDefResponse> GearDefs,
    IReadOnlyList<GearTierBonusResponse> GearTierBonuses,
    IReadOnlyList<ItemDefResponse> ItemDefs,
    IReadOnlyList<DropRateResponse> DropRates,
    IReadOnlyList<LevelMilestoneResponse> LevelMilestones,
    IReadOnlyList<StreakMilestoneResponse> StreakMilestones,
    IReadOnlyList<XpCurveResponse> XpCurve);

public sealed record GameTypeResponse(string Id, string DisplayName, int CycleOrdinal);

public sealed record TypeEffectivenessResponse(
    string AttackerTypeId,
    string DefenderTypeId,
    string Multiplier);

public sealed record ZoneResponse(string Id, string DisplayName, int Ordinal, bool IsReleased);

public sealed record ZoneGateResponse(
    string Id,
    string ZoneId,
    string EnemyId,
    GateKind GateKind,
    int LeagueThreshold,
    string? UnlocksZoneId,
    bool IsHardGate);

/// <param name="ZoneId">Null for <c>enemy_waystone_wisp</c>, which belongs to no zone.</param>
/// <param name="TypeId">Null for <c>enemy_waystone_wisp</c>, which is typeless.</param>
public sealed record EnemyResponse(
    string Id,
    string DisplayName,
    string? ZoneId,
    string? TypeId,
    EnemyRole Role);

public sealed record EnemyStatScalingResponse(
    string EnemyId,
    StatKind Stat,
    string Base,
    string Rate);

/// <param name="TypeId">Null for Physical moves, which never take a type multiplier (T5 §3.3).</param>
public sealed record EnemyMoveResponse(
    string Id,
    string EnemyId,
    string DisplayName,
    MoveCategory Category,
    string? TypeId,
    int Power,
    int AiWeight);

public sealed record EnemyDropPoolResponse(
    string EnemyId,
    DropEncounterKind EncounterKind,
    string ItemDefId,
    int Weight);

public sealed record PlayerSkillDefResponse(
    string Id,
    string DisplayName,
    MoveCategory Category,
    string? TypeId,
    int Power,
    int? Uses,
    int UnlockLevel);

public sealed record GearMoveResponse(
    string Id,
    string DisplayName,
    string TypeId,
    int Power,
    int Uses,
    MoveEffect? Effect);

public sealed record GearDefResponse(
    string Id,
    string DisplayName,
    GearSlot Slot,
    GearTier Tier,
    string? ZoneId,
    string? GrantsMoveId,
    string? Flavor);

public sealed record GearTierBonusResponse(
    GearTier Tier,
    string Rate,
    int Flat,
    string TrinketSplit);

public sealed record ItemDefResponse(
    string Id,
    string DisplayName,
    ItemCategory Category,
    ItemRarity Rarity,
    string? TypeId,
    int? HealPct,
    MoveEffect? Effect,
    int MaxStack,
    bool BattleOnly,
    string Flavor);

public sealed record DropRateResponse(
    DropEncounterKind EncounterKind,
    DropRewardKind RewardKind,
    string Chance,
    int QtyMin,
    int QtyMax,
    GearTier? Tier);

public sealed record LevelMilestoneResponse(
    int Level,
    MilestoneRewardKind RewardKind,
    string? ItemDefId,
    GearTier? GearTier);

public sealed record StreakMilestoneResponse(int Day, GearSlot Slot, GearTier Tier);

/// <param name="XpToNext">Null at level 60 — the curve's terminus, not a missing row (GDD 1 §4).</param>
public sealed record XpCurveResponse(int Level, int? XpToNext, int Cumulative);
