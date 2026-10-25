namespace Traverser.Api.Data.Entities;

/// <summary>13 enemies (12 canon + the tutorial Waystone Wisp), keyed by manifest ID.</summary>
public class Enemy
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    /// <summary>Null for `enemy_waystone_wisp`, which belongs to no zone.</summary>
    public string? ZoneId { get; set; }

    /// <summary>Null for `enemy_waystone_wisp`, which is typeless.</summary>
    public string? TypeId { get; set; }

    public EnemyRole Role { get; set; }

    /// <summary>GDD 12 §8. Wild enemies only.</summary>
    public string? Flavor { get; set; }

    /// <summary>GDD 12 §5–7, bosses only. Each beat's lines are separated by a newline.</summary>
    public string? Intro { get; set; }

    public string? DefeatFirst { get; set; }

    public string? DefeatRepeat { get; set; }

    public Zone? Zone { get; set; }

    public GameType? Type { get; set; }

    public ICollection<EnemyStatScaling> StatScaling { get; set; } = [];

    public ICollection<EnemyMove> Moves { get; set; } = [];

    public ICollection<EnemyDropPool> DropPool { get; set; } = [];
}
