using Traverser.Api.Data;
using Traverser.Api.Data.Entities;

namespace Traverser.Tests.Seed;

/// <summary>GDD 12's text: every enemy has the beats its role calls for (§2), and only those.</summary>
[Collection(ContentModelCollection.Name)]
public class LoreSeedTests(ContentModelFixture model)
{
    private static string? Text(IDictionary<string, object?> row, string property) => row[property] as string;

    private static int Lines(string text) => text.Split('\n').Length;

    [Fact]
    public void Every_wild_enemy_has_flavour_and_no_dialogue()
    {
        var wild = model.Rows<Enemy>().Where(r => (EnemyRole)r[nameof(Enemy.Role)]! == EnemyRole.Wild).ToList();

        Assert.Equal(6, wild.Count);
        Assert.All(wild, row =>
        {
            Assert.False(string.IsNullOrWhiteSpace(Text(row, nameof(Enemy.Flavor))), $"{row[nameof(Enemy.Id)]} has no flavour.");
            Assert.Null(Text(row, nameof(Enemy.Intro)));
            Assert.Null(Text(row, nameof(Enemy.DefeatFirst)));
            Assert.Null(Text(row, nameof(Enemy.DefeatRepeat)));
        });
    }

    /// <summary>§2's lengths: a two-line intro and first-kill text, and a one-line repeat.</summary>
    [Fact]
    public void Every_boss_has_an_intro_a_first_kill_and_a_one_line_repeat()
    {
        var bosses = model.Rows<Enemy>()
            .Where(r => (EnemyRole)r[nameof(Enemy.Role)]! is EnemyRole.MidBoss or EnemyRole.ZoneBoss)
            .ToList();

        Assert.Equal(6, bosses.Count);
        Assert.All(bosses, row =>
        {
            Assert.Null(Text(row, nameof(Enemy.Flavor)));
            Assert.Equal(2, Lines(Text(row, nameof(Enemy.Intro))!));
            Assert.Equal(2, Lines(Text(row, nameof(Enemy.DefeatFirst))!));
            Assert.Equal(1, Lines(Text(row, nameof(Enemy.DefeatRepeat))!));
        });
    }

    [Fact]
    public void The_tutorial_wisp_has_no_lore()
    {
        var wisp = model.Rows<Enemy>().Single(r => (string)r[nameof(Enemy.Id)]! == "enemy_waystone_wisp");

        Assert.Null(Text(wisp, nameof(Enemy.Flavor)));
        Assert.Null(Text(wisp, nameof(Enemy.Intro)));
    }

    /// <summary>
    /// §2: a narrative follows a final boss's first defeat, so each zone a final-boss gate opens has
    /// four screens. Olympion has none, and the unreleased Egypt zone has none either (§4.3).
    /// </summary>
    [Fact]
    public void Each_zone_a_final_boss_opens_has_a_four_screen_narrative()
    {
        var opened = model.Rows<ZoneGate>()
            .Select(r => r[nameof(ZoneGate.UnlocksZoneId)] as string)
            .OfType<string>()
            .ToHashSet();

        var narratives = model.Rows<Zone>().ToDictionary(
            r => (string)r[nameof(Zone.Id)]!,
            r => r.TryGetValue(nameof(Zone.EntryNarrative), out var value) ? value as string[] : null);

        Assert.Equal(["imperion", "valheon"], narratives.Where(kv => kv.Value is not null).Select(kv => kv.Key).Order());
        Assert.All(narratives.Where(kv => kv.Value is not null), kv => Assert.Equal(4, kv.Value!.Length));
        Assert.Contains("valheon", opened);
        Assert.Contains("imperion", opened);
    }
}
