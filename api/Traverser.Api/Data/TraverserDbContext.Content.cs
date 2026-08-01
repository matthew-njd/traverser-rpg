using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data;

/// <summary>
/// The content schema (tech-01 §3) — seeded, read-only at runtime, and collectively the client's
/// content bundle. Content rows use `text` PKs holding the manifest ID verbatim: manifest rule 2
/// guarantees keys never change once shipped, so they are safe natural keys and every FK is
/// self-documenting in a raw query.
/// </summary>
public partial class TraverserDbContext
{
    private static void ConfigureContent(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContentVersion>(entity =>
        {
            entity.ToTable("content_version", t =>
                t.HasCheckConstraint("ck_content_version_singleton", "id = 1"));

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever().HasDefaultValue(1);
            entity.Property(e => e.GeneratedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<GameType>(entity =>
        {
            entity.ToTable("game_type");

            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CycleOrdinal).IsUnique();
        });

        modelBuilder.Entity<TypeEffectiveness>(entity =>
        {
            entity.ToTable("type_effectiveness");

            entity.HasKey(e => new { e.AttackerTypeId, e.DefenderTypeId });
            entity.Property(e => e.Multiplier).HasPrecision(3, 2);

            entity.HasOne(e => e.AttackerType).WithMany()
                .HasForeignKey(e => e.AttackerTypeId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.DefenderType).WithMany()
                .HasForeignKey(e => e.DefenderTypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<Zone>(entity =>
        {
            entity.ToTable("zone");

            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Ordinal).IsUnique();

            // Deliberately NO store default, unlike tech-01 §3's `default true` (DECISIONS 2026-08-01).
            // With one, HasData omitted `is_released` for the only row that wants `false` — EF treats a
            // bool's CLR default as "unset" for seed data regardless of HasSentinel — and the store
            // default shipped `egypt_tbd` as released, unlocking the Map's locked terminus. `zone` is
            // seeded and read-only, so the seed is its only writer and a store-side default has no
            // runtime role to play; the CLR initializer still defaults new rows to true.
            entity.Property(e => e.IsReleased).ValueGeneratedNever();
        });

        modelBuilder.Entity<Enemy>(entity =>
        {
            entity.ToTable("enemy", t =>
                t.HasCheckConstraint("ck_enemy_role", Check.In<EnemyRole>("role")));

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Zone).WithMany()
                .HasForeignKey(e => e.ZoneId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Type).WithMany()
                .HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<EnemyStatScaling>(entity =>
        {
            entity.ToTable("enemy_stat_scaling", t =>
                t.HasCheckConstraint("ck_enemy_stat_scaling_stat", Check.In<StatKind>("stat")));

            entity.HasKey(e => new { e.EnemyId, e.Stat });
            entity.Property(e => e.Base).HasPrecision(6, 2);
            entity.Property(e => e.Rate).HasPrecision(6, 3);

            entity.HasOne(e => e.Enemy).WithMany(e => e.StatScaling)
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<EnemyMove>(entity =>
        {
            entity.ToTable("enemy_move", t =>
            {
                t.HasCheckConstraint("ck_enemy_move_category", Check.In<MoveCategory>("category"));
                // Weights sum to 100 per enemy — asserted by a seed test, since a per-group CHECK
                // isn't expressible.
                //
                // ↯ Lower bound is 1, not 0 (tech-06 §5.4). A zero-weight move is not a move that
                // rarely happens, it is a move that can never be selected — tech-05 §5's weighted
                // pick would silently exclude it, and the enemy would play a smaller movepool than
                // its data says. That reads as a balance problem, not a data problem.
                t.HasCheckConstraint("ck_enemy_move_ai_weight", "ai_weight between 1 and 100");
            });

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Enemy).WithMany(e => e.Moves)
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Type).WithMany()
                .HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<PlayerSkillDef>(entity =>
        {
            entity.ToTable("player_skill_def", t =>
                t.HasCheckConstraint("ck_player_skill_def_category", Check.In<MoveCategory>("category")));

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Type).WithMany()
                .HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<GearMove>(entity =>
        {
            entity.ToTable("gear_move", t =>
                t.HasCheckConstraint("ck_gear_move_effect", Check.In<MoveEffect>("effect")));

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Type).WithMany()
                .HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<ItemDef>(entity =>
        {
            entity.ToTable("item_def", t =>
            {
                t.HasCheckConstraint("ck_item_def_category", Check.In<ItemCategory>("category"));
                t.HasCheckConstraint("ck_item_def_rarity", Check.In<ItemRarity>("rarity"));
                t.HasCheckConstraint("ck_item_def_effect", Check.In<MoveEffect>("effect"));
            });

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Type).WithMany()
                .HasForeignKey(e => e.TypeId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<GearDef>(entity =>
        {
            entity.ToTable("gear_def", t =>
            {
                t.HasCheckConstraint("ck_gear_def_slot", Check.In<GearSlot>("slot"));
                t.HasCheckConstraint("ck_gear_def_tier", Check.In<GearTier>("tier"));
                // tech-06 §5.4, via DECISIONS 2026-07-26: a move-granting piece is a Trinket and
                // nothing else. GDD 3 §4.1's "any Mythic/Divine piece" was narrowed to the Trinket
                // slot by GDD 8 §1 — Weapon/Armor/Accessory are pure stat bonuses at every tier.
                // The FK below already proves the move exists; this proves it belongs here.
                t.HasCheckConstraint(
                    "ck_gear_def_grants_move_trinket_only",
                    $"grants_move_id is null or {Check.In("slot", GearSlot.Trinket)}");
            });

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Zone).WithMany()
                .HasForeignKey(e => e.ZoneId).OnDelete(DeleteBehavior.NoAction);

            // The single direction of the former mutual reference (DECISIONS 2026-07-25):
            // `gear_move.source_gear_id` is dropped, this is the FK that remains.
            entity.HasOne(e => e.GrantsMove).WithMany()
                .HasForeignKey(e => e.GrantsMoveId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<GearTierBonus>(entity =>
        {
            entity.ToTable("gear_tier_bonus", t =>
                t.HasCheckConstraint("ck_gear_tier_bonus_tier", Check.In<GearTier>("tier")));

            entity.HasKey(e => e.Tier);
            entity.Property(e => e.Rate).HasPrecision(4, 3);
            entity.Property(e => e.TrinketSplit).HasPrecision(3, 2);
        });

        modelBuilder.Entity<ZoneGate>(entity =>
        {
            entity.ToTable("zone_gate", t =>
                t.HasCheckConstraint("ck_zone_gate_gate_kind", Check.In<GateKind>("gate_kind")));

            entity.HasKey(e => e.Id);

            entity.HasOne(e => e.Zone).WithMany()
                .HasForeignKey(e => e.ZoneId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Enemy).WithMany()
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.UnlocksZone).WithMany()
                .HasForeignKey(e => e.UnlocksZoneId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<DropRate>(entity =>
        {
            entity.ToTable("drop_rate", t =>
            {
                t.HasCheckConstraint("ck_drop_rate_encounter_kind", Check.In<DropEncounterKind>("encounter_kind"));
                t.HasCheckConstraint("ck_drop_rate_reward_kind", Check.In<DropRewardKind>("reward_kind"));
                // tech-06 §5.4 — a probability, open at the bottom and closed at the top. Zero is
                // excluded because "this reward never drops" is expressed by *omitting the row*,
                // not by a row claiming a 0% chance: a missing row is meaningful here (there is no
                // `trinket` row for wild encounters or the daily goal, GDD 8 §5.2), so allowing
                // both spellings would make the absence ambiguous.
                t.HasCheckConstraint("ck_drop_rate_chance", "chance > 0 and chance <= 1");
            });

            entity.HasKey(e => new { e.EncounterKind, e.RewardKind });
            entity.Property(e => e.Chance).HasPrecision(4, 3);
        });

        modelBuilder.Entity<EnemyDropPool>(entity =>
        {
            entity.ToTable("enemy_drop_pool", t =>
                // Same reasoning as ck_enemy_move_ai_weight: this weight feeds a weighted pick, so
                // 0 removes the entry from the pool entirely rather than making it rare. An enemy
                // with no pool rows at all is fine and meaningful (enemy_waystone_wisp falls back
                // to the generic pool, which is how fixtures §3's "Drops: None" needs no special
                // case) — a row that exists but cannot be drawn is not.
                t.HasCheckConstraint("ck_enemy_drop_pool_weight", "weight > 0"));

            entity.HasKey(e => new { e.EnemyId, e.EncounterKind, e.ItemDefId });
            entity.Property(e => e.Weight).HasDefaultValue(1);

            entity.HasOne(e => e.Enemy).WithMany(e => e.DropPool)
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.ItemDef).WithMany()
                .HasForeignKey(e => e.ItemDefId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<StreakMilestone>(entity =>
        {
            // Trinket and Divine are excluded structurally, not by remembering GDD 11 §5.1.
            entity.ToTable("streak_milestone", t =>
            {
                t.HasCheckConstraint("ck_streak_milestone_slot",
                    Check.In("slot", GearSlot.Weapon, GearSlot.Armor, GearSlot.Accessory));
                t.HasCheckConstraint("ck_streak_milestone_tier",
                    Check.In("tier", GearTier.Mortal, GearTier.Heroic, GearTier.Mythic));
            });

            entity.HasKey(e => e.Day);
            entity.Property(e => e.Day).ValueGeneratedNever();
        });

        modelBuilder.Entity<LevelMilestone>(entity =>
        {
            entity.ToTable("level_milestone", t =>
                t.HasCheckConstraint("ck_level_milestone_reward_kind", Check.In<MilestoneRewardKind>("reward_kind")));

            entity.HasKey(e => new { e.Level, e.RewardKind });

            entity.HasOne(e => e.ItemDef).WithMany()
                .HasForeignKey(e => e.ItemDefId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<XpCurve>(entity =>
        {
            entity.ToTable("xp_curve", t =>
                t.HasCheckConstraint("ck_xp_curve_level", "level between 1 and 60"));

            entity.HasKey(e => e.Level);
            entity.Property(e => e.Level).ValueGeneratedNever();
        });
    }
}
