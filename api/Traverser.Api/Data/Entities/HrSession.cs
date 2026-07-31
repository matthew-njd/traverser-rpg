namespace Traverser.Api.Data.Entities;

/// <summary>
/// Sessions are first-class because two rules need session boundaries rather than daily totals: the
/// 90-cumulative-minute overactivity warning that fires at most once per session (GDD 11 §8.3), and
/// GDD 9 §5.1's one encounter roll per 15 continuous minutes, max 2 per session.
/// </summary>
public class HrSession
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    /// <summary>
    /// The dedupe key, unique per player. T3 segments sessions from the HR sample timeline rather
    /// than from Health Connect exercise records, so there is no provider-issued ID: this carries
    /// tech-01 §7's pre-authorised fallback encoded as <c>"hr:{started_at epoch seconds}"</c>
    /// (DECISIONS 2026-07-25). Tier minutes are **set, not added**, on re-observation (T2 §6.3),
    /// which only works while the same session keeps the same key.
    /// </summary>
    public string? ExternalSessionId { get; set; }

    public DateTime StartedAt { get; set; }

    /// <summary>Null while the session is still open.</summary>
    public DateTime? EndedAt { get; set; }

    public int Tier1Minutes { get; set; }

    public int Tier2Minutes { get; set; }

    public int Tier3Minutes { get; set; }

    /// <summary>The at-most-once flag for GDD 11 §8.3's warning.</summary>
    public DateTime? OveractivityWarnedAt { get; set; }

    /// <summary>Max 2, so a re-observed session cannot re-grant.</summary>
    public int EncounterRollsGranted { get; set; }

    public Player Player { get; set; } = null!;
}
