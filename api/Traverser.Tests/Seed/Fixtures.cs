namespace Traverser.Tests.Seed;

/// <summary>
/// Expected values transcribed from <c>docs/traverser-test-fixtures.md</c>, the canonical test oracle.
/// <para>
/// **These are never edited to make a test pass.** Every table here was generated programmatically
/// from the GDD's own formulas during the full-GDD audit — if the seed disagrees with a value below,
/// the seed is wrong (tech-01 §5).
/// </para>
/// </summary>
internal static class Fixtures
{
    /// <summary>
    /// §1 — the type chart. Rows = attacker, columns = defender, in cycle order
    /// Storm → War → Trickery → Underworld → Sea → Wisdom.
    /// </summary>
    internal static readonly string[] TypeOrder =
        ["storm", "war", "trickery", "underworld", "sea", "wisdom"];

    internal static readonly decimal[][] TypeChart =
    [
        //            Storm  War    Trick  Under  Sea    Wisdom
        /* Storm  */ [1.0m,  2.0m,  2.0m,  1.0m,  0.5m,  0.5m],
        /* War    */ [0.5m,  1.0m,  2.0m,  2.0m,  1.0m,  0.5m],
        /* Trick  */ [0.5m,  0.5m,  1.0m,  2.0m,  2.0m,  1.0m],
        /* Under  */ [1.0m,  0.5m,  0.5m,  1.0m,  2.0m,  2.0m],
        /* Sea    */ [2.0m,  1.0m,  0.5m,  0.5m,  1.0m,  2.0m],
        /* Wisdom */ [2.0m,  2.0m,  1.0m,  0.5m,  0.5m,  1.0m],
    ];

    /// <summary>§4 — the XP curve's 21 anchor levels: level → (XP to next, cumulative to reach).</summary>
    internal static readonly (int Level, int? XpToNext, int Cumulative)[] XpAnchors =
    [
        (1, 100, 0), (2, 207, 100), (3, 317, 307), (4, 429, 624), (5, 542, 1053),
        (6, 656, 1595), (7, 772, 2251), (8, 888, 3023), (9, 1005, 3911), (10, 1122, 4916),
        (15, 1717, 11712), (20, 2323, 21507), (25, 2937, 34346), (30, 3556, 50267),
        (35, 4181, 69295), (40, 4810, 91456), (45, 5443, 116772), (50, 6080, 145262),
        (55, 6720, 176942), (59, 7234, 204594), (60, null, 211828),
    ];

    /// <summary>§5 — gear bonus at eight reference levels: level → (Mortal, Heroic, Mythic, Divine).</summary>
    internal static readonly (int Level, int Mortal, int Heroic, int Mythic, int Divine)[] GearBonuses =
    [
        (1, 1, 2, 3, 4), (10, 1, 3, 5, 6), (15, 2, 4, 6, 8), (22, 2, 4, 7, 10),
        (30, 3, 5, 8, 12), (42, 3, 6, 10, 14), (52, 4, 7, 12, 17), (60, 4, 8, 13, 19),
    ];

    /// <summary>
    /// The Trinket split — GDD 8 §3.3's per-stat columns, granted to Favor **and** Aegis both.
    /// Level → (Heroic, Mythic, Divine). The audit's own worked example is the last row: Divine at
    /// L60 → bonus 19 → 11 Favor + 11 Aegis.
    /// </summary>
    internal static readonly (int Level, int Heroic, int Mythic, int Divine)[] TrinketBonuses =
    [
        (10, 2, 3, 4), (15, 2, 4, 5), (22, 2, 4, 6), (30, 3, 5, 7),
        (42, 4, 6, 8), (52, 4, 7, 10), (60, 5, 8, 11),
    ];

    /// <summary>§6 — all 36 enemy stat rows: `floor(base + rate × L)` at the reference levels.</summary>
    internal static readonly (string Enemy, int Level, int Vigor, int Might, int Resolve, int Favor, int Aegis, int Stride)[] EnemyStats =
    [
        ("enemy_harpy", 5, 23, 6, 6, 10, 7, 15),
        ("enemy_harpy", 15, 53, 8, 8, 18, 12, 25),
        ("enemy_harpy", 30, 98, 12, 12, 29, 20, 40),
        ("enemy_satyr", 5, 20, 8, 8, 10, 8, 11),
        ("enemy_satyr", 15, 45, 13, 13, 18, 13, 19),
        ("enemy_satyr", 30, 83, 21, 21, 29, 21, 30),
        ("enemy_cyclops", 10, 60, 20, 15, 12, 12, 7),
        ("enemy_cyclops", 15, 82, 25, 19, 14, 14, 8),
        ("enemy_cyclops", 30, 150, 40, 30, 22, 22, 12),
        ("enemy_cerberus", 15, 102, 20, 14, 19, 15, 8),
        ("enemy_cerberus", 20, 130, 24, 17, 23, 18, 10),
        ("enemy_cerberus", 30, 185, 31, 22, 30, 23, 12),
        ("enemy_draugr", 15, 45, 19, 16, 12, 13, 12),
        ("enemy_draugr", 25, 70, 26, 22, 17, 18, 17),
        ("enemy_draugr", 35, 95, 34, 28, 22, 23, 22),
        ("enemy_valkyrie", 15, 36, 9, 9, 22, 13, 26),
        ("enemy_valkyrie", 25, 56, 12, 12, 31, 18, 36),
        ("enemy_valkyrie", 35, 76, 15, 15, 40, 23, 46),
        ("enemy_fenrir", 20, 102, 26, 20, 21, 17, 20),
        ("enemy_fenrir", 25, 122, 30, 23, 24, 19, 23),
        ("enemy_fenrir", 35, 162, 38, 29, 30, 24, 29),
        ("enemy_jormungandr", 28, 130, 24, 13, 32, 24, 12),
        ("enemy_jormungandr", 31, 142, 26, 14, 34, 26, 12),
        ("enemy_jormungandr", 40, 178, 32, 17, 42, 32, 15),
        ("enemy_strix", 33, 95, 22, 22, 37, 22, 35),
        ("enemy_strix", 45, 127, 28, 28, 48, 28, 45),
        ("enemy_strix", 60, 166, 36, 36, 62, 36, 57),
        ("enemy_lemures", 33, 99, 37, 31, 25, 26, 24),
        ("enemy_lemures", 45, 131, 47, 39, 33, 34, 30),
        ("enemy_lemures", 60, 172, 60, 50, 42, 43, 39),
        ("enemy_griffin", 44, 130, 47, 39, 44, 37, 40),
        ("enemy_griffin", 50, 145, 52, 44, 48, 41, 45),
        ("enemy_griffin", 60, 170, 61, 51, 56, 48, 52),
        ("enemy_cacus", 54, 140, 59, 37, 64, 41, 24),
        ("enemy_cacus", 57, 147, 62, 39, 67, 43, 25),
        ("enemy_cacus", 60, 154, 65, 41, 70, 45, 26),
    ];

    /// <summary>§7 — the streak milestone ladder: day → (slot, tier).</summary>
    internal static readonly (int Day, string Slot, string Tier)[] StreakLadder =
    [
        (3, "armor", "mortal"),
        (7, "accessory", "mortal"),
        (14, "weapon", "heroic"),
        (25, "armor", "heroic"),
        (40, "accessory", "heroic"),
        (60, "weapon", "mythic"),
        (90, "armor", "mythic"),
        (120, "accessory", "mythic"),
    ];

    /// <summary>§8 — zone gate thresholds in Leagues (1 League = 1,000 lifetime steps).</summary>
    internal static readonly (string Gate, int Leagues)[] GateThresholds =
    [
        ("gate_cyclops", 90),
        ("gate_cerberus", 220),
        ("gate_fenrir", 380),
        ("gate_jormungandr", 900),
        ("gate_griffin", 1850),
        ("gate_cacus", 2900),
    ];
}
