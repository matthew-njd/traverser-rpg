namespace Traverser.Api.Data.Entities;

/// <summary>
/// One row per owned gear instance, with the equipped slot as a nullable column rather than a
/// separate table. A partial unique index on (player, equipped_slot) is what makes "one item
/// equipped per slot" true in the database rather than in a service method.
/// </summary>
public class PlayerGear
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid PlayerId { get; set; }

    public string GearDefId { get; set; } = null!;

    /// <summary>Stored purely so <see cref="BonusPrimary"/> can be re-derived for verification.</summary>
    public int LevelAtDrop { get; set; }

    /// <summary>
    /// **Frozen at drop time (GDD 8 §3.2) — persisted, never recomputed.** Might/Resolve/Vigor by
    /// slot, or Favor on a Trinket.
    /// </summary>
    public int BonusPrimary { get; set; }

    /// <summary>Aegis on a Trinket; null otherwise.</summary>
    public int? BonusSecondary { get; set; }

    /// <summary>Null = not equipped.</summary>
    public GearSlot? EquippedSlot { get; set; }

    public DateTime AcquiredAt { get; set; }

    public string Source { get; set; } = null!;

    public Player Player { get; set; } = null!;

    public GearDef GearDef { get; set; } = null!;
}
