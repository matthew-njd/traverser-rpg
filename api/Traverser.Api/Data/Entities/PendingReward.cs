namespace Traverser.Api.Data.Entities;

/// <summary>
/// Backs the two flows that need a reward to survive the app closing mid-prompt: the "road find"
/// daily-goal item collected on next open (GDD 4 §6.2), and the keep/discard overflow prompt when
/// inventory is full (GDD 4 §5.2, GDD 8 §5.5).
/// <para>
/// The rolled gear bonus is captured here at creation so a reward accepted three days later isn't
/// silently re-rolled at a higher level.
/// </para>
/// </summary>
public class PendingReward
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    public PendingRewardKind Kind { get; set; }

    public string? ItemDefId { get; set; }

    public string? GearDefId { get; set; }

    public int? LevelAtDrop { get; set; }

    public int? BonusPrimary { get; set; }

    public int? BonusSecondary { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Once set, a replayed resolution returns the existing outcome (T2 §3).</summary>
    public DateTime? ResolvedAt { get; set; }

    public PendingRewardResolution? Resolution { get; set; }

    public Player Player { get; set; } = null!;

    public ItemDef? ItemDef { get; set; }

    public GearDef? GearDef { get; set; }
}
