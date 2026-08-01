using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Traverser.Api.Data;

namespace Traverser.Tests.Seed;

/// <summary>
/// Builds the EF model once and exposes the <c>HasData</c> rows it carries.
/// <para>
/// These tests read the seed out of the model rather than out of a database on purpose: the seed is
/// part of the model, so no Postgres needs to be running to check it, and a failure points at the
/// seed rather than at whatever happens to be in a developer's local volume.
/// </para>
/// </summary>
public sealed class ContentModelFixture : IDisposable
{
    private readonly TraverserDbContext _context;

    /// <summary>
    /// The design-time model, not <c>DbContext.Model</c>: the runtime model is read-optimized and
    /// drops <c>HasData</c> rows, since nothing at runtime needs them. This is the same model the
    /// migration scaffolder reads, so these tests check exactly what gets written.
    /// </summary>
    private readonly IModel _model;

    public ContentModelFixture()
    {
        // Npgsql is required for the model to build (the provider owns the type mappings), but no
        // connection is ever opened — nothing here touches the database.
        var options = new DbContextOptionsBuilder<TraverserDbContext>()
            .UseNpgsql("Host=localhost;Database=traverser_model_only")
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.ModelValidationKeyDefaultValueWarning))
            .Options;

        _context = new TraverserDbContext(options);
        _model = _context.GetService<IDesignTimeModel>().Model;
    }

    /// <summary>The seeded rows for one entity, as property-name → value maps.</summary>
    public IReadOnlyList<IDictionary<string, object?>> Rows<TEntity>() where TEntity : class
    {
        var entityType = _model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not in the model.");

        return [.. entityType.GetSeedData()];
    }

    /// <summary>Every entity type that carries <c>HasData</c> rows.</summary>
    public IEnumerable<IEntityType> SeededEntityTypes() =>
        _model.GetEntityTypes().Where(e => e.GetSeedData().Any());

    /// <summary>One required column of one seeded row, cast to <typeparamref name="T"/>.</summary>
    public static T Get<T>(IDictionary<string, object?> row, string property)
    {
        if (!row.TryGetValue(property, out var value))
        {
            throw new InvalidOperationException($"Seed row has no '{property}' column.");
        }

        return value is T typed
            ? typed
            : throw new InvalidOperationException(
                $"Seed column '{property}' is {value?.GetType().Name ?? "null"}, expected {typeof(T).Name}.");
    }

    /// <summary>One nullable column of one seeded row.</summary>
    public static T? GetNullable<T>(IDictionary<string, object?> row, string property) where T : struct =>
        row.TryGetValue(property, out var value) && value is T typed ? typed : null;

    public void Dispose() => _context.Dispose();
}

[CollectionDefinition(Name)]
public sealed class ContentModelCollection : ICollectionFixture<ContentModelFixture>
{
    public const string Name = "content-model";
}
