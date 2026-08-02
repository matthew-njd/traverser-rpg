namespace Traverser.Api.Data.Entities;

/// <summary>
/// Idempotency ledger for the additive or effectful progression writes (T2 §2) — allocations above
/// all, plus item discard, rest-day tagging, and Explore requests. The same mechanism as
/// <see cref="SyncDelta"/>'s unique constraint, for the endpoints that are not a sync: insert with
/// <c>ON CONFLICT DO NOTHING RETURNING *</c> and act only on returned rows.
/// <para>
/// **Zero rows means already-applied, which is a success, not an error** — the response is the
/// player's current state. No response body is stored: the mirror is repairable from
/// <c>GET /players/me</c> in one shot (T2 §7), so a cache would be a second copy of the truth.
/// </para>
/// </summary>
public class ClientOperation
{
    public Guid PlayerId { get; set; }

    /// <summary>Client-generated, per T2 §2 — minted once and never regenerated on retry.</summary>
    public Guid OperationId { get; set; }

    /// <summary>Diagnostics only; never switched on. Behaviour depending on this column would let
    /// a client change the outcome of a replay by relabelling it.</summary>
    public string Endpoint { get; set; } = null!;

    public DateTime AppliedAt { get; set; }

    public Player Player { get; set; } = null!;
}
