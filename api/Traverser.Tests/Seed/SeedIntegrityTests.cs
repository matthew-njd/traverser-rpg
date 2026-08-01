using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace Traverser.Tests.Seed;

/// <summary>
/// Guards against ways the seed can be correct in the model but wrong in the database.
/// </summary>
[Collection(ContentModelCollection.Name)]
public class SeedIntegrityTests(ContentModelFixture model)
{
    /// <summary>
    /// A seeded value that equals its CLR default is omitted from the generated <c>InsertData</c>, so
    /// the column's store default writes instead. When the two disagree the database silently gets a
    /// different value than the seed says — which is how <c>zone.egypt_tbd</c> shipped with
    /// <c>is_released = true</c> and unlocked the Map's locked terminus (DECISIONS 2026-08-01).
    /// <para>
    /// The rule this enforces: a seeded column may have a store default only if every seeded row
    /// agrees with it. If a row needs a different value, drop the store default — the seed is the only
    /// writer these content tables have.
    /// </para>
    /// </summary>
    [Fact]
    public void No_seeded_value_is_masked_by_a_conflicting_store_default()
    {
        var conflicts = new List<string>();

        foreach (var entityType in model.SeededEntityTypes())
        {
            // The annotation, not GetDefaultValue(): the latter also reports the CLR default for
            // properties that were never given a store default, which would flag every column.
            var defaults = entityType.GetProperties()
                .Select(p => (
                    Property: p,
                    Default: p.FindAnnotation(RelationalAnnotationNames.DefaultValue)?.Value))
                .Where(x => x.Default is not null)
                .ToList();

            if (defaults.Count == 0)
            {
                continue;
            }

            foreach (var row in entityType.GetSeedData())
            {
                foreach (var (property, storeDefault) in defaults)
                {
                    if (!row.TryGetValue(property.Name, out var seeded) || Equals(seeded, storeDefault))
                    {
                        continue;
                    }

                    conflicts.Add(
                        $"{entityType.GetTableName()}.{property.GetColumnName()} is seeded as " +
                        $"'{seeded}' but the column defaults to '{storeDefault}' — the seeded value " +
                        "may be dropped from InsertData and the default written instead.");
                }
            }
        }

        Assert.True(conflicts.Count == 0, string.Join(Environment.NewLine, conflicts));
    }

    /// <summary>
    /// The regression case in its own right, so a failure names the actual game rule rather than a
    /// generic modelling constraint: GDD 9 §3.1's terminus is data, not a hardcoded special case, and
    /// it is locked.
    /// </summary>
    [Fact]
    public void Egypt_terminus_is_seeded_locked_and_is_the_only_unreleased_zone()
    {
        var zones = model.Rows<Api.Data.Entities.Zone>().ToDictionary(
            r => ContentModelFixture.Get<string>(r, nameof(Api.Data.Entities.Zone.Id)),
            r => ContentModelFixture.Get<bool>(r, nameof(Api.Data.Entities.Zone.IsReleased)));

        Assert.False(zones["egypt_tbd"]);
        Assert.Equal(["egypt_tbd"], zones.Where(z => !z.Value).Select(z => z.Key));
    }
}
