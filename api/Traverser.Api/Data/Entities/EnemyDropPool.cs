namespace Traverser.Api.Data.Entities;

/// <summary>
/// The per-enemy thematic item subsets from GDD 5–7, which take precedence over the generic common
/// pool. An enemy with no rows falls back to the generic pool; `enemy_waystone_wisp` deliberately
/// has none, which is how fixtures §3's "Drops: None" needs no special case in the engine.
/// </summary>
public class EnemyDropPool
{
    public string EnemyId { get; set; } = null!;

    public DropEncounterKind EncounterKind { get; set; }

    public string ItemDefId { get; set; } = null!;

    public int Weight { get; set; } = 1;

    public Enemy Enemy { get; set; } = null!;

    public ItemDef ItemDef { get; set; } = null!;
}
