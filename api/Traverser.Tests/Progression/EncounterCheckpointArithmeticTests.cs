using Traverser.Api.Progression;

namespace Traverser.Tests.Progression;

/// <summary>
/// GDD 9 §5.1's two counting rules, asserted without a database. Fixtures §9: "25% roll per 1,000
/// new steps; 1 guaranteed per 15 min Tier 1+ HR (max 2/session)".
/// </summary>
public class EncounterCheckpointArithmeticTests
{
    [Theory]
    // The boundary is the thousandth step, not the sync: 999 more steps can still be zero rolls.
    [InlineData(0, 999, 0)]
    [InlineData(0, 1_000, 1)]
    [InlineData(999, 1_000, 1)]
    [InlineData(1_999, 2_000, 1)]
    [InlineData(3_400, 3_900, 0)]
    [InlineData(3_900, 4_000, 1)]
    // A week walked offline pays for every League it covered, and the daily cap trims it later.
    [InlineData(0, 70_000, 70)]
    public void Travel_rolls_count_newly_crossed_leagues(long before, long after, int expected) =>
        Assert.Equal(expected, EncounterCheckpoints.TravelRolls(before, after));

    [Theory]
    [InlineData(14, 0, 0)]
    [InlineData(15, 0, 1)]
    [InlineData(29, 0, 1)]
    [InlineData(30, 0, 2)]
    // Max 2 per session, however long the workout runs.
    [InlineData(90, 0, 2)]
    // A re-observed session owes only the difference (T2 §6.3 — minutes are set, not added).
    [InlineData(30, 1, 1)]
    [InlineData(30, 2, 0)]
    [InlineData(15, 2, 0)]
    public void Session_rolls_credit_only_what_is_still_owed(int minutes, int granted, int expected) =>
        Assert.Equal(expected, EncounterCheckpoints.SessionRolls(minutes, granted));
}
