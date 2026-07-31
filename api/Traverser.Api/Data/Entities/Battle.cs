namespace Traverser.Api.Data.Entities;

/// <summary>
/// A resolved battle. The engine runs client-side, so results arrive as sync payloads and
/// <see cref="ClientBattleId"/> gives them the same replay safety as <see cref="SyncDelta"/> —
/// drops, bestiary counters, and Vigor are all applied only for newly-inserted rows (T2 §4 step 2).
/// </summary>
public class Battle
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    /// <summary>Minted at battle start under the same never-derive-from-content rule as
    /// <see cref="SyncDelta.ClientDeltaId"/>, so a resumed battle keeps the ID it began with.</summary>
    public Guid ClientBattleId { get; set; }

    public string EnemyId { get; set; } = null!;

    public BattleEncounterKind EncounterKind { get; set; }

    /// <summary>
    /// Equals the player's level at encounter time and is recorded as history — the player's level
    /// moves on, this does not.
    /// </summary>
    public int EnemyLevel { get; set; }

    public BattleOutcome Outcome { get; set; }

    /// <summary>A loss awards 0 with no penalty (GDD 1 §2.3).</summary>
    public int XpAwarded { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime EndedAt { get; set; }

    public Player Player { get; set; } = null!;

    public Enemy Enemy { get; set; } = null!;
}
