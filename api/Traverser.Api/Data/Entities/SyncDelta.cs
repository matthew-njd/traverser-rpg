namespace Traverser.Api.Data.Entities;

/// <summary>
/// Append-only record of every contribution that produced an <see cref="ActivityDay"/>.
/// <para>
/// **The unique constraint on (PlayerId, ClientDeltaId) is the entire idempotency mechanism**
/// (T2 §4 step 1): the client resends freely, <c>ON CONFLICT DO NOTHING</c> drops duplicates, and
/// the rollup is incremented only for rows that actually inserted. That is what makes the merge
/// additive-and-safe rather than last-write-wins.
/// </para>
/// <para>
/// This is an idempotency ledger, **not** an audit trail (tech-01 §6) — do not let it drift into one.
/// </para>
/// </summary>
public class SyncDelta
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    /// <summary>
    /// A UUIDv7 minted on-device when the delta is created and never regenerated on retry (T2 §5).
    /// Explicitly not a content hash — two legitimately identical deltas would collide and one
    /// would be silently dropped, losing real steps.
    /// </summary>
    public Guid ClientDeltaId { get; set; }

    public DateOnly ActivityDate { get; set; }

    public SyncDeltaSource Source { get; set; }

    public int StepsDelta { get; set; }

    public int MinutesDelta { get; set; }

    /// <summary>1–3; null when the delta carries no HR minutes.</summary>
    public int? HrTier { get; set; }

    public int XpDelta { get; set; }

    /// <summary>Device clock — when the activity happened.</summary>
    public DateTime RecordedAt { get; set; }

    public DateTime AppliedAt { get; set; }

    public Player Player { get; set; } = null!;
}
