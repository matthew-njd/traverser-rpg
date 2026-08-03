using Traverser.Api.Progression;

namespace Traverser.Tests.Progression;

/// <summary>
/// GDD 1 §2's rates, asserted against <c>traverser-test-fixtures.md</c> §4 and §11.6. Per CLAUDE.md,
/// if this code and a fixture disagree the code is wrong — no fixture is edited to make a test pass.
/// </summary>
public class XpDerivationTests
{
    [Theory]
    // fixtures §4: 1 XP per 20 steps, uncapped.
    [InlineData(0, 0)]
    [InlineData(19, 0)]
    [InlineData(20, 1)]
    [InlineData(8_000, 400)]    // GDD 1 §2.1's own example
    [InlineData(10_000, 500)]   // GDD 1 §2.2's highly-active example
    [InlineData(6_200, 310)]    // T2 §4's worked example, day 2
    public void Step_xp_is_one_per_twenty_steps(int steps, int expected) =>
        Assert.Equal(expected, XpRates.ForSteps(steps));

    /// <summary>A partial 20 earns nothing until it completes; the remainder is not lost, the day's
    /// running total keeps it, because steps accumulate on <c>activity_day</c> and XP is derived per
    /// delta from what that delta carried.</summary>
    [Fact]
    public void Step_xp_floors_rather_than_rounding() => Assert.Equal(1, XpRates.ForSteps(39));

    [Theory]
    [InlineData(1, 30, 90)]     // Moderate, 3/min
    [InlineData(2, 45, 225)]    // Vigorous, 5/min — GDD 1 §2.2's example
    [InlineData(1, 0, 0)]
    public void Tier_1_and_2_are_flat_and_uncapped(int tier, int minutes, int expected) =>
        Assert.Equal(expected, XpRates.ForTierMinutes(tier, minutes, cumulativeTier3Before: 0));

    /// <summary>
    /// **fixtures §11.6, the anchor case.** T2 §4 step 4 calls the Tier 3 cap the single easiest way
    /// to get the sync transaction wrong, because evaluating it per-delta rather than against the
    /// day's cumulative total fails silently *in the player's favour* — nobody reports a bug about
    /// being over-rewarded, so only this test will ever catch it.
    /// </summary>
    [Theory]
    // First sync of the day: 15 Peak minutes, all under the 20-minute allowance → 15 × 7.
    [InlineData(15, 0, 105)]
    // The anchor: 12 more Peak minutes into a day already holding 15. Five land inside the
    // allowance (7 XP each), seven fall past it and bill at the Vigorous rate (5 XP each).
    // Per-delta evaluation would charge all 12 at Peak for 84 — over by 14, silently.
    [InlineData(12, 15, 70)]
    // Exactly filling the allowance.
    [InlineData(20, 0, 140)]
    // Starting past the cap: every minute bills at the Tier 2 rate, never below it.
    [InlineData(10, 20, 50)]
    [InlineData(10, 35, 50)]
    // Straddling the boundary from zero.
    [InlineData(25, 0, 165)]
    [InlineData(0, 15, 0)]
    public void Tier_3_charges_against_the_days_cumulative_total(int minutes, int before, int expected)
    {
        Assert.Equal(expected, XpRates.ForTier3Minutes(minutes, before));
        Assert.Equal(expected, XpRates.ForTierMinutes(3, minutes, before));
    }

    /// <summary>
    /// The property behind fixtures §11.6: splitting a day's Peak minutes across any number of
    /// deltas must award exactly what one delta of the total would. If this ever fails, the cap has
    /// become sensitive to how the client happened to batch its reads.
    /// </summary>
    [Theory]
    [InlineData(27)]
    [InlineData(20)]
    [InlineData(60)]
    [InlineData(3)]
    public void Splitting_tier_3_minutes_across_deltas_awards_the_same_total(int totalMinutes)
    {
        var whole = XpRates.ForTier3Minutes(totalMinutes, 0);

        for (var split = 1; split < totalMinutes; split++)
        {
            var piecewise = XpRates.ForTier3Minutes(split, 0)
                            + XpRates.ForTier3Minutes(totalMinutes - split, split);

            Assert.Equal(whole, piecewise);
        }
    }

    /// <summary>
    /// GDD 1 §2.2's design intent, stated as an invariant: a player is never penalised for a longer
    /// hard workout. More Peak minutes can never award less XP than fewer.
    /// </summary>
    [Fact]
    public void More_peak_minutes_never_award_less_xp()
    {
        for (var before = 0; before <= 40; before++)
        {
            for (var minutes = 0; minutes < 60; minutes++)
            {
                Assert.True(
                    XpRates.ForTier3Minutes(minutes + 1, before) > XpRates.ForTier3Minutes(minutes, before),
                    $"an extra Peak minute awarded nothing at before={before}, minutes={minutes}");
            }
        }
    }

    /// <summary>Past the cap the rate drops to Tier 2's and stops there — never below it.</summary>
    [Fact]
    public void The_capped_rate_never_falls_below_the_tier_2_rate()
    {
        for (var before = 0; before <= 40; before++)
        {
            for (var minutes = 1; minutes < 60; minutes++)
            {
                Assert.True(
                    XpRates.ForTier3Minutes(minutes, before) >= minutes * XpRates.Tier2XpPerMinute,
                    $"Peak paid less than Vigorous at before={before}, minutes={minutes}");
            }
        }
    }

    [Fact]
    public void An_unknown_tier_throws_rather_than_awarding_nothing() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => XpRates.ForTierMinutes(4, 10, 0));

    /// <summary>
    /// T2 §4's own worked example, day 1: 8,000 steps and 45 minutes Vigorous → 400 + 225 = 625.
    /// </summary>
    [Fact]
    public void The_spec_worked_example_day_one_totals_625()
    {
        var stepXp = XpRates.ForSteps(8_000);
        var tierXp = XpRates.ForTierMinutes(2, 45, cumulativeTier3Before: 0);

        Assert.Equal(400, stepXp);
        Assert.Equal(225, tierXp);
        Assert.Equal(625, stepXp + tierXp);
    }
}
