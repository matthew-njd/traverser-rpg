namespace Traverser.Api.Progression;

/// <summary>
/// GDD 9 §5's checkpoint arithmetic — T2 §4 step 8. Pure, so the rules can be asserted against
/// fixtures §8 without a database or a transaction.
/// </summary>
public static class EncounterCheckpoints
{
    /// <summary>1 League = 1,000 lifetime steps (GDD 9 §2.1).</summary>
    public const int StepsPerLeague = 1000;

    /// <summary>GDD 9 §5.1's forward-travel chance, per newly-crossed League.</summary>
    public const double TravelChance = 0.25;

    /// <summary>GDD 9 §5.1 — one bonus roll per this many continuous Tier 1+ minutes.</summary>
    public const int MinutesPerSessionRoll = 15;

    /// <summary>GDD 9 §5.1's per-session ceiling, also a CHECK on <c>encounter_rolls_granted</c>.</summary>
    public const int MaxSessionRolls = 2;

    /// <summary>GDD 9 §5.3's hard daily cap, counted across all three sources.</summary>
    public const int DailyCap = 5;

    /// <summary>
    /// ↯ **Rolls are per newly-crossed League, not per sync.** A sync carrying 12,000 steps offers
    /// twelve chances, and one carrying 999 offers none — the boundary is the thousand, not the
    /// upload. Getting this wrong makes a week offline worth the same as a walk to the shop.
    /// </summary>
    public static int TravelRolls(long stepsBefore, long stepsAfter) =>
        (int)(stepsAfter / StepsPerLeague - stepsBefore / StepsPerLeague);

    /// <summary>
    /// The bonus rolls a session still owes, given what it has already been granted.
    /// <para>
    /// ↯ **Against the session's own total, never the day's.** A re-observed session arrives with
    /// its minutes *set, not added* (T2 §6.3), so the same workout is seen repeatedly as it grows —
    /// subtracting what was already granted is what stops one long walk granting all day.
    /// </para>
    /// </summary>
    public static int SessionRolls(int tier1PlusMinutes, int alreadyGranted)
    {
        var earned = Math.Min(tier1PlusMinutes / MinutesPerSessionRoll, MaxSessionRolls);

        return Math.Max(earned - alreadyGranted, 0);
    }
}
