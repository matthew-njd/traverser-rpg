namespace Traverser.Api.Data.Entities;

/// <summary>
/// 6 rows (GDD 9 §3, thresholds per fixtures §8). Both halves of the dual unlock condition live
/// here: <see cref="LeagueThreshold"/> against the Waymarker, and <see cref="UnlocksZoneId"/>
/// requiring this gate's boss defeated. Gate *state* is derived, never stored.
/// </summary>
public class ZoneGate
{
    public string Id { get; set; } = null!;

    public string ZoneId { get; set; } = null!;

    public string EnemyId { get; set; } = null!;

    public GateKind GateKind { get; set; }

    public int LeagueThreshold { get; set; }

    /// <summary>Final bosses only.</summary>
    public string? UnlocksZoneId { get; set; }

    /// <summary>False = mid-boss, which is soft and walkable past.</summary>
    public bool IsHardGate { get; set; }

    public Zone Zone { get; set; } = null!;

    public Enemy Enemy { get; set; } = null!;

    public Zone? UnlocksZone { get; set; }
}
