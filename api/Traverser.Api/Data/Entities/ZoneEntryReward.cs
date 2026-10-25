namespace Traverser.Api.Data.Entities;

/// <summary>
/// GDD 4 §6.3 — what first entry to a zone grants. Server-only content: the device learns of the
/// grant from the sync response, so this table is not in the bundle.
/// </summary>
public class ZoneEntryReward
{
    public string ZoneId { get; set; } = null!;

    public string ItemDefId { get; set; } = null!;

    public int Quantity { get; set; }

    public Zone Zone { get; set; } = null!;

    public ItemDef ItemDef { get; set; } = null!;
}
