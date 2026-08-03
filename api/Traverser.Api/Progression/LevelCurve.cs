namespace Traverser.Api.Progression;

/// <summary>One level gained, and the points it awarded. T2 §4's response calls these `level_ups`.</summary>
/// <param name="Level">The level reached, not the one left behind.</param>
public readonly record struct LevelUp(int Level, int StatPointsAwarded);

/// <param name="Level">Level after applying the XP.</param>
/// <param name="XpCurrent">Progress toward the next level, after applying the XP.</param>
public readonly record struct LevelWalkResult(int Level, int XpCurrent, IReadOnlyList<LevelUp> LevelUps);

/// <summary>
/// T2 §4 step 5 — applies XP and walks the seeded <c>xp_curve</c>.
/// </summary>
public static class LevelCurve
{
    /// <summary>GDD 1's fixed hard cap.</summary>
    public const int MaxLevel = 60;

    /// <summary>Flat 3 per level, allocated manually by the player (GDD 1 §5).</summary>
    public const int StatPointsPerLevel = 3;

    private static readonly IReadOnlyList<LevelUp> None = [];

    /// <summary>
    /// ↯ <paramref name="xpToNextByLevel"/> is the <em>seeded</em> curve, passed in rather than
    /// computed. <c>round(100 × L^1.05)</c> is trivial to evaluate and must not be evaluated here:
    /// .NET rounds halves to even and JavaScript's <c>Math.round</c> rounds them up, so a client and
    /// server that each computed it would eventually disagree about whether the player levelled.
    /// The database holds the single copy and both tiers read it.
    /// </summary>
    public static LevelWalkResult Apply(int level, int xpCurrent, int xpGained, IReadOnlyDictionary<int, int?> xpToNextByLevel)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(xpGained);

        // ↯ At the cap XP stops *entirely* — it is not accumulated against a level that will never
        // arrive (GDD 1 §4, CLAUDE.md). Returning before adding is what makes that true: banking
        // would let a capped veteran skip a large slice of the Level 61–80 curve on the day an
        // expansion ships, which is the whole reason the cap discards rather than stores.
        // `xp_lifetime` still accrues — the caller adds it unconditionally — because that number is
        // a display of total effort, not progress toward anything.
        if (level >= MaxLevel)
        {
            return new LevelWalkResult(MaxLevel, xpCurrent, None);
        }

        var newLevel = level;
        var newXp = xpCurrent + xpGained;
        var levelUps = new List<LevelUp>();

        while (newLevel < MaxLevel
               && xpToNextByLevel.TryGetValue(newLevel, out var toNext)
               && toNext is int required
               && newXp >= required)
        {
            newXp -= required;
            newLevel++;
            levelUps.Add(new LevelUp(newLevel, StatPointsPerLevel));
        }

        // Reaching 60 mid-walk discards the remainder rather than carrying it, for the same reason
        // as the early return above. The level bar retires here.
        if (newLevel >= MaxLevel)
        {
            newXp = 0;
        }

        return new LevelWalkResult(newLevel, newXp, levelUps);
    }
}
