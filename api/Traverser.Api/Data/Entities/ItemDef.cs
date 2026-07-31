namespace Traverser.Api.Data.Entities;

/// <summary>The 18 battle items (GDD 4 §2).</summary>
public class ItemDef
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public ItemCategory Category { get; set; }

    public ItemRarity Rarity { get; set; }

    /// <summary>Surge and Breach charms only.</summary>
    public string? TypeId { get; set; }

    /// <summary>Heals only: 20, 40, 100.</summary>
    public int? HealPct { get; set; }

    /// <summary>Buffs only.</summary>
    public MoveEffect? Effect { get; set; }

    /// <summary>
    /// The per-*type* acquisition cap from GDD 4 §5.1 (5 heal / 3 buff / 3 charm), enforced in
    /// application logic at acquisition. Not a stack size — slots hold single items.
    /// </summary>
    public int MaxStack { get; set; }

    /// <summary>False for the three heals, which are usable outside battle (GDD 4 §4).</summary>
    public bool BattleOnly { get; set; }

    public string Flavor { get; set; } = null!;

    public GameType? Type { get; set; }
}
