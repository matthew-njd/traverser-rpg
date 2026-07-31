namespace Traverser.Api.Data.Entities;

/// <summary>
/// Backs the bestiary screen and — more load-bearing — <see cref="DefeatCount"/> = 0 versus &gt; 0
/// is the first-kill-vs-repeat distinction that decides Divine or Mythic boss loot (GDD 8 §5.2).
/// </summary>
public class PlayerBestiary
{
    public Guid PlayerId { get; set; }

    public string EnemyId { get; set; } = null!;

    public DateTime FirstSeenAt { get; set; }

    public int EncounterCount { get; set; }

    public int DefeatCount { get; set; }

    public Player Player { get; set; } = null!;

    public Enemy Enemy { get; set; } = null!;
}
