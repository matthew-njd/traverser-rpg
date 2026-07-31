namespace Traverser.Api.Data.Entities;

/// <summary>
/// 60 seeded rows, asserted against fixtures §4 — **not** computed at runtime. <c>round(100 × L^1.05)</c>
/// is trivial to evaluate, but .NET's banker's rounding and JS's <c>Math.round</c> disagree at exact
/// halves and the client and server must never disagree about whether the player levelled.
/// </summary>
public class XpCurve
{
    public int Level { get; set; }

    /// <summary>
    /// Null at level 60 — which is also the schema's statement that XP accrual stops there. There is
    /// nowhere for banked overflow to go (GDD 1 §4).
    /// </summary>
    public int? XpToNext { get; set; }

    public int Cumulative { get; set; }
}
