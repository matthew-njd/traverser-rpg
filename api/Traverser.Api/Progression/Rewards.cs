using Traverser.Api.Data;

namespace Traverser.Api.Progression;

/// <summary>The pure halves of T2 §4 step 10, kept apart from the database so the rules can be tested.</summary>
public static class Rewards
{
    /// <summary>GDD 4 §5.1 and GDD 8 §5.5. A reward past either parks as a <c>pending_reward</c>.</summary>
    public const int ItemCap = 20;
    public const int GearCap = 12;

    /// <summary>
    /// GDD 11 §5.3's fallback when every slot is already Mythic: 2× Herald's Draft. The one content id
    /// a rule names outright, because the GDD fixes it rather than a table.
    /// </summary>
    public const string FallbackItemId = "item_heralds_draft";
    public const int FallbackDrafts = 2;

    /// <summary>The streak ladder's slots, in the order a tie is broken.</summary>
    private static readonly GearSlot[] StatSlots = [GearSlot.Weapon, GearSlot.Armor, GearSlot.Accessory];

    /// <summary>
    /// GDD 8 §3.2 — <c>round(rate × L) + flat</c>, frozen at grant time.
    /// <para>
    /// ↯ Halves round to even, and fixtures §5 depends on it: Mortal at L10 is <c>round(0.5)</c> → 0,
    /// bonus 1. Away-from-zero breaks four reference cells. The client's drop roll uses the same rule
    /// through its own helper, never <c>Math.round</c> (DECISIONS 2026-08-01).
    /// </para>
    /// </summary>
    public static int GearBonus(decimal rate, int flat, int level) =>
        (int)Math.Round(rate * level, MidpointRounding.ToEven) + flat;

    /// <summary>
    /// GDD 11 §5.3 as amended 2026-10-25 (fixtures §7). <paramref name="owned"/> is the highest tier
    /// owned per slot, worn or held; a slot owning nothing is absent. Null means the fallback.
    /// </summary>
    public static (GearSlot Slot, GearTier Tier)? StreakTarget(
        GearSlot slot,
        GearTier tier,
        IReadOnlyDictionary<GearSlot, GearTier> owned)
    {
        if (!owned.TryGetValue(slot, out var current) || current < tier)
        {
            return (slot, tier);
        }

        if (current < GearTier.Mythic)
        {
            return (slot, current + 1);
        }

        // The named slot is maxed: the lowest other slot below Mythic takes the upgrade.
        var others = StatSlots
            .Where(s => s != slot && (!owned.TryGetValue(s, out var t) || t < GearTier.Mythic))
            .OrderBy(s => owned.TryGetValue(s, out var t) ? (int)t : -1)
            .ToList();

        if (others.Count == 0)
        {
            return null;
        }

        var target = others[0];

        return (target, owned.TryGetValue(target, out var held) ? held + 1 : GearTier.Mortal);
    }
}
