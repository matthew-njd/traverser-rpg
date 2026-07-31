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

    public Player Player { get; set; } = null!;
}
