using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>
/// What the road hands out and what it costs: zone gates (GDD 9 §3), drop rates (GDD 4 §6.1,
/// GDD 8 §5.1–§5.3), milestones (GDD 11 §5.2, GDD 4 §6.3, GDD 8 §5.4) and the XP curve (GDD 1).
/// </summary>
internal static partial class ContentSeed
{
    private static void SeedProgression(ModelBuilder modelBuilder)
    {
        SeedGates(modelBuilder);
        SeedDropRates(modelBuilder);
        SeedMilestones(modelBuilder);
        SeedXpCurve(modelBuilder);
    }

    /// <summary>
    /// Thresholds are fixtures §8; 1 League = 1,000 lifetime steps. Both halves of the dual unlock
    /// condition are here: <c>league_threshold</c> against the Waymarker, and <c>unlocks_zone_id</c>
    /// requiring this gate's boss defeated. Mid-boss gates are soft — the player walks past an
    /// undefeated Cyclops and keeps earning Leagues; final-boss gates are hard walls (GDD 9 §4.2).
    /// </summary>
    private static void SeedGates(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<ZoneGate>().HasData(
            MidBossGate(Ids.Gate.Cyclops, Ids.Zone.Olympion, Ids.Enemy.Cyclops, leagues: 90),
            FinalGate(Ids.Gate.Cerberus, Ids.Zone.Olympion, Ids.Enemy.Cerberus, leagues: 220,
                unlocks: Ids.Zone.Valheon),
            MidBossGate(Ids.Gate.Fenrir, Ids.Zone.Valheon, Ids.Enemy.Fenrir, leagues: 380),
            FinalGate(Ids.Gate.Jormungandr, Ids.Zone.Valheon, Ids.Enemy.Jormungandr, leagues: 900,
                unlocks: Ids.Zone.Imperion),
            MidBossGate(Ids.Gate.Griffin, Ids.Zone.Imperion, Ids.Enemy.Griffin, leagues: 1850),
            // Unlocks the locked terminus rather than nothing, so the Map's "road ahead" state is
            // derived from data like every other gate (GDD 9 §3.1).
            FinalGate(Ids.Gate.Cacus, Ids.Zone.Imperion, Ids.Enemy.Cacus, leagues: 2900,
                unlocks: Ids.Zone.EgyptTbd));

    /// <summary>
    /// The rate *structure* — three independent dice per encounter (item, gear, trinket). A missing
    /// row means that die is never rolled for that encounter: wild encounters have no trinket row
    /// because Trinkets never drop from them (GDD 8 §5.2), and the daily goal has no trinket row for
    /// the same reason.
    /// </summary>
    private static void SeedDropRates(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<DropRate>().HasData(
            // Wild: 35% one Common item, 20% one Mortal piece (GDD 4 §6.1, GDD 8 §5.1).
            Drop(DropEncounterKind.Wild, DropRewardKind.Item, 0.350m, 1, 1, null),
            Drop(DropEncounterKind.Wild, DropRewardKind.Gear, 0.200m, 1, 1, GearTier.Mortal),

            // Mini-boss: 75% items, 60% Heroic gear, guaranteed Heroic Sigil.
            Drop(DropEncounterKind.MiniBoss, DropRewardKind.Item, 0.750m, 1, 2, null),
            Drop(DropEncounterKind.MiniBoss, DropRewardKind.Gear, 0.600m, 1, 1, GearTier.Heroic),
            Drop(DropEncounterKind.MiniBoss, DropRewardKind.Trinket, 1.000m, 1, 1, GearTier.Heroic),

            // Zone boss, first kill: everything guaranteed, 2–3 items including at least one Rare
            // (that "at least one Rare" is a battle-engine rule over the drop pool, not a rate).
            Drop(DropEncounterKind.ZoneBossFirst, DropRewardKind.Item, 1.000m, 2, 3, null),
            Drop(DropEncounterKind.ZoneBossFirst, DropRewardKind.Gear, 1.000m, 1, 1, GearTier.Divine),
            Drop(DropEncounterKind.ZoneBossFirst, DropRewardKind.Trinket, 1.000m, 1, 1, GearTier.Divine),

            // Zone boss, repeat: drops to the mini-boss item rate, Common/Uncommon only — no Rares
            // on repeat kills, across all six bosses without exception (GDD 5 §5).
            Drop(DropEncounterKind.ZoneBossRepeat, DropRewardKind.Item, 0.750m, 1, 2, null),
            Drop(DropEncounterKind.ZoneBossRepeat, DropRewardKind.Gear, 1.000m, 1, 1, GearTier.Mythic),
            Drop(DropEncounterKind.ZoneBossRepeat, DropRewardKind.Trinket, 1.000m, 1, 1, GearTier.Mythic),

            // Daily step goal: 1 guaranteed Common item + an independent 25% Mortal gear roll
            // (GDD 4 §6.2, GDD 8 §5.3).
            Drop(DropEncounterKind.DailyGoal, DropRewardKind.Item, 1.000m, 1, 1, null),
            Drop(DropEncounterKind.DailyGoal, DropRewardKind.Gear, 0.250m, 1, 1, GearTier.Mortal));

    private static void SeedMilestones(ModelBuilder modelBuilder)
    {
        // Fixtures §7. The schema's CHECK constraints already make Trinket and Divine unreachable
        // here, so GDD 11 §5.1's "a streak never grants either" cannot be violated by a bad seed.
        modelBuilder.Entity<StreakMilestone>().HasData(
            Streak(3, GearSlot.Armor, GearTier.Mortal),
            Streak(7, GearSlot.Accessory, GearTier.Mortal),
            Streak(14, GearSlot.Weapon, GearTier.Heroic),
            Streak(25, GearSlot.Armor, GearTier.Heroic),
            Streak(40, GearSlot.Accessory, GearTier.Heroic),
            Streak(60, GearSlot.Weapon, GearTier.Mythic),
            Streak(90, GearSlot.Armor, GearTier.Mythic),
            Streak(120, GearSlot.Accessory, GearTier.Mythic));

        // Two interleaved tracks, deliberately offset so the two never land on the same level-up:
        // items at 10/20/30/40/50/60 (GDD 4 §6.3), gear at 15/25/35/45/55 (GDD 8 §5.4).
        // Each item is matched to the next boss on the road.
        modelBuilder.Entity<LevelMilestone>().HasData(
            ItemAt(10, Ids.Item.IronhideTincture),  // Cerberus — the first item-management fight
            ItemAt(20, Ids.Item.SunderOil),         // blunts Fenrir's acts-first pressure
            ItemAt(30, Ids.Item.Warhex),            // a second SE lever vs. Jörmungandr
            ItemAt(40, Ids.Item.IronhideTincture),  // Griffin — the longest sustained fight
            ItemAt(50, Ids.Item.Thundercrack),      // a pre-L44 fallback vs. Cacus
            ItemAt(60, Ids.Item.SunderOil),         // endgame boss-farming utility
            GearAt(15, GearTier.Heroic),
            GearAt(25, GearTier.Mythic),
            GearAt(35, GearTier.Heroic),
            GearAt(45, GearTier.Mythic),
            GearAt(55, GearTier.Heroic));
    }

    /// <summary>
    /// <c>round(100 × L^1.05)</c>, cap 60 — seeded rather than computed at runtime. The formula is
    /// trivial to evaluate, but .NET's banker's rounding and JS's <c>Math.round</c> disagree at exact
    /// halves, and the client and server must never disagree about whether the player levelled.
    /// <para>
    /// All 21 anchor levels of fixtures §4 are asserted by the seed test. <c>XpToNext</c> is null at
    /// 60, which is also the schema's statement that XP accrual stops there — there is nowhere for
    /// banked overflow to go (GDD 1 §4).
    /// </para>
    /// </summary>
    private static void SeedXpCurve(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<XpCurve>().HasData(
            Xp(1, 100, 0), Xp(2, 207, 100), Xp(3, 317, 307), Xp(4, 429, 624),
            Xp(5, 542, 1053), Xp(6, 656, 1595), Xp(7, 772, 2251), Xp(8, 888, 3023),
            Xp(9, 1005, 3911), Xp(10, 1122, 4916), Xp(11, 1240, 6038), Xp(12, 1359, 7278),
            Xp(13, 1478, 8637), Xp(14, 1597, 10115), Xp(15, 1717, 11712), Xp(16, 1838, 13429),
            Xp(17, 1959, 15267), Xp(18, 2080, 17226), Xp(19, 2201, 19306), Xp(20, 2323, 21507),
            Xp(21, 2445, 23830), Xp(22, 2568, 26275), Xp(23, 2690, 28843), Xp(24, 2813, 31533),
            Xp(25, 2937, 34346), Xp(26, 3060, 37283), Xp(27, 3184, 40343), Xp(28, 3308, 43527),
            Xp(29, 3432, 46835), Xp(30, 3556, 50267), Xp(31, 3681, 53823), Xp(32, 3805, 57504),
            Xp(33, 3930, 61309), Xp(34, 4056, 65239), Xp(35, 4181, 69295), Xp(36, 4306, 73476),
            Xp(37, 4432, 77782), Xp(38, 4558, 82214), Xp(39, 4684, 86772), Xp(40, 4810, 91456),
            Xp(41, 4937, 96266), Xp(42, 5063, 101203), Xp(43, 5190, 106266), Xp(44, 5316, 111456),
            Xp(45, 5443, 116772), Xp(46, 5571, 122215), Xp(47, 5698, 127786), Xp(48, 5825, 133484),
            Xp(49, 5953, 139309), Xp(50, 6080, 145262), Xp(51, 6208, 151342), Xp(52, 6336, 157550),
            Xp(53, 6464, 163886), Xp(54, 6592, 170350), Xp(55, 6720, 176942), Xp(56, 6849, 183662),
            Xp(57, 6977, 190511), Xp(58, 7106, 197488), Xp(59, 7234, 204594), Xp(60, null, 211828));

    private static ZoneGate MidBossGate(string id, string zoneId, string enemyId, int leagues) =>
        new()
        {
            Id = id,
            ZoneId = zoneId,
            EnemyId = enemyId,
            GateKind = GateKind.MidBoss,
            LeagueThreshold = leagues,
            UnlocksZoneId = null,
            IsHardGate = false,
        };

    private static ZoneGate FinalGate(string id, string zoneId, string enemyId, int leagues, string unlocks) =>
        new()
        {
            Id = id,
            ZoneId = zoneId,
            EnemyId = enemyId,
            GateKind = GateKind.FinalBoss,
            LeagueThreshold = leagues,
            UnlocksZoneId = unlocks,
            IsHardGate = true,
        };

    private static DropRate Drop(
        DropEncounterKind kind, DropRewardKind reward, decimal chance, int qtyMin, int qtyMax, GearTier? tier) =>
        new()
        {
            EncounterKind = kind,
            RewardKind = reward,
            Chance = chance,
            QtyMin = qtyMin,
            QtyMax = qtyMax,
            Tier = tier,
        };

    private static StreakMilestone Streak(int day, GearSlot slot, GearTier tier) =>
        new() { Day = day, Slot = slot, Tier = tier };

    private static LevelMilestone ItemAt(int level, string itemDefId) =>
        new()
        {
            Level = level,
            RewardKind = MilestoneRewardKind.Item,
            ItemDefId = itemDefId,
            GearTier = null,
        };

    private static LevelMilestone GearAt(int level, GearTier tier) =>
        new()
        {
            Level = level,
            RewardKind = MilestoneRewardKind.Gear,
            ItemDefId = null,
            GearTier = tier,
        };

    private static XpCurve Xp(int level, int? xpToNext, int cumulative) =>
        new() { Level = level, XpToNext = xpToNext, Cumulative = cumulative };
}
