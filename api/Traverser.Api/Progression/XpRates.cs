namespace Traverser.Api.Progression;

/// <summary>
/// GDD 1 §2's earning rates. Expected values are locked in <c>traverser-test-fixtures.md</c> §4 and
/// §11.6 — if this file and a fixture disagree, this file is wrong.
/// </summary>
public static class XpRates
{
    /// <summary>1 XP per 20 steps, uncapped (GDD 1 §2.1).</summary>
    public const int StepsPerXp = 20;

    /// <summary>Tier 1, Moderate (50–69% HRmax). No duration cap.</summary>
    public const int Tier1XpPerMinute = 3;

    /// <summary>Tier 2, Vigorous (70–84%). No duration cap.</summary>
    public const int Tier2XpPerMinute = 5;

    /// <summary>Tier 3, Peak (85%+). Capped — see <see cref="ForTier3Minutes"/>.</summary>
    public const int Tier3XpPerMinute = 7;

    /// <summary>
    /// GDD 1 §2.2 — the first 20 <em>cumulative minutes per calendar day</em> earn the Peak rate;
    /// beyond that the rate drops to Tier 2's, never below it. A long hard workout is never
    /// penalised, the escalating reward simply stops.
    /// </summary>
    public const int Tier3DailyCapMinutes = 20;

    /// <summary>Integer division, so a partial 20 earns nothing until it completes.</summary>
    public static int ForSteps(int steps) => steps / StepsPerXp;

    /// <summary>
    /// XP for <paramref name="minutes"/> at <paramref name="tier"/>, given how many Tier 3 minutes
    /// the day had already accumulated <em>before</em> these.
    /// </summary>
    public static int ForTierMinutes(int tier, int minutes, int cumulativeTier3Before) => tier switch
    {
        1 => minutes * Tier1XpPerMinute,
        2 => minutes * Tier2XpPerMinute,
        3 => ForTier3Minutes(minutes, cumulativeTier3Before),
        _ => throw new ArgumentOutOfRangeException(nameof(tier), tier, "HR tier must be 1, 2, or 3."),
    };

    /// <summary>
    /// ↯ The cap is per calendar day, evaluated against the day's <em>post-merge cumulative</em>
    /// total — never against the delta in isolation (T2 §4 step 4). fixtures §11.6 is the anchor
    /// case: 12 Peak minutes arriving at a day that already holds 15 bill as 5 at the Peak rate and
    /// 7 at the Vigorous rate, not 12 at Peak.
    /// <para>
    /// T2 flags this as the single easiest way to get the sync transaction wrong, and the reason is
    /// that getting it wrong <b>fails silently and in the player's favour</b> — per-delta evaluation
    /// would have charged all 12 at Peak, over-awarding 14 XP with nothing anywhere to notice it. No
    /// bug report will ever surface this; only this arithmetic will.
    /// </para>
    /// </summary>
    public static int ForTier3Minutes(int minutes, int cumulativeTier3Before)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(minutes);
        ArgumentOutOfRangeException.ThrowIfNegative(cumulativeTier3Before);

        // How much of the day's 20-minute Peak allowance these minutes actually land inside. Written
        // as the difference of two clamps rather than as a remaining-allowance subtraction so that a
        // day already past the cap yields 0 rather than a negative.
        var cappedBefore = Math.Min(Tier3DailyCapMinutes, cumulativeTier3Before);
        var cappedAfter = Math.Min(Tier3DailyCapMinutes, cumulativeTier3Before + minutes);

        var atPeakRate = cappedAfter - cappedBefore;
        var atVigorousRate = minutes - atPeakRate;

        return (atPeakRate * Tier3XpPerMinute) + (atVigorousRate * Tier2XpPerMinute);
    }
}
