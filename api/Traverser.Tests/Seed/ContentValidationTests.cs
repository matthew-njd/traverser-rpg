using Microsoft.EntityFrameworkCore;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Seed;

/// <summary>
/// tech-06 §5.4's content-bundle validation pass — the server-side twin of tech-04 §9.2's build-time
/// asset check. Between them, an ID that exists in one place and not the other fails either the
/// build or the tests, never a battle.
/// <para>
/// §5.4 specifies these as running "in the seed step". This project has no separate seed step — the
/// seed ships as EF <c>HasData</c> inside a migration (DECISIONS 2026-08-01) — so the checks split
/// by what each can express: anything true of a single row is a CHECK constraint and fails when the
/// migration is applied, and anything spanning rows, tables, or files is a test and fails at
/// <c>dotnet test</c>. Both fail before content reaches a device, which is what §5.4 is for.
/// </para>
/// </summary>
[Collection(ContentModelCollection.Name)]
public class ContentValidationTests(ContentModelFixture model)
{
    /// <summary>
    /// §5.4's first check. The runtime symptom of a missing move is an enemy that silently never
    /// acts — a battle that looks unbalanced rather than broken, which is why tech-05 §11.6 does
    /// not catch it and why it is worth a test of its own.
    /// </summary>
    [Fact]
    public void Every_enemy_has_at_least_one_move()
    {
        var enemies = Ids<Enemy>(nameof(Enemy.Id));

        var armed = model.Rows<EnemyMove>()
            .Select(r => ContentModelFixture.Get<string>(r, nameof(EnemyMove.EnemyId)))
            .ToHashSet();

        var mute = enemies.Except(armed).Order().ToList();

        Assert.True(
            mute.Count == 0,
            $"Enemies with no enemy_move rows (they would never act): {string.Join(", ", mute)}");
    }

    /// <summary>
    /// §5.4's second check, as the model-level twin of <c>ck_enemy_move_ai_weight</c>. The constraint
    /// is the real enforcement; this fails first and names the move, rather than surfacing as a
    /// Postgres constraint violation halfway through applying a migration.
    /// </summary>
    [Fact]
    public void Every_enemy_move_weight_is_strictly_positive()
    {
        var unpickable = model.Rows<EnemyMove>()
            .Select(r => (
                Id: ContentModelFixture.Get<string>(r, nameof(EnemyMove.Id)),
                Weight: ContentModelFixture.Get<int>(r, nameof(EnemyMove.AiWeight))))
            .Where(m => m.Weight <= 0)
            .ToList();

        Assert.True(
            unpickable.Count == 0,
            "Moves that can never be selected by tech-05 §5's weighted pick: " +
            string.Join(", ", unpickable.Select(m => $"{m.Id} (weight {m.Weight})")));
    }

    /// <summary>
    /// §5.4's third check. The foreign key already makes an unresolvable <c>item_def_id</c> fail on
    /// insert; this names the offending row instead, and covers the half a FK cannot — that a row
    /// which exists is actually reachable by the weighted draw.
    /// </summary>
    [Fact]
    public void Every_drop_pool_row_references_a_real_item_and_can_be_drawn()
    {
        var items = Ids<ItemDef>(nameof(ItemDef.Id));
        var problems = new List<string>();

        foreach (var row in model.Rows<EnemyDropPool>())
        {
            var enemy = ContentModelFixture.Get<string>(row, nameof(EnemyDropPool.EnemyId));
            var item = ContentModelFixture.Get<string>(row, nameof(EnemyDropPool.ItemDefId));
            var weight = ContentModelFixture.Get<int>(row, nameof(EnemyDropPool.Weight));

            if (!items.Contains(item))
            {
                problems.Add($"{enemy} drops '{item}', which is not an item_def.");
            }

            if (weight <= 0)
            {
                problems.Add($"{enemy} → {item} has weight {weight} and could never be drawn.");
            }
        }

        Assert.True(problems.Count == 0, string.Join(Environment.NewLine, problems));
    }

    /// <summary>
    /// §5.4's third check, second half: every drop rate is a probability in <c>(0, 1]</c>. Zero is
    /// excluded deliberately — "never drops" is expressed by omitting the row (GDD 8 §5.2 gives
    /// wild encounters and the daily goal no <c>trinket</c> row at all), so a 0.0 row would be a
    /// second spelling of an absence that is already meaningful.
    /// </summary>
    [Fact]
    public void Every_drop_rate_is_a_probability()
    {
        var outOfRange = model.Rows<DropRate>()
            .Select(r => (
                Encounter: ContentModelFixture.Get<DropEncounterKind>(r, nameof(DropRate.EncounterKind)),
                Reward: ContentModelFixture.Get<DropRewardKind>(r, nameof(DropRate.RewardKind)),
                Chance: ContentModelFixture.Get<decimal>(r, nameof(DropRate.Chance))))
            .Where(d => d.Chance <= 0m || d.Chance > 1m)
            .ToList();

        Assert.True(
            outOfRange.Count == 0,
            "drop_rate values outside (0, 1]: " +
            string.Join(", ", outOfRange.Select(d => $"{d.Encounter}/{d.Reward} = {d.Chance}")));
    }

    /// <summary>
    /// §5.4's last check. Two halves: the move exists, and the piece granting it is a Trinket —
    /// the narrowing DECISIONS 2026-07-26 applied to GDD 3 §4.1's "any Mythic/Divine piece" after
    /// GDD 8 §1 made Weapon/Armor/Accessory pure stat bonuses at every tier.
    /// </summary>
    [Fact]
    public void Gear_granted_moves_exist_and_are_trinket_only()
    {
        var moves = Ids<GearMove>(nameof(GearMove.Id));
        var problems = new List<string>();

        foreach (var row in model.Rows<GearDef>())
        {
            if (!row.TryGetValue(nameof(GearDef.GrantsMoveId), out var raw) || raw is not string move)
            {
                continue;
            }

            var id = ContentModelFixture.Get<string>(row, nameof(GearDef.Id));
            var slot = ContentModelFixture.Get<GearSlot>(row, nameof(GearDef.Slot));

            if (!moves.Contains(move))
            {
                problems.Add($"{id} grants '{move}', which is not a gear_move.");
            }

            if (slot != GearSlot.Trinket)
            {
                problems.Add($"{id} is a {slot} but grants a move — only Trinkets may (GDD 8 §1).");
            }
        }

        Assert.True(problems.Count == 0, string.Join(Environment.NewLine, problems));
    }

    /// <summary>
    /// §5.4's manifest cross-check, and CLAUDE.md's "never invent IDs" made enforceable.
    /// <para>
    /// Deliberately one-directional: every seeded ID must be in the manifest, but not every manifest
    /// ID need be seeded — the manifest also registers audio keys and reserved analytics names that
    /// have no database row and are not supposed to.
    /// </para>
    /// <para>
    /// Entity selection is by shape rather than by an explicit list: any seeded table keyed by a
    /// single string column is manifest-keyed content. That fails *closed* — a content table added
    /// later is covered without anyone remembering to add it here, which is the failure mode this
    /// check exists to prevent.
    /// </para>
    /// </summary>
    [Fact]
    public void Every_seeded_content_id_is_registered_in_the_manifest()
    {
        var unregistered = new List<string>();
        var checkedIds = 0;

        foreach (var entityType in model.SeededEntityTypes())
        {
            var key = entityType.FindPrimaryKey();
            if (key?.Properties is not [{ ClrType: var clr } property] || clr != typeof(string))
            {
                continue;
            }

            foreach (var row in entityType.GetSeedData())
            {
                if (!row.TryGetValue(property.Name, out var value) || value is not string id)
                {
                    continue;
                }

                checkedIds++;

                if (!ManifestKeys.All.Contains(id))
                {
                    unregistered.Add($"{entityType.GetTableName()}.{id}");
                }
            }
        }

        // Guards the heuristic itself: if a model or metadata-API change made the filter above match
        // nothing, every assertion below it would pass vacuously and the check would quietly stop
        // existing. 100 is far under the real count and far over zero.
        Assert.True(checkedIds > 100, $"Only {checkedIds} IDs were checked — the entity filter is wrong.");

        Assert.True(
            unregistered.Count == 0,
            "Seeded IDs absent from docs/traverser-data-manifest.md — add them to the manifest " +
            "first, never the other way round (CLAUDE.md): " + string.Join(", ", unregistered.Order()));
    }

    private HashSet<string> Ids<TEntity>(string property) where TEntity : class =>
        model.Rows<TEntity>()
            .Select(r => ContentModelFixture.Get<string>(r, property))
            .ToHashSet();
}
