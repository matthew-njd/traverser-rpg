namespace Traverser.Api.Data.Entities;

/// <summary>
/// The 10 level-unlocked player skills (GDD 3). *Unlocked* skills are never stored per player —
/// they are derivable from <c>player.level &gt;= unlock_level</c>, so there is nothing to keep in sync.
/// </summary>
public class PlayerSkillDef
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public MoveCategory Category { get; set; }

    /// <summary>Null for Physical skills.</summary>
    public string? TypeId { get; set; }

    public int Power { get; set; }

    /// <summary>Null = unlimited, which is `skill_basic_attack` and nothing else.</summary>
    public int? Uses { get; set; }

    /// <summary>1 for the basic attack.</summary>
    public int UnlockLevel { get; set; }

    public GameType? Type { get; set; }
}
