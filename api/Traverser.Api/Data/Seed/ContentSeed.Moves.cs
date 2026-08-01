using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>
/// The player's own moves: 10 level-unlocked skills (GDD 3, manifest §Player Skills) and the 6
/// Trinket-granted moves (GDD 8 §4.3).
/// </summary>
internal static partial class ContentSeed
{
    private static void SeedMoves(ModelBuilder modelBuilder)
    {
        // Unlocked skills are never stored per player — `player.level >= unlock_level` derives them,
        // so there is nothing to keep in sync. Only the *equipped* four are persisted.
        modelBuilder.Entity<PlayerSkillDef>().HasData(
            // Basic Attack is the one skill with unlimited uses and the one available from Level 1.
            Skill(Ids.Skill.BasicAttack, "Basic Attack", null, 40, uses: null, unlockLevel: 1),
            Skill(Ids.Skill.IronAdvance, "Iron Advance", null, 60, uses: 5, unlockLevel: 4),
            Skill(Ids.Skill.ThunderersWrath, "Thunderer's Wrath", Ids.Type.Storm, 65, uses: 4, unlockLevel: 6),
            Skill(Ids.Skill.WarlordsAdvance, "Warlord's Advance", Ids.Type.War, 65, uses: 4, unlockLevel: 10),
            Skill(Ids.Skill.Shadowstep, "Shadowstep", Ids.Type.Trickery, 55, uses: 5, unlockLevel: 16),
            Skill(Ids.Skill.TitansReach, "Titan's Reach", null, 80, uses: 4, unlockLevel: 22),
            Skill(Ids.Skill.PaleSentence, "Pale Sentence", Ids.Type.Underworld, 75, uses: 3, unlockLevel: 30),
            Skill(Ids.Skill.TidecallersGrasp, "Tidecaller's Grasp", Ids.Type.Sea, 65, uses: 4, unlockLevel: 36),
            Skill(Ids.Skill.SagesVerdict, "Sage's Verdict", Ids.Type.Wisdom, 75, uses: 3, unlockLevel: 44),
            Skill(Ids.Skill.ChampionsSurge, "Champion's Surge", null, 100, uses: 3, unlockLevel: 56));

        // Each zone boss's Trinket is typed to matter for the *next* zone, not the one it drops in
        // (GDD 8 §4.2). Mythic = damage only at P80/4 uses; Divine = damage + one effect at P75/3 uses.
        // All six are Divine-category (Favor vs. Aegis), so the schema carries no category column here.
        modelBuilder.Entity<GearMove>().HasData(
            GearMv(Ids.GMove.GatekeepersRuse, "Gatekeeper's Ruse", Ids.Type.Trickery, 80, 4, null),
            GearMv(Ids.GMove.GatekeepersSnare, "Gatekeeper's Snare", Ids.Type.Trickery, 75, 3, MoveEffect.Rend),
            GearMv(Ids.GMove.CoilbreakersOath, "Coilbreaker's Oath", Ids.Type.War, 80, 4, null),
            GearMv(Ids.GMove.CoilbreakersWrath, "Coilbreaker's Wrath", Ids.Type.War, 75, 3, MoveEffect.Weaken),
            GearMv(Ids.GMove.EmberwiseWard, "Emberwise Ward", Ids.Type.Wisdom, 80, 4, null),
            GearMv(Ids.GMove.EmberwiseVerdict, "Emberwise Verdict", Ids.Type.Wisdom, 75, 3, MoveEffect.Fortify));
    }

    /// <summary>A null <paramref name="typeId"/> makes the skill Physical (Might vs. Resolve).</summary>
    private static PlayerSkillDef Skill(
        string id, string displayName, string? typeId, int power, int? uses, int unlockLevel) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            Category = typeId is null ? MoveCategory.Physical : MoveCategory.Divine,
            TypeId = typeId,
            Power = power,
            Uses = uses,
            UnlockLevel = unlockLevel,
        };

    private static GearMove GearMv(
        string id, string displayName, string typeId, int power, int uses, MoveEffect? effect) =>
        new()
        {
            Id = id,
            DisplayName = displayName,
            TypeId = typeId,
            Power = power,
            Uses = uses,
            Effect = effect,
        };
}
