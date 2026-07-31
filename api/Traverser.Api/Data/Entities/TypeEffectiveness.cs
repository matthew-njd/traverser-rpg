namespace Traverser.Api.Data.Entities;

/// <summary>
/// The 36-row type chart, seeded verbatim from fixtures §1.
/// <para>
/// This is a lookup table, not a rule: it is consulted only for the player's own typed attacks.
/// Enemy moves never get a multiplier and Physical moves never get one in either direction — that
/// rule lives in the battle engine (T5 §3.3), deliberately not in the schema.
/// </para>
/// </summary>
public class TypeEffectiveness
{
    public string AttackerTypeId { get; set; } = null!;

    public string DefenderTypeId { get; set; } = null!;

    /// <summary>`numeric`, never `float` — the fixtures assume exact arithmetic.</summary>
    public decimal Multiplier { get; set; }

    public GameType AttackerType { get; set; } = null!;

    public GameType DefenderType { get; set; } = null!;
}
