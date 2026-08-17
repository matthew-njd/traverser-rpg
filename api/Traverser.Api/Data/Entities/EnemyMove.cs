namespace Traverser.Api.Data.Entities;

/// <summary>
/// 28 rows. AI weights sum to 100 per enemy — asserted by a seed test, since a per-group CHECK
/// isn't expressible. `emove_savage_bite_cerberus` and `emove_savage_bite_fenrir` are separate rows
/// sharing a display name, exactly as the manifest specifies.
/// </summary>
public class EnemyMove
{
    public string Id { get; set; } = null!;

    public string EnemyId { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public MoveCategory Category { get; set; }

    /// <summary>Null for Physical moves.</summary>
    public string? TypeId { get; set; }

    public int Power { get; set; }

    public int AiWeight { get; set; }

    /// <summary>
    /// Position within this enemy's movepool, in the order the GDD's own move table lists them.
    /// <para>
    /// The AI's weighted scan runs in this order (T5 §5, amended 2026-08-17). It is a column rather
    /// than the primary key because the two orders differ: Cerberus's key order puts Death Breath
    /// first, and the cumulative boundaries T5 §11.6 pins (0.35, 0.80) only hold for the GDD's order.
    /// </para>
    /// </summary>
    public int Ordinal { get; set; }

    public Enemy Enemy { get; set; } = null!;

    public GameType? Type { get; set; }
}
