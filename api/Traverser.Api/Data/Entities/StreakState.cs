namespace Traverser.Api.Data.Entities;

/// <summary>
/// Cached counters, derivable from <see cref="ActivityDay"/>, kept because the Character screen
/// reads them on every open.
/// </summary>
public class StreakState
{
    public Guid PlayerId { get; set; }

    public int CurrentStreak { get; set; }

    /// <summary>
    /// GDD 11 §4's permanent personal best — it never decreases, so a break erases the counter but
    /// not the record.
    /// </summary>
    public int LongestStreak { get; set; }

    public DateOnly? LastCreditedDate { get; set; }

    public Player Player { get; set; } = null!;
}
