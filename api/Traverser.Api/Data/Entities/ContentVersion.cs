namespace Traverser.Api.Data.Entities;

/// <summary>
/// Single-row table (tech-01 §3). Any seed change bumps <see cref="Version"/>; the client compares
/// it against its cached bundle and re-downloads only when it moved. The whole cache-invalidation story.
/// </summary>
public class ContentVersion
{
    /// <summary>Always 1 — enforced by a CHECK, so a second row cannot exist.</summary>
    public int Id { get; set; } = 1;

    public int Version { get; set; }

    public DateTime GeneratedAt { get; set; }
}
