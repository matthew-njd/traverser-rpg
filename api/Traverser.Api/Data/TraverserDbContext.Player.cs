using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data;

/// <summary>
/// The player schema (tech-01 §4). Player-owned rows use <c>uuid</c> PKs — UUIDv7, so inserts stay
/// index-friendly — and cascade from <see cref="Entities.Player"/>. Derived values (Leagues,
/// effective stats, enemy stats at level, XP-to-next, gate state) are deliberately absent: only
/// *rolled* values and point-in-time snapshots are persisted.
/// </summary>
public partial class TraverserDbContext
{
    private static void ConfigurePlayer(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Player>(entity =>
        {
            entity.ToTable("player", t =>
            {
                t.HasCheckConstraint("ck_player_level", "level between 1 and 60");
                // GDD 11 §2.1's hard floor.
                t.HasCheckConstraint("ck_player_daily_step_goal", "daily_step_goal >= 3000");
            });

            entity.HasKey(e => e.Id);
            // Minted on-device at first launch (T2 §1.4).
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.Level).HasDefaultValue(1);
            entity.Property(e => e.XpCurrent).HasDefaultValue(0);
            entity.Property(e => e.XpLifetime).HasDefaultValue(0L);
            entity.Property(e => e.UnspentStatPoints).HasDefaultValue(0);
            entity.Property(e => e.AllocVigor).HasDefaultValue(0);
            entity.Property(e => e.AllocMight).HasDefaultValue(0);
            entity.Property(e => e.AllocResolve).HasDefaultValue(0);
            entity.Property(e => e.AllocFavor).HasDefaultValue(0);
            entity.Property(e => e.AllocAegis).HasDefaultValue(0);
            entity.Property(e => e.AllocStride).HasDefaultValue(0);
            entity.Property(e => e.LifetimeSteps).HasDefaultValue(0L);
            entity.Property(e => e.DailyStepGoal).HasDefaultValue(7000);
        });

        modelBuilder.Entity<PlayerSettings>(entity =>
        {
            entity.ToTable("player_settings");

            entity.HasKey(e => e.PlayerId);
            entity.Property(e => e.MusicVolume).HasPrecision(3, 2).HasDefaultValue(1.0m);
            entity.Property(e => e.SfxVolume).HasPrecision(3, 2).HasDefaultValue(1.0m);

            entity.HasOne(e => e.Player).WithOne()
                .HasForeignKey<PlayerSettings>(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerEquippedSkill>(entity =>
        {
            // The 1–4 range is the "max 4 equipped skills" rule.
            entity.ToTable("player_equipped_skill", t =>
                t.HasCheckConstraint("ck_player_equipped_skill_slot", "slot between 1 and 4"));

            entity.HasKey(e => new { e.PlayerId, e.Slot });
            entity.HasIndex(e => new { e.PlayerId, e.SkillId }).IsUnique();

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Skill).WithMany()
                .HasForeignKey(e => e.SkillId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<PlayerItem>(entity =>
        {
            entity.ToTable("player_item", t =>
                t.HasCheckConstraint("ck_player_item_source", Check.In<ItemSource>("source")));

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AcquiredAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.PlayerId, e.ItemDefId });

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ItemDef).WithMany()
                .HasForeignKey(e => e.ItemDefId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<PlayerGear>(entity =>
        {
            entity.ToTable("player_gear", t =>
                t.HasCheckConstraint("ck_player_gear_equipped_slot", Check.In<GearSlot>("equipped_slot")));

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AcquiredAt).HasDefaultValueSql("now()");

            // One item equipped per slot, true in the database rather than in a service method.
            entity.HasIndex(e => new { e.PlayerId, e.EquippedSlot })
                .IsUnique()
                .HasFilter("equipped_slot is not null");

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.GearDef).WithMany()
                .HasForeignKey(e => e.GearDefId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<ActivityDay>(entity =>
        {
            entity.ToTable("activity_day", t =>
            {
                t.HasCheckConstraint("ck_activity_day_streak_credit_method",
                    Check.In<StreakCreditMethod>("streak_credit_method"));
                // GDD 9 §5.3's hard cap.
                t.HasCheckConstraint("ck_activity_day_encounters_used", "encounters_used <= 5");
            });

            entity.HasKey(e => new { e.PlayerId, e.ActivityDate });
            entity.Property(e => e.Steps).HasDefaultValue(0);
            // The naming convention does not break a word at a digit boundary — `Tier1Minutes`
            // would become `tier1minutes`, not tech-01's `tier1_minutes`.
            entity.Property(e => e.Tier1Minutes).HasColumnName("tier1_minutes").HasDefaultValue(0);
            entity.Property(e => e.Tier2Minutes).HasColumnName("tier2_minutes").HasDefaultValue(0);
            entity.Property(e => e.Tier3Minutes).HasColumnName("tier3_minutes").HasDefaultValue(0);
            entity.Property(e => e.XpAwarded).HasDefaultValue(0);
            entity.Property(e => e.GoalMet).HasDefaultValue(false);
            entity.Property(e => e.EncountersUsed).HasDefaultValue(0);
            entity.Property(e => e.DailyGearRolled).HasDefaultValue(false);

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SyncDelta>(entity =>
        {
            entity.ToTable("sync_delta", t =>
            {
                t.HasCheckConstraint("ck_sync_delta_source", Check.In<SyncDeltaSource>("source"));
                t.HasCheckConstraint("ck_sync_delta_hr_tier", "hr_tier between 1 and 3");
            });

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.StepsDelta).HasDefaultValue(0);
            entity.Property(e => e.MinutesDelta).HasDefaultValue(0);
            entity.Property(e => e.XpDelta).HasDefaultValue(0);
            entity.Property(e => e.AppliedAt).HasDefaultValueSql("now()");

            // The entire idempotency mechanism (T2 §4 step 1).
            entity.HasIndex(e => new { e.PlayerId, e.ClientDeltaId }).IsUnique();
            entity.HasIndex(e => new { e.PlayerId, e.ActivityDate });

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HrSession>(entity =>
        {
            entity.ToTable("hr_session", t =>
                // GDD 9 §5.1's max 2 rolls per session.
                t.HasCheckConstraint("ck_hr_session_encounter_rolls_granted", "encounter_rolls_granted <= 2"));

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Tier1Minutes).HasColumnName("tier1_minutes").HasDefaultValue(0);
            entity.Property(e => e.Tier2Minutes).HasColumnName("tier2_minutes").HasDefaultValue(0);
            entity.Property(e => e.Tier3Minutes).HasColumnName("tier3_minutes").HasDefaultValue(0);
            entity.Property(e => e.EncounterRollsGranted).HasDefaultValue(0);

            // The upsert key for T2 §4 step 2 — session minutes are set, not added.
            entity.HasIndex(e => new { e.PlayerId, e.ExternalSessionId }).IsUnique();

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StreakState>(entity =>
        {
            entity.ToTable("streak_state");

            entity.HasKey(e => e.PlayerId);
            entity.Property(e => e.CurrentStreak).HasDefaultValue(0);
            entity.Property(e => e.LongestStreak).HasDefaultValue(0);

            entity.HasOne(e => e.Player).WithOne()
                .HasForeignKey<StreakState>(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Battle>(entity =>
        {
            entity.ToTable("battle", t =>
            {
                t.HasCheckConstraint("ck_battle_encounter_kind", Check.In<BattleEncounterKind>("encounter_kind"));
                t.HasCheckConstraint("ck_battle_outcome", Check.In<BattleOutcome>("outcome"));
            });

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.XpAwarded).HasDefaultValue(0);

            // Gives a replayed battle the same no-op guarantee as a replayed delta.
            entity.HasIndex(e => new { e.PlayerId, e.ClientBattleId }).IsUnique();

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Enemy).WithMany()
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<PlayerBestiary>(entity =>
        {
            entity.ToTable("player_bestiary");

            entity.HasKey(e => new { e.PlayerId, e.EnemyId });
            entity.Property(e => e.EncounterCount).HasDefaultValue(0);
            entity.Property(e => e.DefeatCount).HasDefaultValue(0);

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Enemy).WithMany()
                .HasForeignKey(e => e.EnemyId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<PlayerZoneProgress>(entity =>
        {
            entity.ToTable("player_zone_progress");

            entity.HasKey(e => new { e.PlayerId, e.ZoneId });
            entity.Property(e => e.UnlockedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Zone).WithMany()
                .HasForeignKey(e => e.ZoneId).OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<MilestoneGrant>(entity =>
        {
            entity.ToTable("milestone_grant", t =>
                t.HasCheckConstraint("ck_milestone_grant_milestone_kind", Check.In<MilestoneKind>("milestone_kind")));

            entity.HasKey(e => new { e.PlayerId, e.MilestoneKind, e.MilestoneKey });
            entity.Property(e => e.GrantedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.OverflowFallback).HasDefaultValue(false);

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PendingReward>(entity =>
        {
            entity.ToTable("pending_reward", t =>
            {
                t.HasCheckConstraint("ck_pending_reward_kind", Check.In<PendingRewardKind>("kind"));
                t.HasCheckConstraint("ck_pending_reward_resolution", Check.In<PendingRewardResolution>("resolution"));
            });

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Player).WithMany()
                .HasForeignKey(e => e.PlayerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ItemDef).WithMany()
                .HasForeignKey(e => e.ItemDefId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.GearDef).WithMany()
                .HasForeignKey(e => e.GearDefId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
