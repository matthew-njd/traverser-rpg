namespace Traverser.Api.Data.Entities;

/// <summary>
/// Only entry to a *zone* is recorded. Gate state is derived: available at
/// <c>lifetime_steps / 1000 &gt;= zone_gate.league_threshold</c>, defeated at
/// <c>player_bestiary.defeat_count &gt; 0</c> for its enemy. `olympion` is inserted at profile creation.
/// </summary>
public class PlayerZoneProgress
{
    public Guid PlayerId { get; set; }

    public string ZoneId { get; set; } = null!;

    public DateTime UnlockedAt { get; set; }

    public Player Player { get; set; } = null!;

    public Zone Zone { get; set; } = null!;
}
