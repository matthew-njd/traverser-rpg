using Traverser.Api.Progression;
using Traverser.Tests.Seed;

namespace Traverser.Tests.Progression;

/// <summary>
/// T2 §4 step 5's curve walk, driven by the real seeded curve rather than a hand-built one — the
/// point of the step is that it reads <c>xp_curve</c>, so a test against invented numbers would
/// verify the loop and not the behaviour.
/// </summary>
public class LevelCurveTests
{
    /// <summary>
    /// `round(100 × L^1.05)`, evaluated once here to build the whole 60-row curve, then checked
    /// against fixtures §4's anchors below so the generator itself cannot drift.
    /// </summary>
    private static readonly IReadOnlyDictionary<int, int?> Curve = BuildCurve();

    private static Dictionary<int, int?> BuildCurve()
    {
        var curve = new Dictionary<int, int?>();

        for (var level = 1; level < LevelCurve.MaxLevel; level++)
        {
            curve[level] = (int)Math.Round(100 * Math.Pow(level, 1.05), MidpointRounding.AwayFromZero);
        }

        // Null at 60 — the schema's statement that accrual stops there (GDD 1 §4).
        curve[LevelCurve.MaxLevel] = null;

        return curve;
    }

    /// <summary>
    /// Guards the fixture above. If this fails, every other test in the file is measuring against
    /// the wrong ladder and their results mean nothing.
    /// </summary>
    [Fact]
    public void The_local_curve_matches_the_fixture_anchors()
    {
        foreach (var (level, xpToNext, _) in Fixtures.XpAnchors)
        {
            Assert.Equal(xpToNext, Curve[level]);
        }
    }

    [Fact]
    public void Xp_below_the_threshold_does_not_level()
    {
        var result = LevelCurve.Apply(level: 1, xpCurrent: 0, xpGained: 99, Curve);

        Assert.Equal(1, result.Level);
        Assert.Equal(99, result.XpCurrent);
        Assert.Empty(result.LevelUps);
    }

    [Fact]
    public void Exactly_the_threshold_levels_and_leaves_zero()
    {
        var result = LevelCurve.Apply(level: 1, xpCurrent: 0, xpGained: 100, Curve);

        Assert.Equal(2, result.Level);
        Assert.Equal(0, result.XpCurrent);
        Assert.Equal(3, Assert.Single(result.LevelUps).StatPointsAwarded);
    }

    /// <summary>
    /// T2 §4's worked example, step 5: L11 with 400 XP banked gains 935 → 1,335 against a 1,240
    /// threshold → **L12 with 95 carried**. The carry is the part worth pinning; dropping it would
    /// lose real progress on every level-up.
    /// </summary>
    [Fact]
    public void The_spec_worked_example_carries_the_remainder_into_the_new_level()
    {
        var result = LevelCurve.Apply(level: 11, xpCurrent: 400, xpGained: 935, Curve);

        Assert.Equal(1240, Curve[11]);
        Assert.Equal(12, result.Level);
        Assert.Equal(95, result.XpCurrent);

        var levelUp = Assert.Single(result.LevelUps);

        Assert.Equal(12, levelUp.Level);
        Assert.Equal(3, levelUp.StatPointsAwarded);
    }

    /// <summary>
    /// One sync after a long offline stretch can cross several levels at once, and each must award
    /// its own 3 points. Awarding once per sync rather than once per level is the plausible bug.
    /// </summary>
    [Fact]
    public void A_single_sync_can_cross_several_levels()
    {
        // Levels 1→4 costs 100 + 207 + 317 = 624; fixtures §4's cumulative for level 4 agrees.
        var result = LevelCurve.Apply(level: 1, xpCurrent: 0, xpGained: 624, Curve);

        Assert.Equal(4, result.Level);
        Assert.Equal(0, result.XpCurrent);
        Assert.Equal([2, 3, 4], result.LevelUps.Select(l => l.Level));
        Assert.Equal(9, result.LevelUps.Sum(l => l.StatPointsAwarded));
    }

    /// <summary>
    /// GDD 1 §5 — 3 points per level, 177 total across levels 2–60. The fixture's own figure, walked
    /// end to end rather than multiplied.
    /// </summary>
    [Fact]
    public void Walking_the_whole_curve_awards_177_points()
    {
        var cumulative = Fixtures.XpAnchors.Single(a => a.Level == LevelCurve.MaxLevel).Cumulative;

        var result = LevelCurve.Apply(level: 1, xpCurrent: 0, xpGained: cumulative, Curve);

        Assert.Equal(LevelCurve.MaxLevel, result.Level);
        Assert.Equal(59, result.LevelUps.Count);
        Assert.Equal(177, result.LevelUps.Sum(l => l.StatPointsAwarded));
    }

    /// <summary>
    /// ↯ **XP stops entirely at 60 — no banking** (GDD 1 §4, CLAUDE.md). Banking would let a capped
    /// veteran skip a large slice of the Level 61–80 curve the day an expansion ships, which is the
    /// whole reason the remainder is discarded rather than stored.
    /// </summary>
    [Fact]
    public void Reaching_the_cap_discards_the_remainder()
    {
        var toReach59 = Fixtures.XpAnchors.Single(a => a.Level == 59).Cumulative;

        // Enough to reach 60 with a large surplus.
        var result = LevelCurve.Apply(level: 1, xpCurrent: 0, xpGained: toReach59 + 99_999, Curve);

        Assert.Equal(LevelCurve.MaxLevel, result.Level);
        Assert.Equal(0, result.XpCurrent);
    }

    [Fact]
    public void At_the_cap_further_xp_changes_nothing()
    {
        var result = LevelCurve.Apply(level: LevelCurve.MaxLevel, xpCurrent: 0, xpGained: 50_000, Curve);

        Assert.Equal(LevelCurve.MaxLevel, result.Level);
        Assert.Equal(0, result.XpCurrent);
        Assert.Empty(result.LevelUps);
    }

    /// <summary>A no-op sync must not disturb the bar — the replay case, at the unit level.</summary>
    [Fact]
    public void Zero_xp_is_a_no_op()
    {
        var result = LevelCurve.Apply(level: 11, xpCurrent: 400, xpGained: 0, Curve);

        Assert.Equal(11, result.Level);
        Assert.Equal(400, result.XpCurrent);
        Assert.Empty(result.LevelUps);
    }

    [Fact]
    public void Negative_xp_throws() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => LevelCurve.Apply(5, 0, -1, Curve));
}
