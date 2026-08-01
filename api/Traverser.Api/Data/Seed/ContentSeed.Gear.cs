using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>
/// 21 gear rows (12 Weapon/Armor/Accessory + 9 Trinkets) and the 4 tier-bonus rows — GDD 8 §3.2,
/// §4.3, §5.2, §7.
/// </summary>
internal static partial class ContentSeed
{
    private static void SeedGear(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GearDef>().HasData(
            // Weapon/Armor/Accessory: one tier ladder, zone-agnostic, no move, no flavor text in the
            // GDD. Traveler's → Warden's → Paragon's → Ascendant's (GDD 8 §7). "Paragon's" rather than
            // "Champion's" to avoid colliding with the Champion's Surge skill.
            Wearable(Ids.Gear.WeaponMortal, "Traveler's Blade", GearSlot.Weapon, GearTier.Mortal),
            Wearable(Ids.Gear.WeaponHeroic, "Warden's Blade", GearSlot.Weapon, GearTier.Heroic),
            Wearable(Ids.Gear.WeaponMythic, "Paragon's Blade", GearSlot.Weapon, GearTier.Mythic),
            Wearable(Ids.Gear.WeaponDivine, "Ascendant's Blade", GearSlot.Weapon, GearTier.Divine),
            Wearable(Ids.Gear.ArmorMortal, "Traveler's Guard", GearSlot.Armor, GearTier.Mortal),
            Wearable(Ids.Gear.ArmorHeroic, "Warden's Guard", GearSlot.Armor, GearTier.Heroic),
            Wearable(Ids.Gear.ArmorMythic, "Paragon's Guard", GearSlot.Armor, GearTier.Mythic),
            Wearable(Ids.Gear.ArmorDivine, "Ascendant's Guard", GearSlot.Armor, GearTier.Divine),
            Wearable(Ids.Gear.AccessoryMortal, "Traveler's Band", GearSlot.Accessory, GearTier.Mortal),
            Wearable(Ids.Gear.AccessoryHeroic, "Warden's Band", GearSlot.Accessory, GearTier.Heroic),
            Wearable(Ids.Gear.AccessoryMythic, "Paragon's Band", GearSlot.Accessory, GearTier.Mythic),
            Wearable(Ids.Gear.AccessoryDivine, "Ascendant's Band", GearSlot.Accessory, GearTier.Divine),

            // Heroic Sigils — mini-boss drops, zone-flavored, and pointedly grant no move (GDD 8 §5.2).
            Trinket(Ids.Gear.SkyroadSigil, "Skyroad Sigil", GearTier.Heroic, Ids.Zone.Olympion, null,
                "A fragment of the road as it climbed toward Olympus."),
            Trinket(Ids.Gear.FrostroadSigil, "Frostroad Sigil", GearTier.Heroic, Ids.Zone.Valheon, null,
                "Carried the length of the road through Asgard's coldest stretch."),
            Trinket(Ids.Gear.SunroadSigil, "Sunroad Sigil", GearTier.Heroic, Ids.Zone.Imperion, null,
                "Warmed by every mile of the road through Rome's long noon."),

            // Mythic (zone boss repeat kill) and Divine (first kill) Trinkets — the only gear carrying
            // a move. GrantsMoveId is the single direction of the former mutual reference.
            Trinket(Ids.Gear.GatekeepersRuse, "Gatekeeper's Ruse", GearTier.Mythic, Ids.Zone.Olympion,
                Ids.GMove.GatekeepersRuse,
                "Slip past what should have stopped you. It worked once."),
            Trinket(Ids.Gear.GatekeepersSnare, "Gatekeeper's Snare", GearTier.Divine, Ids.Zone.Olympion,
                Ids.GMove.GatekeepersSnare,
                "The guardian's own trick, turned outward. Something is left marked."),
            Trinket(Ids.Gear.CoilbreakersOath, "Coilbreaker's Oath", GearTier.Mythic, Ids.Zone.Valheon,
                Ids.GMove.CoilbreakersOath,
                "You broke the coils that broke gods. Nothing mortal feels as dangerous again."),
            Trinket(Ids.Gear.CoilbreakersWrath, "Coilbreaker's Wrath", GearTier.Divine, Ids.Zone.Valheon,
                Ids.GMove.CoilbreakersWrath,
                "It struck once, at everything. It won't get to again."),
            Trinket(Ids.Gear.EmberwiseWard, "Emberwise Ward", GearTier.Mythic, Ids.Zone.Imperion,
                Ids.GMove.EmberwiseWard,
                "What the fire-giant never understood, you now carry."),
            Trinket(Ids.Gear.EmberwiseVerdict, "Emberwise Verdict", GearTier.Divine, Ids.Zone.Imperion,
                Ids.GMove.EmberwiseVerdict,
                "The fire's lesson, finally learned: guard yourself before you strike."));

        // Bonus at drop = `round(Rate × L) + Flat`, evaluated at the player's level when the piece
        // drops and never recalculated. A Trinket instead grants `round(TrinketSplit × that)` to BOTH
        // Favor and Aegis.
        //
        // The rounding is **banker's rounding** (MidpointRounding.ToEven, .NET's Math.Round default),
        // which is load-bearing rather than incidental: fixtures §5 requires Mortal at L10 to be 1
        // (round(0.5) → 0) and Divine at L42 to be 14 (round(10.5) → 10). JavaScript's Math.round
        // rounds those halves up and would produce 2 and 15 — see DECISIONS 2026-07-31.
        modelBuilder.Entity<GearTierBonus>().HasData(
            new GearTierBonus { Tier = GearTier.Mortal, Rate = 0.05m, Flat = 1, TrinketSplit = 0.60m },
            new GearTierBonus { Tier = GearTier.Heroic, Rate = 0.10m, Flat = 2, TrinketSplit = 0.60m },
            new GearTierBonus { Tier = GearTier.Mythic, Rate = 0.17m, Flat = 3, TrinketSplit = 0.60m },
            new GearTierBonus { Tier = GearTier.Divine, Rate = 0.25m, Flat = 4, TrinketSplit = 0.60m });
    }

    private static GearDef Wearable(string id, string displayName, GearSlot slot, GearTier tier) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Slot = slot,
            Tier = tier,
            ZoneId = null,
            GrantsMoveId = null,
            Flavor = null,
        };

    private static GearDef Trinket(
        string id, string displayName, GearTier tier, string zoneId, string? grantsMoveId, string flavor) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Slot = GearSlot.Trinket,
            Tier = tier,
            ZoneId = zoneId,
            GrantsMoveId = grantsMoveId,
            Flavor = flavor,
        };
}
