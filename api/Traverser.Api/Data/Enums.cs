namespace Traverser.Api.Data;

// The closed sets from tech-01 §2. Each is stored as `text` + a CHECK constraint and mapped
// through SnakeCaseEnumConverter — deliberately not a Postgres ENUM type, which would need a
// migration to add a value and interacts badly with EF's model snapshot.
//
// Enum member names convert to their stored text by PascalCase → snake_case (MidBoss → mid_boss),
// so the CHECK lists in the model configuration are generated from these types and cannot drift.

/// <summary>`enemy_move.category`, `player_skill_def.category`.</summary>
public enum MoveCategory
{
    Physical,
    Divine
}

/// <summary>Secondary effects — `gear_move.effect`, `item_def.effect`.</summary>
public enum MoveEffect
{
    Weaken,
    Fortify,
    Swift,
    Rend
}

/// <summary>`item_def.category`.</summary>
public enum ItemCategory
{
    Heal,
    Buff,
    Surge,
    Breach
}

/// <summary>`item_def.rarity`.</summary>
public enum ItemRarity
{
    Common,
    Uncommon,
    Rare
}

/// <summary>`gear_def.slot`, `player_gear.equipped_slot`, `streak_milestone.slot` (Trinket excluded there).</summary>
public enum GearSlot
{
    Weapon,
    Armor,
    Accessory,
    Trinket
}

/// <summary>`gear_def.tier`, `gear_tier_bonus.tier`, `streak_milestone.tier` (Divine excluded there).</summary>
public enum GearTier
{
    Mortal,
    Heroic,
    Mythic,
    Divine
}

/// <summary>`enemy_stat_scaling.stat`. The six stats of GDD 1 §3.</summary>
public enum StatKind
{
    Vigor,
    Might,
    Resolve,
    Favor,
    Aegis,
    Stride
}

/// <summary>`enemy.role`.</summary>
public enum EnemyRole
{
    Wild,
    MidBoss,
    ZoneBoss,
    Tutorial
}

/// <summary>`zone_gate.gate_kind`.</summary>
public enum GateKind
{
    MidBoss,
    FinalBoss
}

/// <summary>
/// `drop_rate.encounter_kind` / `enemy_drop_pool.encounter_kind` — the loot-table axis, which
/// splits a zone boss into first-kill and repeat. Distinct from <see cref="BattleEncounterKind"/>.
/// </summary>
public enum DropEncounterKind
{
    Wild,
    MiniBoss,
    ZoneBossFirst,
    ZoneBossRepeat,
    DailyGoal
}

/// <summary>`drop_rate.reward_kind` — the three independent dice per encounter.</summary>
public enum DropRewardKind
{
    Item,
    Gear,
    Trinket
}

/// <summary>`level_milestone.reward_kind` — two interleaved tracks, no Trinket.</summary>
public enum MilestoneRewardKind
{
    Item,
    Gear
}

/// <summary>
/// `battle.encounter_kind` — how the battle was entered. Distinct from <see cref="DropEncounterKind"/>:
/// a battle does not know whether it is a first kill, and loot does not know about Explore.
/// </summary>
public enum BattleEncounterKind
{
    Wild,
    MiniBoss,
    ZoneBoss,
    Tutorial,
    Explore
}

/// <summary>`battle.outcome`. A loss awards 0 XP with no penalty (GDD 1 §2.3).</summary>
public enum BattleOutcome
{
    Win,
    Loss,
    Flee
}

/// <summary>`player_item.source`.</summary>
public enum ItemSource
{
    WildDrop,
    MinibossDrop,
    BossDrop,
    DailyGoal,
    LevelMilestone,
    StreakOverflow,
    ZoneEntry,
    Tutorial
}

/// <summary>
/// `activity_day.streak_credit_method`. Null on a past date is a break (GDD 11 §3.3) — there is
/// deliberately no "streak lost" member, and no column to put one in.
/// </summary>
public enum StreakCreditMethod
{
    GoalHit,
    RestDayTag,
    AutoSyncGrace
}

/// <summary>`sync_delta.source`.</summary>
public enum SyncDeltaSource
{
    Steps,
    Hr,
    Battle,
    Manual
}

/// <summary>`milestone_grant.milestone_kind` — the permission slip for every one-time reward.</summary>
public enum MilestoneKind
{
    LevelItem,
    LevelGear,
    StreakDay,
    ZoneEntry,
    Tutorial
}

/// <summary>`pending_reward.kind`.</summary>
public enum PendingRewardKind
{
    Item,
    Gear
}

/// <summary>`pending_reward.resolution`.</summary>
public enum PendingRewardResolution
{
    Kept,
    Discarded
}
