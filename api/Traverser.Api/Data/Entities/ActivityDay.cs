namespace Traverser.Api.Data.Entities;

/// <summary>
/// The queryable daily rollup — one row per player-local calendar date. Everything downstream reads
/// this; <see cref="SyncDelta"/> is the append-only ledger that produced it.
/// </summary>
public class ActivityDay
{
    public Guid PlayerId { get; set; }

    /// <summary>
    /// A *local* calendar date, always supplied by the client (T2 §2) — the client owns the
    /// local-midnight boundary because it owns the live timezone. Deliberately `date`, not an instant.
    /// </summary>
    public DateOnly ActivityDate { get; set; }

    public int Steps { get; set; }

    public int Tier1Minutes { get; set; }

    public int Tier2Minutes { get; set; }

    public int Tier3Minutes { get; set; }

    public int XpAwarded { get; set; }

    /// <summary>
    /// The goal in force *that day*, captured on insert and never updated. Without it, raising the
    /// goal would retroactively un-hit past days and break a streak that was legitimately earned.
    /// </summary>
    public int StepGoalSnapshot { get; set; }

    public bool GoalMet { get; set; }

    /// <summary>
    /// The whole grace system. GDD 11 §3.2's cap of 3 auto-credits per rolling 30 days is a COUNT
    /// over this column — no separate counter table, nothing to keep consistent.
    /// <para>
    /// Null on a past date is a break (GDD 11 §3.3), and that is all it is: there is no "streak
    /// lost" flag and no notification queue, matching the non-punitive rule.
    /// </para>
    /// </summary>
    public StreakCreditMethod? StreakCreditMethod { get; set; }

    public DateTime? RestTaggedAt { get; set; }

    /// <summary>GDD 9 §5.3's hard cap of 5/day, resetting for free because the row is per local date.</summary>
    public int EncountersUsed { get; set; }

    public DateTime? DailyItemClaimedAt { get; set; }

    public bool DailyGearRolled { get; set; }

    public Player Player { get; set; } = null!;
}
