namespace Traverser.Api.Data.Entities;

/// <summary>
/// olympion, valheon, imperion, egypt_tbd. `egypt_tbd` seeds with
/// <see cref="IsReleased"/> = false so the Map's locked terminus (GDD 9 §3.1) is data rather than
/// a hardcoded special case.
/// </summary>
public class Zone
{
    public string Id { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public int Ordinal { get; set; }

    public bool IsReleased { get; set; } = true;
}
