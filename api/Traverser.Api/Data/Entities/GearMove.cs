namespace Traverser.Api.Data.Entities;

/// <summary>
/// The 6 Trinket-granted moves (GDD 8 §4.3; narrowed to the Trinket slot only by DECISIONS 2026-07-26).
/// <para>
/// The manifest's reverse mapping (`source_gear_id`) is deliberately absent: tech-01 §3 and
/// DECISIONS 2026-07-25 settled the mutual reference in favour of a single direction,
/// <see cref="GearDef.GrantsMoveId"/>. The reverse is a lookup, not a stored column.
/// </para>
/// </summary>
public class GearMove
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string TypeId { get; set; } = null!;

    public int Power { get; set; }

    public int Uses { get; set; }

    public MoveEffect? Effect { get; set; }

    public GameType Type { get; set; } = null!;
}
