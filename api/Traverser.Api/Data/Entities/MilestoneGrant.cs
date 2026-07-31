namespace Traverser.Api.Data.Entities;

/// <summary>
/// One row per one-time grant — the only permission slip for every deterministic reward (T2 §4 step 10).
/// Without it, a client that syncs twice across a level-up boundary grants the L30 Warhex twice.
/// <para>
/// Battle drops deliberately do *not* pass through here: <see cref="Battle.ClientBattleId"/> is
/// already their idempotency key, and a second ledger would give one event two sources of truth.
/// </para>
/// </summary>
public class MilestoneGrant
{
    public Guid PlayerId { get; set; }

    public MilestoneKind MilestoneKind { get; set; }

    /// <summary>'30', '120', 'valheon', … — scoped by <see cref="MilestoneKind"/>.</summary>
    public string MilestoneKey { get; set; } = null!;

    public DateTime GrantedAt { get; set; }

    /// <summary>
    /// GDD 11 §5.3's 2× Herald's Draft substitution, recorded when all three slots already exceed
    /// the milestone tier.
    /// </summary>
    public bool OverflowFallback { get; set; }

    public Player Player { get; set; } = null!;
}
