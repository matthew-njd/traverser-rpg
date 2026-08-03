using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Traverser.Api.Data;

// ↯ Namespace is `Endpoints`, not `Api`. A `Traverser.Tests.Api` namespace shadows `Traverser.Api`
// for every file under `Traverser.Tests`, so `Seed/SeedIntegrityTests.cs`'s existing relative
// `Api.Data.Entities.Zone` reference silently stopped resolving. C# walks outward from the current
// namespace when binding the first identifier, so the nearer `Tests.Api` wins — the error names the
// innocent file, not the new one that caused it.
namespace Traverser.Tests.Endpoints;

/// <summary>
/// Drives the real HTTP pipeline against a throwaway Postgres.
/// <para>
/// ↯ A disposable container rather than the dev database, and that is the whole point rather than
/// fastidiousness: from M1 the dev volume holds real, unreproducible fitness history (tech-06
/// §10.7), and a test suite that creates and drops databases beside it is one typo away from being
/// the thing the backup job exists to recover from. Docker is already a prerequisite for running
/// the stack at all, so this costs no new dependency at the machine level.
/// </para>
/// <para>
/// Pinned to the same <c>postgres:18-alpine</c> as <c>docker-compose.yml</c>. Testing against a
/// different major than production runs would make the suite's agreement with reality a
/// coincidence — and the 18 pin is deliberate there (tech-06 §2).
/// </para>
/// </summary>
public sealed class TraverserApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18-alpine")
        .WithDatabase("traverser_test")
        .WithUsername("traverser_test")
        .WithPassword("traverser_test")
        .Build();

    /// <summary>Deserialization mirrors the server's own policy (tech-02 §2).</summary>
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = false,
    };

    // ↯ Explicit interface implementations. xunit's IAsyncLifetime declares `Task DisposeAsync()`
    // and WebApplicationFactory declares `ValueTask DisposeAsync()` — two methods with one name and
    // different return types, which C# will not let a class declare implicitly. Implementing
    // xunit's explicitly keeps both, and makes the base call below deliberate rather than lost.
    async Task IAsyncLifetime.InitializeAsync()
    {
        await _postgres.StartAsync();

        // ↯ Migrated through a standalone DbContext rather than one resolved from `Services`, and
        // that is forced rather than stylistic: touching `Services` is what *starts the host*, and
        // Program.cs asserts on boot that every migration it knows about is applied, refusing to
        // serve otherwise (tech-06 §5.2). Against a virgin container that assertion fires first and
        // every test in the suite dies during fixture setup, naming schema drift that has nothing to
        // do with what was being tested.
        //
        // The cost is that the three provider options below are a second copy of Program.cs's
        // AddDbContext call and can drift from it. The naming convention is the one that would hurt
        // — without it EF builds PlayerItem/ItemDefId names and the migrations would target a
        // different schema than the app reads (tech-01 §2).
        //
        // MigrateAsync rather than EnsureCreated: the seeded content ships inside the migrations as
        // HasData, so this is also the only way the content rows come to exist. It doubles as proof
        // that the migration chain applies cleanly to an empty database.
        var options = new DbContextOptionsBuilder<TraverserDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.ModelValidationKeyDefaultValueWarning))
            .Options;

        await using var db = new TraverserDbContext(options);

        await db.Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        // Host first, container second: the host holds an Npgsql pool against it.
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:Traverser"] = _postgres.GetConnectionString(),

                // Explicit rather than inherited. An empty DSN disables capture (tech-06 §4.1), and
                // the alternative is a test run quietly shipping its own failures to the real
                // project's issue stream.
                ["Sentry:Dsn"] = string.Empty,
            }));

    /// <summary>A scope onto the same database the API is using, for asserting on stored rows.</summary>
    public AsyncServiceScope NewScope() => Services.CreateAsyncScope();

    /// <summary>
    /// Registers a fresh player and returns its id and token. Most tests need an authenticated
    /// caller and do not care how it was obtained.
    /// </summary>
    public async Task<(Guid PlayerId, string Token)> RegisterAsync(
        string name = "Matthew",
        string timezone = "America/New_York")
    {
        var playerId = Guid.NewGuid();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/players",
            new { player_id = playerId, traverser_name = name, timezone },
            Json);

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);

        return (playerId, body.GetProperty("token").GetString()!);
    }

    /// <summary>An <see cref="HttpClient"/> that presents the given bearer token on every request.</summary>
    public HttpClient CreateAuthenticatedClient(string token)
    {
        var client = CreateClient();

        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        return client;
    }
}

/// <summary>
/// One container and one host for the whole API suite. Per-class fixtures would start a fresh
/// Postgres for every test class, which turns a fast suite into a slow one for isolation the tests
/// get anyway by registering their own players.
/// </summary>
[CollectionDefinition(Name)]
public sealed class TraverserApiCollection : ICollectionFixture<TraverserApiFixture>
{
    public const string Name = "TraverserApi";
}
