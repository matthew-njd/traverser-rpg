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

    public Enemy Enemy { get; set; } = null!;

    public GameType? Type { get; set; }
}
