namespace Traverser.Api.Data.Entities;

/// <summary>
/// One row per *physical* item — GDD 4 §5.1 is explicit that each of the 20 slots holds one
/// individual item, not a stack. No slot index is persisted: a UI grid position would add
/// gap-compaction logic to every add and discard for no gameplay benefit.
/// <para>
/// The 20-slot cap and the per-type <see cref="ItemDef.MaxStack"/> are enforced in application
/// logic at acquisition, not at use, because milestone grants deliberately bypass the cap and
/// route through <see cref="PendingReward"/> instead.
/// </para>
/// </summary>
public class PlayerItem
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    public string ItemDefId { get; set; } = null!;

    public DateTime AcquiredAt { get; set; }

    public ItemSource Source { get; set; }

    public Player Player { get; set; } = null!;

    public ItemDef ItemDef { get; set; } = null!;
}
