namespace Traverser.Api.Data.Entities;

/// <summary>
/// One row per enemy per stat: <c>floor(Base + Rate × L)</c> (GDD 5–7). 13 enemies × 6 stats = 78 rows.
/// <para>
/// Storing base and rate rather than a stat block per level is what makes "enemy level always equals
/// player level at encounter time" fall out for free — there is no enemy level to persist anywhere.
/// </para>
/// </summary>
public class EnemyStatScaling
{
    public string EnemyId { get; set; } = null!;

    public StatKind Stat { get; set; }

    public decimal Base { get; set; }

    public decimal Rate { get; set; }

    public Enemy Enemy { get; set; } = null!;
}
