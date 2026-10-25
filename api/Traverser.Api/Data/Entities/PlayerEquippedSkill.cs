namespace Traverser.Api.Data.Entities;

/// <summary>
/// The equipped loadout. The 1–4 <see cref="Slot"/> range *is* the "max 4 equipped skills" rule,
/// and the unique constraint on (player, skill) stops the same skill occupying two slots.
/// </summary>
public class PlayerEquippedSkill
{
    public Guid PlayerId { get; set; }

    /// <summary>1–4.</summary>
    public int Slot { get; set; }

    /// <summary>
    /// A <c>player_skill_def</c> or a <c>gear_move</c> id (GDD 3 §4.1), so no foreign key. A Trinket
    /// move's row outlives the Trinket; readers skip a row that is no longer valid.
    /// </summary>
    public string SkillId { get; set; } = null!;

    public Player Player { get; set; } = null!;
}
