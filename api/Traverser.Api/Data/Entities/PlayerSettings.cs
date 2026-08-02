namespace Traverser.Api.Data.Entities;

/// <summary>
/// Split from <see cref="Player"/> so UI preference writes never contend with progression writes
/// during a sync transaction. Last-write-wins by design (T2 §6.3).
/// </summary>
public class PlayerSettings
{
    public Guid PlayerId { get; set; }

    /// <summary>Null = off. A fixed-time local notification; nothing here schedules a push.</summary>
    public TimeOnly? DailyReminderTime { get; set; }

    public decimal MusicVolume { get; set; } = 1.0m;

    public decimal SfxVolume { get; set; } = 1.0m;

    /// <summary>
    /// For HRmax = 220 − age (GDD 1 §2.2), collected at onboarding Screen 3 (T3 §1.4). Null means
    /// *not yet collected* — HR tier thresholds cannot be derived and tier minutes are not charged,
    /// which is the correct behaviour rather than a silent default age; Step XP is unaffected.
    /// Changing it re-derives thresholds for future reads only — no past day is ever recomputed.
    /// </summary>
    public int? BirthYear { get; set; }

    public Player Player { get; set; } = null!;
}
