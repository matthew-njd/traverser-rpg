namespace Traverser.Api.Data.Entities;

/// <summary>
/// The rate *structure* — the three independent dice per encounter (GDD 4 §6.1, GDD 8 §5.1–§5.3).
/// The client rolls these and the server records the result (DECISIONS 2026-07-26, T5 §1.6).
/// </summary>
public class DropRate
{
    public DropEncounterKind EncounterKind { get; set; }

    public DropRewardKind RewardKind { get; set; }

    /// <summary>0.35, 0.20, 1.000 …</summary>
    public decimal Chance { get; set; }

    public int QtyMin { get; set; }

    public int QtyMax { get; set; }

    /// <summary>The gear/trinket tier granted; null for items.</summary>
    public GearTier? Tier { get; set; }
}
