using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Seed;

/// <summary>
/// The M0 seed tests from tech-01 §5 — the seeded content asserted directly against
/// <c>docs/traverser-test-fixtures.md</c>.
/// <para>
/// **If one of these fails, the seed is wrong.** A fixture is never edited to make a test pass.
/// </para>
/// </summary>
[Collection(ContentModelCollection.Name)]
public class ContentSeedTests(ContentModelFixture model)
{
    // — fixtures §4: the XP curve —

    [Fact]
    public void XpCurve_matches_every_fixture_anchor()
    {
        var rows = model.Rows<XpCurve>()
            .ToDictionary(r => ContentModelFixture.Get<int>(r, nameof(XpCurve.Level)));

        foreach (var (level, xpToNext, cumulative) in Fixtures.XpAnchors)
        {
            Assert.True(rows.ContainsKey(level), $"xp_curve has no row for level {level}.");
            var row = rows[level];

            Assert.Equal(xpToNext, ContentModelFixture.GetNullable<int>(row, nameof(XpCurve.XpToNext)));
            Assert.Equal(cumulative, ContentModelFixture.Get<int>(row, nameof(XpCurve.Cumulative)));
        }
    }

    [Fact]
    public void XpCurve_covers_levels_1_to_60_and_stops_at_the_cap()
    {
        var rows = model.Rows<XpCurve>()
            .ToDictionary(r => ContentModelFixture.Get<int>(r, nameof(XpCurve.Level)));

        Assert.Equal(60, rows.Count);
        Assert.Equal(Enumerable.Range(1, 60), rows.Keys.Order());

        // Null at 60 is the schema's statement that XP accrual stops entirely — there is nowhere for
        // banked overflow to go (GDD 1 §4).
        Assert.Null(ContentModelFixture.GetNullable<int>(rows[60], nameof(XpCurve.XpToNext)));
        Assert.All(
            rows.Where(kv => kv.Key < 60),
            kv => Assert.NotNull(ContentModelFixture.GetNullable<int>(kv.Value, nameof(XpCurve.XpToNext))));
    }

    [Fact]
    public void XpCurve_cumulative_is_the_running_sum_of_xp_to_next()
    {
        var rows = model.Rows<XpCurve>()
            .ToDictionary(r => ContentModelFixture.Get<int>(r, nameof(XpCurve.Level)));

        // Only the anchors are pinned by the fixtures; this catches a transcription slip at any of the
        // 39 levels between them, where cumulative would silently stop agreeing with xp_to_next.
        var running = 0;
        for (var level = 1; level <= 60; level++)
        {
            Assert.Equal(running, ContentModelFixture.Get<int>(rows[level], nameof(XpCurve.Cumulative)));
            running += ContentModelFixture.GetNullable<int>(rows[level], nameof(XpCurve.XpToNext)) ?? 0;
        }
    }

    // — fixtures §1: the type chart —

    [Fact]
    public void TypeEffectiveness_matches_the_fixture_chart()
    {
        var rows = model.Rows<TypeEffectiveness>().ToDictionary(
            r => (
                ContentModelFixture.Get<string>(r, nameof(TypeEffectiveness.AttackerTypeId)),
                ContentModelFixture.Get<string>(r, nameof(TypeEffectiveness.DefenderTypeId))),
            r => ContentModelFixture.Get<decimal>(r, nameof(TypeEffectiveness.Multiplier)));

        Assert.Equal(36, rows.Count);

        for (var attacker = 0; attacker < Fixtures.TypeOrder.Length; attacker++)
        {
            for (var defender = 0; defender < Fixtures.TypeOrder.Length; defender++)
            {
                var key = (Fixtures.TypeOrder[attacker], Fixtures.TypeOrder[defender]);
                Assert.True(rows.ContainsKey(key), $"type_effectiveness has no row for {key}.");
                Assert.Equal(Fixtures.TypeChart[attacker][defender], rows[key]);
            }
        }
    }

    // — fixtures §5: gear bonuses —

    [Fact]
    public void GearTierBonus_reproduces_the_fixture_bonuses_at_every_reference_level()
    {
        var tiers = TierBonuses();

        foreach (var (level, mortal, heroic, mythic, divine) in Fixtures.GearBonuses)
        {
            Assert.Equal(mortal, Bonus(tiers[GearTier.Mortal], level));
            Assert.Equal(heroic, Bonus(tiers[GearTier.Heroic], level));
            Assert.Equal(mythic, Bonus(tiers[GearTier.Mythic], level));
            Assert.Equal(divine, Bonus(tiers[GearTier.Divine], level));
        }
    }

    [Fact]
    public void GearTierBonus_reproduces_the_trinket_split_at_every_reference_level()
    {
        var tiers = TierBonuses();

        foreach (var (level, heroic, mythic, divine) in Fixtures.TrinketBonuses)
        {
            Assert.Equal(heroic, TrinketBonus(tiers[GearTier.Heroic], level));
            Assert.Equal(mythic, TrinketBonus(tiers[GearTier.Mythic], level));
            Assert.Equal(divine, TrinketBonus(tiers[GearTier.Divine], level));
        }
    }

    [Fact]
    public void GearTierBonus_has_no_Stride_and_no_fifth_tier()
    {
        // Stride's exclusion (GDD 8 §3.1) is structural — there is no column to put it in. This asserts
        // the other half: exactly the four tiers, so a fifth can't appear without a schema change.
        Assert.Equal(
            [GearTier.Mortal, GearTier.Heroic, GearTier.Mythic, GearTier.Divine],
            TierBonuses().Keys.Order());
    }

    // — fixtures §6: enemy stat scaling —

    [Fact]
    public void EnemyStatScaling_reproduces_all_36_fixture_rows()
    {
        var scaling = model.Rows<EnemyStatScaling>().ToDictionary(
            r => (
                ContentModelFixture.Get<string>(r, nameof(EnemyStatScaling.EnemyId)),
                ContentModelFixture.Get<StatKind>(r, nameof(EnemyStatScaling.Stat))),
            r => (
                Base: ContentModelFixture.Get<decimal>(r, nameof(EnemyStatScaling.Base)),
                Rate: ContentModelFixture.Get<decimal>(r, nameof(EnemyStatScaling.Rate))));

        foreach (var row in Fixtures.EnemyStats)
        {
            var expected = new[] { row.Vigor, row.Might, row.Resolve, row.Favor, row.Aegis, row.Stride };
            var stats = new[]
            {
                StatKind.Vigor, StatKind.Might, StatKind.Resolve,
                StatKind.Favor, StatKind.Aegis, StatKind.Stride,
            };

            for (var i = 0; i < stats.Length; i++)
            {
                var key = (row.Enemy, stats[i]);
                Assert.True(scaling.ContainsKey(key), $"enemy_stat_scaling has no row for {key}.");

                var (@base, rate) = scaling[key];
                // `floor(base + rate × L)`, in decimal — binary floating point would land Fenrir's
                // Stride at L20 (8 + 0.6 × 20) just under 20 and floor it to 19.
                var actual = (int)decimal.Floor(@base + rate * row.Level);

                Assert.True(
                    expected[i] == actual,
                    $"{row.Enemy} {stats[i]} at L{row.Level}: seed gives {actual}, fixture says {expected[i]}.");
            }
        }
    }

    [Fact]
    public void EnemyStatScaling_covers_every_enemy_and_every_stat()
    {
        var enemies = model.Rows<Enemy>()
            .Select(r => ContentModelFixture.Get<string>(r, nameof(Enemy.Id)))
            .ToList();

        var scaling = model.Rows<EnemyStatScaling>()
            .Select(r => (
                EnemyId: ContentModelFixture.Get<string>(r, nameof(EnemyStatScaling.EnemyId)),
                Stat: ContentModelFixture.Get<StatKind>(r, nameof(EnemyStatScaling.Stat))))
            .ToHashSet();

        Assert.Equal(13, enemies.Count);
        Assert.Equal(78, scaling.Count);

        foreach (var enemy in enemies)
        {
            foreach (var stat in Enum.GetValues<StatKind>())
            {
                Assert.True(scaling.Contains((enemy, stat)), $"{enemy} has no {stat} row.");
            }
        }
    }

    // — fixtures §7: the streak ladder —

    [Fact]
    public void StreakMilestone_matches_the_fixture_ladder()
    {
        var rows = model.Rows<StreakMilestone>().ToDictionary(
            r => ContentModelFixture.Get<int>(r, nameof(StreakMilestone.Day)),
            r => (
                Slot: ContentModelFixture.Get<GearSlot>(r, nameof(StreakMilestone.Slot)),
                Tier: ContentModelFixture.Get<GearTier>(r, nameof(StreakMilestone.Tier))));

        Assert.Equal(Fixtures.StreakLadder.Length, rows.Count);

        foreach (var (day, slot, tier) in Fixtures.StreakLadder)
        {
            Assert.True(rows.ContainsKey(day), $"streak_milestone has no row for day {day}.");
            Assert.Equal(Enum.Parse<GearSlot>(slot, ignoreCase: true), rows[day].Slot);
            Assert.Equal(Enum.Parse<GearTier>(tier, ignoreCase: true), rows[day].Tier);
        }

        // GDD 11 §5.1: a streak never grants Divine or a Trinket. The CHECK constraints make this
        // unreachable in the database; this asserts the seed doesn't rely on that to be correct.
        Assert.DoesNotContain(rows.Values, v => v.Tier == GearTier.Divine);
        Assert.DoesNotContain(rows.Values, v => v.Slot == GearSlot.Trinket);
    }

    // — fixtures §8: zone gates —

    [Fact]
    public void ZoneGate_league_thresholds_match_the_fixtures()
    {
        var rows = model.Rows<ZoneGate>().ToDictionary(
            r => ContentModelFixture.Get<string>(r, nameof(ZoneGate.Id)),
            r => ContentModelFixture.Get<int>(r, nameof(ZoneGate.LeagueThreshold)));

        Assert.Equal(Fixtures.GateThresholds.Length, rows.Count);

        foreach (var (gate, leagues) in Fixtures.GateThresholds)
        {
            Assert.True(rows.ContainsKey(gate), $"zone_gate has no row for {gate}.");
            Assert.Equal(leagues, rows[gate]);
        }
    }

    // — structural —

    [Fact]
    public void EnemyMove_ai_weights_sum_to_100_for_every_enemy()
    {
        var byEnemy = model.Rows<EnemyMove>()
            .GroupBy(r => ContentModelFixture.Get<string>(r, nameof(EnemyMove.EnemyId)))
            .ToDictionary(
                g => g.Key,
                g => g.Sum(r => ContentModelFixture.Get<int>(r, nameof(EnemyMove.AiWeight))));

        Assert.Equal(13, byEnemy.Count);
        Assert.All(byEnemy, kv => Assert.True(kv.Value == 100, $"{kv.Key} AI weights sum to {kv.Value}, not 100."));
    }

    // — helpers —

    private Dictionary<GearTier, (decimal Rate, int Flat, decimal Split)> TierBonuses() =>
        model.Rows<GearTierBonus>().ToDictionary(
            r => ContentModelFixture.Get<GearTier>(r, nameof(GearTierBonus.Tier)),
            r => (
                Rate: ContentModelFixture.Get<decimal>(r, nameof(GearTierBonus.Rate)),
                Flat: ContentModelFixture.Get<int>(r, nameof(GearTierBonus.Flat)),
                Split: ContentModelFixture.Get<decimal>(r, nameof(GearTierBonus.TrinketSplit))));

    /// <summary>
    /// <c>round(rate × L) + flat</c> — GDD 8 §3.2. <see cref="MidpointRounding.ToEven"/> is required,
    /// not incidental: fixtures §5 needs Mortal at L10 to be 1 (round(0.5) → 0) and Divine at L42 to
    /// be 14 (round(10.5) → 10). Rounding halves away from zero gives 2 and 15.
    /// </summary>
    private static int Bonus((decimal Rate, int Flat, decimal Split) tier, int level) =>
        (int)Math.Round(tier.Rate * level, MidpointRounding.ToEven) + tier.Flat;

    /// <summary>A Trinket grants <c>round(split × tier bonus)</c> to Favor **and** Aegis both.</summary>
    private static int TrinketBonus((decimal Rate, int Flat, decimal Split) tier, int level) =>
        (int)Math.Round(tier.Split * Bonus(tier, level), MidpointRounding.ToEven);
}
