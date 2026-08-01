using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>The 18 battle items (GDD 4 §2, manifest §Battle Items).</summary>
internal static partial class ContentSeed
{
    private static void SeedItems(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<ItemDef>().HasData(
            // Healing — the only items usable outside battle (GDD 4 §4), hence BattleOnly = false.
            // Percentages of *max* Vigor, so they stay relevant at every level without a rebalance.
            Heal(Ids.Item.TravelersSalve, "Traveler's Salve", ItemRarity.Common, healPct: 20, maxStack: 5,
                "Found along every old road. Mixed from whatever grows near the path."),
            Heal(Ids.Item.HeraldsDraft, "Herald's Draft", ItemRarity.Uncommon, healPct: 40, maxStack: 3,
                "What gods' messengers drink between realms. Enough remains for mortals."),
            Heal(Ids.Item.AmbrosiaShard, "Ambrosia Shard", ItemRarity.Rare, healPct: 100, maxStack: 2,
                "A fragment of something that shouldn't exist in the mortal world. Use it carefully."),

            // Buffs — same effect vocabulary as the Trinket moves. Rend is deliberately absent: the
            // Type Charms below already fill the "set up amplified damage" role (GDD 4 §2.2).
            Buff(Ids.Item.IronhideTincture, "Ironhide Tincture", ItemRarity.Uncommon, MoveEffect.Fortify, maxStack: 3,
                "Rubbed into the skin before a battle that might hurt. Usually does."),
            Buff(Ids.Item.SunderOil, "Sunder Oil", ItemRarity.Uncommon, MoveEffect.Weaken, maxStack: 3,
                "Coats a weapon or hand. The next blow it lands will land soft."),
            Buff(Ids.Item.FleetOmen, "Fleet Omen", ItemRarity.Rare, MoveEffect.Swift, maxStack: 2,
                "The tingling sense that you're about to move very quickly. Follow it."),

            // Surge — the player's next typed move deals ×1.5, applied before the type multiplier.
            Charm(Ids.Item.Stormveil, "Stormveil", ItemCategory.Surge, ItemRarity.Common, Ids.Type.Storm,
                "Charge the air around your next strike. Something vast will answer."),
            Charm(Ids.Item.Battlebrand, "Battlebrand", ItemCategory.Surge, ItemRarity.Common, Ids.Type.War,
                "Mark yourself for war. The next blow strikes with a conqueror's weight."),
            Charm(Ids.Item.Shadowblur, "Shadowblur", ItemCategory.Surge, ItemRarity.Common, Ids.Type.Trickery,
                "Blur the line between you and shadow. Your next move blurs with it."),
            Charm(Ids.Item.PaleAsh, "Pale Ash", ItemCategory.Surge, ItemRarity.Common, Ids.Type.Underworld,
                "Ash from the cold dark below. Your next strike carries its chill."),
            Charm(Ids.Item.Brinestone, "Brinestone", ItemCategory.Surge, ItemRarity.Common, Ids.Type.Sea,
                "A sea-smoothed stone, still damp. The depths speak through it."),
            Charm(Ids.Item.Clearsight, "Clearsight", ItemCategory.Surge, ItemRarity.Common, Ids.Type.Wisdom,
                "Clarity you hold for a moment. Long enough for one precise strike."),

            // Breach — forces the next hit of that type to ×2.0, overriding the chart. Cannot stack
            // past ×2.0, so it is wasted on an enemy already weak to the type.
            Charm(Ids.Item.Thundercrack, "Thundercrack", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.Storm,
                "Pressed to the enemy's path. The sky's wrath will find them."),
            Charm(Ids.Item.Warhex, "Warhex", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.War,
                "A battlefield curse. Whatever hits them next will hit them harder."),
            Charm(Ids.Item.Shadowbind, "Shadowbind", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.Trickery,
                "Their senses blur. They won't see the strike they should have."),
            Charm(Ids.Item.Gravemark, "Gravemark", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.Underworld,
                "The mark of the cold dark. It opens what should have stayed closed."),
            Charm(Ids.Item.Undertow, "Undertow", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.Sea,
                "Set loose in the current beneath them. The tide will pull them down."),
            Charm(Ids.Item.Blindveil, "Blindveil", ItemCategory.Breach, ItemRarity.Uncommon, Ids.Type.Wisdom,
                "A veil over their sight. What follows passes through unimpeded."));

    private static ItemDef Heal(
        string id, string displayName, ItemRarity rarity, int healPct, int maxStack, string flavor) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Category = ItemCategory.Heal,
            Rarity = rarity,
            TypeId = null,
            HealPct = healPct,
            Effect = null,
            MaxStack = maxStack,
            BattleOnly = false,
            Flavor = flavor,
        };

    private static ItemDef Buff(
        string id, string displayName, ItemRarity rarity, MoveEffect effect, int maxStack, string flavor) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Category = ItemCategory.Buff,
            Rarity = rarity,
            TypeId = null,
            HealPct = null,
            Effect = effect,
            MaxStack = maxStack,
            BattleOnly = true,
            Flavor = flavor,
        };

    /// <summary>Surge and Breach charms — both battle-only, both capped at 3 per type (GDD 4 §5.1).</summary>
    private static ItemDef Charm(
        string id, string displayName, ItemCategory category, ItemRarity rarity, string typeId, string flavor) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Category = category,
            Rarity = rarity,
            TypeId = typeId,
            HealPct = null,
            Effect = null,
            MaxStack = 3,
            BattleOnly = true,
            Flavor = flavor,
        };
}
