namespace Traverser.Api.Data.Entities;

/// <summary>The six types (GDD 2). Manifest key as the PK: storm, war, trickery, underworld, sea, wisdom.</summary>
public class GameType
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    /// <summary>0..5, the Section 2 cycle order. Stored for UI ordering only — the effectiveness
    /// chart is seeded verbatim from fixtures §1, never derived from this.</summary>
    public int CycleOrdinal { get; set; }
}
