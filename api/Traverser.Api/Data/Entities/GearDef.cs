namespace Traverser.Api.Data.Entities;

/// <summary>
/// 21 rows: 12 Weapon/Armor/Accessory (one tier ladder, zone-agnostic) + 9 zone-specific Trinkets.
/// <para>
/// There is no Stride-governing slot and no way to add one without a schema change — GDD 8 §3.1's
/// "Stride never receives gear bonuses" is enforced structurally here, not by convention.
/// </para>
/// </summary>
public class GearDef
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public GearSlot Slot { get; set; }

    public GearTier Tier { get; set; }

    /// <summary>Trinkets only; null for Weapon/Armor/Accessory.</summary>
    public string? ZoneId { get; set; }

    /// <summary>Mythic and Divine Trinkets only. Heroic Sigils grant no move.</summary>
    public string? GrantsMoveId { get; set; }

    public string? Flavor { get; set; }

    public Zone? Zone { get; set; }

    public GearMove? GrantsMove { get; set; }
}
