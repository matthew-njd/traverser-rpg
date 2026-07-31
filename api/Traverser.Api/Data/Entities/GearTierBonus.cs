namespace Traverser.Api.Data.Entities;

/// <summary>
/// 4 rows (GDD 8 §3.2). Bonus at drop = <c>round(Rate × L) + Flat</c>; a Trinket instead grants
/// <c>round(TrinketSplit × that)</c> to **both** Favor and Aegis.
/// </summary>
public class GearTierBonus
{
    public GearTier Tier { get; set; }

    /// <summary>0.05 / 0.10 / 0.17 / 0.25.</summary>
    public decimal Rate { get; set; }

    /// <summary>1 / 2 / 3 / 4.</summary>
    public int Flat { get; set; }

    /// <summary>0.60 at all tiers.</summary>
    public decimal TrinketSplit { get; set; }
}
