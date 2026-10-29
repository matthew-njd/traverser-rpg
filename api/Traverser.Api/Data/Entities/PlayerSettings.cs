namespace Traverser.Api.Data.Entities;

/// <summary>
/// Split from <see cref="Player"/> so UI preference writes never contend with progression writes
/// during a sync transaction. Last-write-wins by design (T2 §6.3).
/// </summary>
public class PlayerSettings
{
    public Guid PlayerId { get; set; }

    /// <summary>
    /// The Daily Nudge's hour, chosen in Settings. Null means never chosen, which is 19:00 (GDD 11
    /// §7.1). The device schedules it locally; nothing here sends a push.
    /// </summary>
    public TimeOnly? DailyReminderTime { get; set; }

    public decimal MusicVolume { get; set; } = 1.0m;

    public decimal SfxVolume { get; set; } = 1.0m;

    /// <summary>GDD 13 §7's Mute All. The volumes stay as they were, so unmuting restores them.</summary>
    public bool AudioMuted { get; set; }

    /// <summary>
    /// For HRmax = 220 − age (GDD 1 §2.2), collected at onboarding Screen 3 (T3 §1.4). Null means
    /// *not yet collected* — HR tier thresholds cannot be derived and tier minutes are not charged,
    /// which is the correct behaviour rather than a silent default age; Step XP is unaffected.
    /// Changing it re-derives thresholds for future reads only — no past day is ever recomputed.
    /// </summary>
    public int? BirthYear { get; set; }

    public Player Player { get; set; } = null!;
}
