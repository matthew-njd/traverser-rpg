namespace Traverser.Api.Data.Entities;

/// <summary>
/// The guest profile. Keyed by <c>uuid</c> rather than being a singleton, so adding real accounts
/// later is purely additive (`auth_identity`) — but per the sanctioned trim there are no auth
/// columns, no email, and no provider IDs here.
/// </summary>
public class Player
{
    /// <summary>Client-minted at first launch (T2 §1.4) — never generated server-side.</summary>
    public Guid Id { get; set; }

    public string TraverserName { get; set; } = null!;

    /// <summary>IANA zone, e.g. America/New_York. Derives the local calendar date used by
    /// <see cref="ActivityDay.ActivityDate"/> (GDD 11 §2.2's local-midnight rollover).</summary>
    public string Timezone { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public int Level { get; set; } = 1;

    /// <summary>Progress toward the next level. Never banked past 60.</summary>
    public int XpCurrent { get; set; }

    public long XpLifetime { get; set; }

    public int UnspentStatPoints { get; set; }

    // Allocated points only. Effective stat = L1 base (Vigor 20, others 10) + allocation +
    // equipped gear. The base values stay code constants so a rebalance is a deploy, not a data
    // migration, and effective stats are computed rather than stored (tech-01 §2).

    public int AllocVigor { get; set; }

    public int AllocMight { get; set; }

    public int AllocResolve { get; set; }

    public int AllocFavor { get; set; }

    public int AllocAegis { get; set; }

    /// <summary>Allocation only — Stride never receives gear bonuses (GDD 8 §3.1).</summary>
    public int AllocStride { get; set; }

    public int VigorCurrent { get; set; }

    /// <summary>
    /// The point regen was last settled from. Vigor regen (1% per 10 min) is computed lazily from
    /// this on read and settled on write — no background job, which fits the sync-on-open-only
    /// architecture.
    /// </summary>
    public DateTime VigorAnchorAt { get; set; }

    /// <summary>
    /// **This is the Waymarker.** Leagues are <c>LifetimeSteps / 1000</c>, derived on read
    /// (GDD 9 §2.1) — storing them would create two numbers that can disagree.
    /// </summary>
    public long LifetimeSteps { get; set; }

    /// <summary>Hard floor of 3,000 per GDD 11 §2.1, enforced by CHECK.</summary>
    public int DailyStepGoal { get; set; } = 7000;

    public DateTime? TutorialCompletedAt { get; set; }
}
