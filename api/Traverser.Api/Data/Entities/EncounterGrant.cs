namespace Traverser.Api.Data.Entities;

/// <summary>
/// T2 §1.3's offline-battle seam: sync does not deliver battles, it delivers grants — zone and
/// enemy already resolved server-side, already charged against
/// <see cref="ActivityDay.EncountersUsed"/> — and the client spends them whenever, online or not.
/// <para>
/// **"Spent" is derived, never stored** — a grant is spent iff a <see cref="Battle"/> row
/// references it, and the partial unique index on <c>battle.grant_id</c> makes double-spend
/// structurally impossible. An abandoned battle (T5 §8.1) writes no battle row, so its grant stays
/// unspent by derivation.
/// </para>
/// </summary>
public class EncounterGrant
{
    /// <summary><c>grant_id</c> on the wire.</summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    public string ZoneId { get; set; } = null!;

    public string EnemyId { get; set; } = null!;

    /// <summary>GDD 9 §5.1's three trigger sources. Recorded because the 5/day cap counts all
    /// three against one pool but only Explore is player-initiated.</summary>
    public EncounterGrantSource Source { get; set; }

    /// <summary>The day this grant was charged against <c>encounters_used</c>. The composite FK to
    /// <see cref="ActivityDay"/> stops a grant existing on a day that was never charged;
    /// <c>encounters_used</c> stays the authoritative counter for GDD 9 §5.3's cap.</summary>
    public DateOnly ActivityDate { get; set; }

    public DateTime IssuedAt { get; set; }

    public Player Player { get; set; } = null!;

    public Zone Zone { get; set; } = null!;

    public Enemy Enemy { get; set; } = null!;

    public ActivityDay ActivityDay { get; set; } = null!;
}
