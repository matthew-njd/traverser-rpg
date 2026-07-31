namespace Traverser.Api.Data.Entities;

/// <summary>
/// 8 rows at days 3, 7, 14, 25, 40, 60, 90, 120 (fixtures §7).
/// <para>
/// The CHECK constraints on <see cref="Slot"/> and <see cref="Tier"/> exclude Trinket and Divine
/// structurally — GDD 11 §5.1's rule that a streak can never grant either is enforced by the
/// schema rather than by remembering it.
/// </para>
/// </summary>
public class StreakMilestone
{
    public int Day { get; set; }

    /// <summary>Weapon, Armor, or Accessory. Never Trinket.</summary>
    public GearSlot Slot { get; set; }

    /// <summary>Mortal, Heroic, or Mythic. Never Divine.</summary>
    public GearTier Tier { get; set; }
}
