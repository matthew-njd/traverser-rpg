namespace Traverser.Api.Data.Entities;

/// <summary>
/// Two interleaved tracks, deliberately offset from each other (GDD 4 §6.3, GDD 8 §5.4): items at
/// 10/20/30/40/50/60, gear at 15/25/35/45/55. 11 rows.
/// </summary>
public class LevelMilestone
{
    public int Level { get; set; }

    public MilestoneRewardKind RewardKind { get; set; }

    /// <summary>Item track only.</summary>
    public string? ItemDefId { get; set; }

    /// <summary>Gear track only.</summary>
    public GearTier? GearTier { get; set; }

    public ItemDef? ItemDef { get; set; }
}
