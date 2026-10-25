using Traverser.Api.Data;
using Traverser.Api.Progression;

namespace Traverser.Tests.Progression;

/// <summary>T2 §4 step 10's pure rules: the frozen gear bonus, and GDD 11 §5.3's overlap rule.</summary>
public class RewardRuleTests
{
    /// <summary>
    /// fixtures §5, including the three half-way cells. Away-from-zero rounding passes the other
    /// cells and fails exactly these.
    /// </summary>
    [Theory]
    [InlineData(0.05, 1, 10, 1)]  // Mortal L10: round(0.5) → 0
    [InlineData(0.10, 2, 15, 4)]  // Heroic L15: round(1.5) → 2
    [InlineData(0.25, 4, 42, 14)] // Divine L42: round(10.5) → 10
    [InlineData(0.17, 3, 60, 13)] // Mythic L60
    public void Gear_bonus_matches_fixtures_5(double rate, int flat, int level, int expected) =>
        Assert.Equal(expected, Rewards.GearBonus((decimal)rate, flat, level));

    private static Dictionary<GearSlot, GearTier> Owned(params (GearSlot, GearTier)[] slots) =>
        slots.ToDictionary(s => s.Item1, s => s.Item2);

    [Fact]
    public void A_slot_below_the_milestone_tier_gets_that_tier()
    {
        // Day 3: Armor → Mortal, with only the starter Blade owned.
        Assert.Equal(
            (GearSlot.Armor, GearTier.Mortal),
            Rewards.StreakTarget(GearSlot.Armor, GearTier.Mortal, Owned((GearSlot.Weapon, GearTier.Mortal))));
    }

    /// <summary>fixtures §7's amended worked case: Day 14 with three Heroic slots is a Mythic Weapon.</summary>
    [Fact]
    public void A_slot_at_the_milestone_tier_skips_to_its_next_tier()
    {
        var owned = Owned(
            (GearSlot.Weapon, GearTier.Heroic), (GearSlot.Armor, GearTier.Heroic), (GearSlot.Accessory, GearTier.Heroic));

        Assert.Equal((GearSlot.Weapon, GearTier.Mythic), Rewards.StreakTarget(GearSlot.Weapon, GearTier.Heroic, owned));
    }

    [Fact]
    public void A_maxed_slot_passes_the_upgrade_to_the_lowest_other_slot()
    {
        var owned = Owned(
            (GearSlot.Weapon, GearTier.Mythic), (GearSlot.Armor, GearTier.Heroic), (GearSlot.Accessory, GearTier.Mortal));

        Assert.Equal(
            (GearSlot.Accessory, GearTier.Heroic),
            Rewards.StreakTarget(GearSlot.Weapon, GearTier.Mythic, owned));
    }

    /// <summary>A Divine piece from a boss counts as above Mythic, and the ladder never grants Divine.</summary>
    [Fact]
    public void Falls_back_only_when_every_slot_is_at_or_above_Mythic()
    {
        var owned = Owned(
            (GearSlot.Weapon, GearTier.Divine), (GearSlot.Armor, GearTier.Mythic), (GearSlot.Accessory, GearTier.Mythic));

        Assert.Null(Rewards.StreakTarget(GearSlot.Armor, GearTier.Mythic, owned));
    }

    [Fact]
    public void Never_grants_Divine()
    {
        var owned = Owned((GearSlot.Weapon, GearTier.Mythic));

        Assert.NotEqual(GearTier.Divine, Rewards.StreakTarget(GearSlot.Weapon, GearTier.Heroic, owned)?.Tier);
    }
}
