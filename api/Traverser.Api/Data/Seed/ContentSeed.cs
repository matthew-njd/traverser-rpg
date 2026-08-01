using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data.Entities;

namespace Traverser.Api.Data.Seed;

/// <summary>
/// The content seed (tech-01 §5). Every row is keyed by a manifest ID — no ID is invented here; if a
/// GDD table needs a key the manifest lacks, the manifest is amended first.
/// <para>
/// Delivered through EF Core <c>HasData</c> so every content change arrives as a reviewable migration
/// with a diff, and <c>dotnet ef database update</c> is the only command needed. <see cref="Version"/>
/// is bumped in the same migration as any change below.
/// </para>
/// <para>
/// The values here are transcribed from the GDD and asserted against
/// <c>docs/traverser-test-fixtures.md</c> by the seed tests. If a test fails, the seed is wrong — a
/// fixture is never edited to make a test pass.
/// </para>
/// </summary>
internal static partial class ContentSeed
{
    /// <summary>
    /// Bump on **any** change to the rows below. The client compares this against its cached bundle
    /// and re-downloads only when it moved (tech-01 §3) — a content change that forgets to bump it is
    /// invisible to every already-installed client.
    /// </summary>
    private const int Version = 1;

    /// <summary>
    /// <c>content_version.generated_at</c>. <c>HasData</c> requires a constant, so the store default
    /// of <c>now()</c> can't apply: this is the date the seed was authored and it moves with
    /// <see cref="Version"/>.
    /// </summary>
    private static readonly DateTime GeneratedAt = new(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc);

    internal static void Apply(ModelBuilder modelBuilder)
    {
        SeedVersion(modelBuilder);
        SeedTypes(modelBuilder);
        SeedZones(modelBuilder);
        SeedEnemies(modelBuilder);
        SeedMoves(modelBuilder);
        SeedItems(modelBuilder);
        SeedGear(modelBuilder);
        SeedProgression(modelBuilder);
    }

    private static void SeedVersion(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<ContentVersion>().HasData(
            new ContentVersion { Id = 1, Version = Version, GeneratedAt = GeneratedAt });

    private static void SeedTypes(ModelBuilder modelBuilder)
    {
        // Cycle order is significant (GDD 2 §3): Storm → War → Trickery → Underworld → Sea → Wisdom.
        // Stored for UI ordering only — the chart below is never derived from it.
        modelBuilder.Entity<GameType>().HasData(
            new GameType { Id = Ids.Type.Storm, DisplayName = "Storm", CycleOrdinal = 0 },
            new GameType { Id = Ids.Type.War, DisplayName = "War", CycleOrdinal = 1 },
            new GameType { Id = Ids.Type.Trickery, DisplayName = "Trickery", CycleOrdinal = 2 },
            new GameType { Id = Ids.Type.Underworld, DisplayName = "Underworld", CycleOrdinal = 3 },
            new GameType { Id = Ids.Type.Sea, DisplayName = "Sea", CycleOrdinal = 4 },
            new GameType { Id = Ids.Type.Wisdom, DisplayName = "Wisdom", CycleOrdinal = 5 });

        // All 36 rows transcribed verbatim from fixtures §1, deliberately NOT computed from
        // CycleOrdinal (tech-01 §3): deriving the chart here would put a second implementation of the
        // hexagon rule in the seeder, where a bug would be invisible because it would agree with itself.
        // Rows = attacker, columns = defender.
        //                            vs:  Storm  War    Trick  Under  Sea    Wisdom
        modelBuilder.Entity<TypeEffectiveness>().HasData([
            .. Chart(Ids.Type.Storm,       1.0m,  2.0m,  2.0m,  1.0m,  0.5m,  0.5m),
            .. Chart(Ids.Type.War,         0.5m,  1.0m,  2.0m,  2.0m,  1.0m,  0.5m),
            .. Chart(Ids.Type.Trickery,    0.5m,  0.5m,  1.0m,  2.0m,  2.0m,  1.0m),
            .. Chart(Ids.Type.Underworld,  1.0m,  0.5m,  0.5m,  1.0m,  2.0m,  2.0m),
            .. Chart(Ids.Type.Sea,         2.0m,  1.0m,  0.5m,  0.5m,  1.0m,  2.0m),
            .. Chart(Ids.Type.Wisdom,      2.0m,  2.0m,  1.0m,  0.5m,  0.5m,  1.0m),
        ]);
    }

    /// <summary>One attacker's row of the chart, in the fixed column order of fixtures §1.</summary>
    private static TypeEffectiveness[] Chart(
        string attacker,
        decimal vsStorm, decimal vsWar, decimal vsTrickery,
        decimal vsUnderworld, decimal vsSea, decimal vsWisdom) =>
    [
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.Storm, Multiplier = vsStorm },
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.War, Multiplier = vsWar },
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.Trickery, Multiplier = vsTrickery },
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.Underworld, Multiplier = vsUnderworld },
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.Sea, Multiplier = vsSea },
        new() { AttackerTypeId = attacker, DefenderTypeId = Ids.Type.Wisdom, Multiplier = vsWisdom },
    ];

    private static void SeedZones(ModelBuilder modelBuilder) =>
        // GDD 9 §3. `egypt_tbd` is IsReleased = false so the Map's locked terminus (GDD 9 §3.1) is
        // data rather than a hardcoded special case.
        modelBuilder.Entity<Zone>().HasData(
            new Zone { Id = Ids.Zone.Olympion, DisplayName = "Olympion", Ordinal = 0, IsReleased = true },
            new Zone { Id = Ids.Zone.Valheon, DisplayName = "Valheon", Ordinal = 1, IsReleased = true },
            new Zone { Id = Ids.Zone.Imperion, DisplayName = "Imperion", Ordinal = 2, IsReleased = true },
            new Zone { Id = Ids.Zone.EgyptTbd, DisplayName = "The Road Ahead", Ordinal = 3, IsReleased = false });
}
