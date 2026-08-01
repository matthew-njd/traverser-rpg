using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;
using Traverser.Api.Data.Seed;

namespace Traverser.Api.Data;

/// <summary>
/// The Traverser schema, per tech-01.
/// <para>
/// **`UseSnakeCaseNamingConvention()` must be configured on the options** (see Program.cs) before
/// the first migration is generated — tech-01 §2 and §7's M0 obligation. Without it EF creates
/// `PlayerItem`/`ItemDefId` columns and every hand-written query in the specs breaks. Table names
/// are additionally pinned explicitly, because EF names tables after the <c>DbSet</c> property and
/// would otherwise pluralise them.
/// </para>
/// </summary>
public partial class TraverserDbContext(DbContextOptions<TraverserDbContext> options) : DbContext(options)
{
    // Content — seeded, read-only at runtime. Together these are the client's content bundle.
    public DbSet<ContentVersion> ContentVersions => Set<ContentVersion>();
    public DbSet<GameType> GameTypes => Set<GameType>();
    public DbSet<TypeEffectiveness> TypeEffectiveness => Set<TypeEffectiveness>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<Enemy> Enemies => Set<Enemy>();
    public DbSet<EnemyStatScaling> EnemyStatScaling => Set<EnemyStatScaling>();
    public DbSet<EnemyMove> EnemyMoves => Set<EnemyMove>();
    public DbSet<PlayerSkillDef> PlayerSkillDefs => Set<PlayerSkillDef>();
    public DbSet<GearMove> GearMoves => Set<GearMove>();
    public DbSet<ItemDef> ItemDefs => Set<ItemDef>();
    public DbSet<GearDef> GearDefs => Set<GearDef>();
    public DbSet<GearTierBonus> GearTierBonuses => Set<GearTierBonus>();
    public DbSet<ZoneGate> ZoneGates => Set<ZoneGate>();
    public DbSet<DropRate> DropRates => Set<DropRate>();
    public DbSet<EnemyDropPool> EnemyDropPools => Set<EnemyDropPool>();
    public DbSet<StreakMilestone> StreakMilestones => Set<StreakMilestone>();
    public DbSet<LevelMilestone> LevelMilestones => Set<LevelMilestone>();
    public DbSet<XpCurve> XpCurve => Set<XpCurve>();

    // Player-owned.
    public DbSet<Player> Players => Set<Player>();
    public DbSet<PlayerSettings> PlayerSettings => Set<PlayerSettings>();
    public DbSet<PlayerEquippedSkill> PlayerEquippedSkills => Set<PlayerEquippedSkill>();
    public DbSet<PlayerItem> PlayerItems => Set<PlayerItem>();
    public DbSet<PlayerGear> PlayerGear => Set<PlayerGear>();
    public DbSet<ActivityDay> ActivityDays => Set<ActivityDay>();
    public DbSet<SyncDelta> SyncDeltas => Set<SyncDelta>();
    public DbSet<HrSession> HrSessions => Set<HrSession>();
    public DbSet<StreakState> StreakStates => Set<StreakState>();
    public DbSet<Battle> Battles => Set<Battle>();
    public DbSet<PlayerBestiary> PlayerBestiary => Set<PlayerBestiary>();
    public DbSet<PlayerZoneProgress> PlayerZoneProgress => Set<PlayerZoneProgress>();
    public DbSet<MilestoneGrant> MilestoneGrants => Set<MilestoneGrant>();
    public DbSet<PendingReward> PendingRewards => Set<PendingReward>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Every closed set is `text` + a CHECK, mapped through one converter (tech-01 §2).
        // Registering here covers the nullable variants too.
        configurationBuilder.Properties<MoveCategory>().HaveConversion<SnakeCaseEnumConverter<MoveCategory>>();
        configurationBuilder.Properties<MoveEffect>().HaveConversion<SnakeCaseEnumConverter<MoveEffect>>();
        configurationBuilder.Properties<ItemCategory>().HaveConversion<SnakeCaseEnumConverter<ItemCategory>>();
        configurationBuilder.Properties<ItemRarity>().HaveConversion<SnakeCaseEnumConverter<ItemRarity>>();
        configurationBuilder.Properties<GearSlot>().HaveConversion<SnakeCaseEnumConverter<GearSlot>>();
        configurationBuilder.Properties<GearTier>().HaveConversion<SnakeCaseEnumConverter<GearTier>>();
        configurationBuilder.Properties<StatKind>().HaveConversion<SnakeCaseEnumConverter<StatKind>>();
        configurationBuilder.Properties<EnemyRole>().HaveConversion<SnakeCaseEnumConverter<EnemyRole>>();
        configurationBuilder.Properties<GateKind>().HaveConversion<SnakeCaseEnumConverter<GateKind>>();
        configurationBuilder.Properties<DropEncounterKind>().HaveConversion<SnakeCaseEnumConverter<DropEncounterKind>>();
        configurationBuilder.Properties<DropRewardKind>().HaveConversion<SnakeCaseEnumConverter<DropRewardKind>>();
        configurationBuilder.Properties<MilestoneRewardKind>().HaveConversion<SnakeCaseEnumConverter<MilestoneRewardKind>>();
        configurationBuilder.Properties<BattleEncounterKind>().HaveConversion<SnakeCaseEnumConverter<BattleEncounterKind>>();
        configurationBuilder.Properties<BattleOutcome>().HaveConversion<SnakeCaseEnumConverter<BattleOutcome>>();
        configurationBuilder.Properties<ItemSource>().HaveConversion<SnakeCaseEnumConverter<ItemSource>>();
        configurationBuilder.Properties<StreakCreditMethod>().HaveConversion<SnakeCaseEnumConverter<StreakCreditMethod>>();
        configurationBuilder.Properties<SyncDeltaSource>().HaveConversion<SnakeCaseEnumConverter<SyncDeltaSource>>();
        configurationBuilder.Properties<MilestoneKind>().HaveConversion<SnakeCaseEnumConverter<MilestoneKind>>();
        configurationBuilder.Properties<PendingRewardKind>().HaveConversion<SnakeCaseEnumConverter<PendingRewardKind>>();
        configurationBuilder.Properties<PendingRewardResolution>().HaveConversion<SnakeCaseEnumConverter<PendingRewardResolution>>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureContent(modelBuilder);
        ConfigurePlayer(modelBuilder);

        // The content seed (tech-01 §5) — HasData, so every content change arrives as a reviewable
        // migration diff. Applied after configuration because HasData validates against the model.
        ContentSeed.Apply(modelBuilder);
    }
}
