using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>
/// The 13 enemies (12 canon + the tutorial Wisp) with their stat scaling, move sets and drop pools —
/// GDD 5 (Olympion), GDD 6 (Valheon), GDD 7 (Imperion), GDD 10 §6.2 (the Wisp).
/// </summary>
internal static partial class ContentSeed
{
    private static void SeedEnemies(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Enemy>().HasData(
            // Olympion (GDD 5)
            Foe(Ids.Enemy.Harpy, "Harpy", Ids.Zone.Olympion, Ids.Type.Storm, EnemyRole.Wild),
            Foe(Ids.Enemy.Satyr, "Satyr", Ids.Zone.Olympion, Ids.Type.Trickery, EnemyRole.Wild),
            Foe(Ids.Enemy.Cyclops, "Cyclops", Ids.Zone.Olympion, Ids.Type.War, EnemyRole.MidBoss),
            Foe(Ids.Enemy.Cerberus, "Cerberus", Ids.Zone.Olympion, Ids.Type.Underworld, EnemyRole.ZoneBoss),
            // Valheon (GDD 6)
            Foe(Ids.Enemy.Draugr, "Draugr", Ids.Zone.Valheon, Ids.Type.Underworld, EnemyRole.Wild),
            Foe(Ids.Enemy.Valkyrie, "Valkyrie", Ids.Zone.Valheon, Ids.Type.Storm, EnemyRole.Wild),
            Foe(Ids.Enemy.Fenrir, "Fenrir", Ids.Zone.Valheon, Ids.Type.War, EnemyRole.MidBoss),
            Foe(Ids.Enemy.Jormungandr, "Jörmungandr", Ids.Zone.Valheon, Ids.Type.Sea, EnemyRole.ZoneBoss),
            // Imperion (GDD 7)
            Foe(Ids.Enemy.Strix, "Strix", Ids.Zone.Imperion, Ids.Type.Trickery, EnemyRole.Wild),
            Foe(Ids.Enemy.Lemures, "Lemures", Ids.Zone.Imperion, Ids.Type.Underworld, EnemyRole.Wild),
            Foe(Ids.Enemy.Griffin, "Griffin", Ids.Zone.Imperion, Ids.Type.Wisdom, EnemyRole.MidBoss),
            Foe(Ids.Enemy.Cacus, "Cacus", Ids.Zone.Imperion, Ids.Type.Storm, EnemyRole.ZoneBoss),
            // Tutorial-only, non-canon: belongs to no zone and is outside the type chart entirely
            // (GDD 10 §6.2), which is why both FKs are null.
            Foe(Ids.Enemy.WaystoneWisp, "Waystone Wisp", null, null, EnemyRole.Tutorial));

        // `floor(Base + Rate × L)`. Enemy level always equals player level at encounter time, so
        // there is no enemy level to persist anywhere — base and rate are the whole stat block.
        // All 36 reference rows of fixtures §6 are reproduced by the seed test.
        //                                  Vigor         Might          Resolve       Favor          Aegis         Stride
        modelBuilder.Entity<EnemyStatScaling>().HasData([
            .. Scaling(Ids.Enemy.Harpy,       (8, 3.0m),  (5, 0.25m),  (5, 0.25m),  (7, 0.75m),  (5, 0.5m),   (10, 1.0m)),
            .. Scaling(Ids.Enemy.Satyr,       (8, 2.5m),  (6, 0.5m),   (6, 0.5m),   (7, 0.75m),  (6, 0.5m),   (8, 0.75m)),
            .. Scaling(Ids.Enemy.Cyclops,    (15, 4.5m), (10, 1.0m),   (8, 0.75m),  (7, 0.5m),   (7, 0.5m),   (5, 0.25m)),
            .. Scaling(Ids.Enemy.Cerberus,   (20, 5.5m),  (9, 0.75m),  (7, 0.5m),   (8, 0.75m),  (8, 0.5m),   (5, 0.25m)),
            .. Scaling(Ids.Enemy.Draugr,      (8, 2.5m),  (8, 0.75m),  (7, 0.6m),   (5, 0.5m),   (6, 0.5m),   (5, 0.5m)),
            .. Scaling(Ids.Enemy.Valkyrie,    (6, 2.0m),  (5, 0.3m),   (5, 0.3m),   (9, 0.9m),   (6, 0.5m),  (11, 1.0m)),
            .. Scaling(Ids.Enemy.Fenrir,     (22, 4.0m), (10, 0.8m),   (8, 0.6m),   (9, 0.6m),   (7, 0.5m),   (8, 0.6m)),
            .. Scaling(Ids.Enemy.Jormungandr,(18, 4.0m),  (8, 0.6m),   (5, 0.3m),  (10, 0.8m),   (8, 0.6m),   (5, 0.25m)),
            .. Scaling(Ids.Enemy.Strix,      (10, 2.6m),  (6, 0.5m),   (6, 0.5m),   (8, 0.9m),   (6, 0.5m),   (9, 0.8m)),
            .. Scaling(Ids.Enemy.Lemures,    (10, 2.7m),  (9, 0.85m),  (8, 0.7m),   (6, 0.6m),   (7, 0.6m),   (6, 0.55m)),
            .. Scaling(Ids.Enemy.Griffin,    (20, 2.5m), (10, 0.85m),  (9, 0.7m),  (11, 0.75m),  (9, 0.65m), (10, 0.7m)),
            .. Scaling(Ids.Enemy.Cacus,      (22, 2.2m), (11, 0.9m),   (8, 0.55m), (13, 0.95m),  (9, 0.6m),   (7, 0.32m)),
            // The Wisp has fixed stats, not a scaling curve — every rate is 0, so `floor(base + 0 × L)`
            // holds it at the tutorial's deterministic values for a player who is always Level 1.
            // Vigor 15 / Resolve 8 / Favor 12 / Stride 6 are pinned by fixtures §3 and GDD 10 §6.2.
            // Might and Aegis are unreachable — the Wisp's only move is Divine (Favor vs. Aegis, so its
            // own Might never applies) and the tutorial's only player action is a Physical Basic Attack
            // (Might vs. Resolve, so the Wisp's Aegis never applies). They are set to the Level 1
            // baseline of 10 rather than 0, so that no code path can ever divide by zero.
            .. Scaling(Ids.Enemy.WaystoneWisp,(15, 0m),  (10, 0m),     (8, 0m),    (12, 0m),    (10, 0m),     (6, 0m)),
        ]);

        // 28 rows. AI weights sum to 100 per enemy — asserted by a seed test, since a per-group CHECK
        // isn't expressible. Physical moves carry no type; the type on a Divine move is what the enemy
        // *is*, and is never used as a multiplier against the player (that rule lives in T5).
        modelBuilder.Entity<EnemyMove>().HasData(
            Divine(Ids.EMove.GustStrike, "Gust Strike", Ids.Enemy.Harpy, Ids.Type.Storm, 40, 70),
            Physical(Ids.EMove.Buffet, "Buffet", Ids.Enemy.Harpy, 25, 30),

            Divine(Ids.EMove.ShadowLunge, "Shadow Lunge", Ids.Enemy.Satyr, Ids.Type.Trickery, 45, 60),
            Physical(Ids.EMove.QuickJab, "Quick Jab", Ids.Enemy.Satyr, 30, 40),

            Physical(Ids.EMove.BoulderHurl, "Boulder Hurl", Ids.Enemy.Cyclops, 40, 60),
            Divine(Ids.EMove.WarShout, "War Shout", Ids.Enemy.Cyclops, Ids.Type.War, 55, 40),

            Divine(Ids.EMove.DeathBreath, "Death Breath", Ids.Enemy.Cerberus, Ids.Type.Underworld, 60, 45),
            Physical(Ids.EMove.ThreeFangedStrike, "Three-Fanged Strike", Ids.Enemy.Cerberus, 50, 35),
            Physical(Ids.EMove.SavageBiteCerberus, "Savage Bite", Ids.Enemy.Cerberus, 40, 20),

            Physical(Ids.EMove.GraveSwing, "Grave Swing", Ids.Enemy.Draugr, 50, 60),
            Divine(Ids.EMove.SoulDrain, "Soul Drain", Ids.Enemy.Draugr, Ids.Type.Underworld, 40, 40),

            Divine(Ids.EMove.StormLance, "Storm Lance", Ids.Enemy.Valkyrie, Ids.Type.Storm, 50, 80),
            Physical(Ids.EMove.ShieldBash, "Shield Bash", Ids.Enemy.Valkyrie, 20, 20),

            // Shares a display name with Cerberus's move at a different weight — hence per-owner keys.
            Physical(Ids.EMove.SavageBiteFenrir, "Savage Bite", Ids.Enemy.Fenrir, 40, 50),
            Divine(Ids.EMove.WarHowl, "War Howl", Ids.Enemy.Fenrir, Ids.Type.War, 50, 50),

            Physical(Ids.EMove.CrushingCoil, "Crushing Coil", Ids.Enemy.Jormungandr, 55, 30),
            Divine(Ids.EMove.VenomTide, "Venom Tide", Ids.Enemy.Jormungandr, Ids.Type.Sea, 65, 45),
            Physical(Ids.EMove.WorldTremor, "World Tremor", Ids.Enemy.Jormungandr, 40, 25),

            Divine(Ids.EMove.Nightcut, "Nightcut", Ids.Enemy.Strix, Ids.Type.Trickery, 45, 60),
            Physical(Ids.EMove.TalonRake, "Talon Rake", Ids.Enemy.Strix, 30, 40),

            Physical(Ids.EMove.RestlessGrasp, "Restless Grasp", Ids.Enemy.Lemures, 50, 60),
            Divine(Ids.EMove.GraveKnell, "Grave Knell", Ids.Enemy.Lemures, Ids.Type.Underworld, 40, 40),

            Physical(Ids.EMove.WingBuffet, "Wing Buffet", Ids.Enemy.Griffin, 50, 50),
            Divine(Ids.EMove.VigilantGaze, "Vigilant Gaze", Ids.Enemy.Griffin, Ids.Type.Wisdom, 55, 50),

            Divine(Ids.EMove.ThunderousRoar, "Thunderous Roar", Ids.Enemy.Cacus, Ids.Type.Storm, 70, 40),
            Physical(Ids.EMove.CinderGrip, "Cinder Grip", Ids.Enemy.Cacus, 60, 35),
            Divine(Ids.EMove.AshenGale, "Ashen Gale", Ids.Enemy.Cacus, Ids.Type.Storm, 45, 25),

            // Divine but typeless: the Wisp is outside the type chart entirely (GDD 10 §6.2). The
            // manifest lists its weight as "scripted" — it is the enemy's only move, so 100 is both the
            // literal truth and what keeps the sum-to-100 test uniform across all 13 enemies.
            new EnemyMove
            {
                Id = Ids.EMove.ChillingGust,
                EnemyId = Ids.Enemy.WaystoneWisp,
                DisplayName = "Chilling Gust",
                Category = MoveCategory.Divine,
                TypeId = null,
                Power = 30,
                AiWeight = 100,
            });

        SeedDropPools(modelBuilder);
    }

    /// <summary>
    /// The per-enemy thematic item subsets from GDD 5–7. These take precedence over the generic common
    /// pool; an enemy with no rows falls back to it. All weights are 1 — the GDD describes these pools
    /// as evenly weighted, and the two "always included" first-kill Rares (Fleet Omen, Ambrosia Shard)
    /// are a battle-engine guarantee (T5), not a weighting.
    /// <para>
    /// <c>enemy_waystone_wisp</c> deliberately has no rows, which is how fixtures §3's "Drops: None"
    /// needs no special case in the engine.
    /// </para>
    /// </summary>
    private static void SeedDropPools(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<EnemyDropPool>().HasData([
            // — Olympion (GDD 5) —
            .. Pool(Ids.Enemy.Harpy, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.Stormveil),
            .. Pool(Ids.Enemy.Satyr, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.Shadowblur, Ids.Item.Battlebrand),
            // Cyclops repeat kills use the same pool as the first kill (GDD 5 §3.3), so one row set.
            .. Pool(Ids.Enemy.Cyclops, DropEncounterKind.MiniBoss,
                Ids.Item.Stormveil, Ids.Item.Battlebrand, Ids.Item.Warhex, Ids.Item.IronhideTincture),
            .. Pool(Ids.Enemy.Cerberus, DropEncounterKind.ZoneBossFirst,
                Ids.Item.FleetOmen, Ids.Item.Gravemark, Ids.Item.PaleAsh),
            .. Pool(Ids.Enemy.Cerberus, DropEncounterKind.ZoneBossRepeat,
                Ids.Item.PaleAsh, Ids.Item.Gravemark, Ids.Item.TravelersSalve, Ids.Item.Warhex,
                Ids.Item.Shadowblur),

            // — Valheon (GDD 6) —
            .. Pool(Ids.Enemy.Draugr, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.PaleAsh),
            .. Pool(Ids.Enemy.Valkyrie, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.Stormveil),
            .. Pool(Ids.Enemy.Fenrir, DropEncounterKind.MiniBoss,
                Ids.Item.Stormveil, Ids.Item.Battlebrand, Ids.Item.IronhideTincture, Ids.Item.Warhex),
            .. Pool(Ids.Enemy.Jormungandr, DropEncounterKind.ZoneBossFirst,
                Ids.Item.AmbrosiaShard, Ids.Item.Shadowbind, Ids.Item.Brinestone),
            .. Pool(Ids.Enemy.Jormungandr, DropEncounterKind.ZoneBossRepeat,
                Ids.Item.Brinestone, Ids.Item.Shadowbind, Ids.Item.Undertow, Ids.Item.TravelersSalve),

            // — Imperion (GDD 7) —
            .. Pool(Ids.Enemy.Strix, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.Shadowblur, Ids.Item.Battlebrand),
            .. Pool(Ids.Enemy.Lemures, DropEncounterKind.Wild,
                Ids.Item.TravelersSalve, Ids.Item.PaleAsh),
            .. Pool(Ids.Enemy.Griffin, DropEncounterKind.MiniBoss,
                Ids.Item.Clearsight, Ids.Item.Undertow, Ids.Item.IronhideTincture),
            .. Pool(Ids.Enemy.Cacus, DropEncounterKind.ZoneBossFirst,
                Ids.Item.AmbrosiaShard, Ids.Item.Thundercrack, Ids.Item.Stormveil),
            .. Pool(Ids.Enemy.Cacus, DropEncounterKind.ZoneBossRepeat,
                Ids.Item.Stormveil, Ids.Item.Thundercrack, Ids.Item.TravelersSalve, Ids.Item.Blindveil),
        ]);

    private static Enemy Foe(string id, string displayName, string? zoneId, string? typeId, EnemyRole role) =>
        new() { Id = id, DisplayName = displayName, ZoneId = zoneId, TypeId = typeId, Role = role };

    /// <summary>Physical: Might vs. Resolve, never typed, never subject to the type chart.</summary>
    private static EnemyMove Physical(string id, string displayName, string enemyId, int power, int aiWeight) =>
        new()
        {
            Id = id,
            EnemyId = enemyId,
            DisplayName = displayName,
            Category = MoveCategory.Physical,
            TypeId = null,
            Power = power,
            AiWeight = aiWeight,
        };

    /// <summary>Divine: Favor vs. Aegis.</summary>
    private static EnemyMove Divine(string id, string displayName, string enemyId, string typeId, int power, int aiWeight) =>
        new()
        {
            Id = id,
            EnemyId = enemyId,
            DisplayName = displayName,
            Category = MoveCategory.Divine,
            TypeId = typeId,
            Power = power,
            AiWeight = aiWeight,
        };

    /// <summary>One enemy's six stat rows, in the fixed order of the GDD's own stat tables.</summary>
    private static EnemyStatScaling[] Scaling(
        string enemyId,
        (decimal Base, decimal Rate) vigor,
        (decimal Base, decimal Rate) might,
        (decimal Base, decimal Rate) resolve,
        (decimal Base, decimal Rate) favor,
        (decimal Base, decimal Rate) aegis,
        (decimal Base, decimal Rate) stride) =>
    [
        Stat(enemyId, StatKind.Vigor, vigor),
        Stat(enemyId, StatKind.Might, might),
        Stat(enemyId, StatKind.Resolve, resolve),
        Stat(enemyId, StatKind.Favor, favor),
        Stat(enemyId, StatKind.Aegis, aegis),
        Stat(enemyId, StatKind.Stride, stride),
    ];

    private static EnemyStatScaling Stat(string enemyId, StatKind stat, (decimal Base, decimal Rate) p) =>
        new() { EnemyId = enemyId, Stat = stat, Base = p.Base, Rate = p.Rate };

    private static EnemyDropPool[] Pool(string enemyId, DropEncounterKind kind, params string[] itemIds) =>
        [.. itemIds.Select(itemId => new EnemyDropPool
        {
            EnemyId = enemyId,
            EncounterKind = kind,
            ItemDefId = itemId,
            Weight = 1,
        })];
}
