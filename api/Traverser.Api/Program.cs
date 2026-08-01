using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Sentry.Extensibility;
using Traverser.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// tech-06 §9. Reads Sentry:Dsn and Sentry:Environment from configuration, which Compose supplies
// as Sentry__Dsn / Sentry__Environment (§4.1). An empty DSN disables the SDK entirely — that is the
// supported "no account" path, and the dev loop must keep working without one.
//
// The server is instrumented at all because the client cannot report server failures: tech-04 §8.1
// makes a failing API indistinguishable from success on the phone by design, so a 500 inside
// POST /sync is invisible from the client side (§9.2).
builder.WebHost.UseSentry(options =>
{
    // ↯ An *absent* DSN is not the same as an empty one: the SDK throws "You must supply a DSN"
    // on null and only treats "" as "disabled". Compose always passes the key (`${Sentry__Dsn:-}`)
    // so the container is fine either way, but on the host it is simply not configured — which
    // made `dotnet ef` and `dotnet run` fail outright. Normalising to empty here is what makes
    // §4.1's "blank is valid and disables capture" true everywhere rather than only in Docker.
    options.Dsn = builder.Configuration["Sentry:Dsn"] ?? string.Empty;

    // ↯ Both of these are already the SDK defaults, and both are set explicitly because §9.3
    // requires it rather than as belt-and-braces: sync payloads carry step counts and heart-rate
    // minutes, which is health data, and "we rely on the default" is not a decision that survives
    // an SDK upgrade. SendDefaultPii would attach request URL, headers, IP, and user identity;
    // MaxRequestBodySize governs the body itself and is gated behind SendDefaultPii as well.
    options.SendDefaultPii = false;
    options.MaxRequestBodySize = RequestSize.None;

    // No performance tracing — the analytics trim stands (§9.3). This is errors only.
    options.TracesSampleRate = 0.0;
});

builder.Services.AddOpenApi();

// snake_case on the wire, so payload fields match tech-01's column names 1:1 and a request body
// can be read against the schema with no mental mapping (tech-02 §2). Built into System.Text.Json;
// no custom converter. ConfigureHttpJsonOptions is the minimal-API surface specifically —
// AddControllers().AddJsonOptions() configures a different options instance and would not apply.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

// UseSnakeCaseNamingConvention is not optional — without it EF creates PlayerItem/ItemDefId
// tables and columns, and every query written against tech-01's schema breaks (tech-01 §2, §7).
// Migrations are never run here: they are an explicit command (tech-06 §1.6/§5.1), because a
// machine that sleeps mid-migration would leave a half-applied schema on the only copy of the
// fitness history.
builder.Services.AddDbContext<TraverserDbContext>(options => options
    .UseNpgsql(builder.Configuration.GetConnectionString("Traverser"))
    .UseSnakeCaseNamingConvention()
    // content_version.id is `int primary key default 1 check (id = 1)` by design (tech-01 §3) —
    // a store default on a key column is exactly what EF warns about, and exactly what a
    // single-row table wants.
    .ConfigureWarnings(w => w.Ignore(RelationalEventId.ModelValidationKeyDefaultValueWarning)));

var app = builder.Build();

// tech-06 §5.2 — the counterweight to §5.1's "migrations are an explicit command". Taking
// migrations out of startup is only safe if forgetting to run them is loud, so the API asserts
// the schema it finds is the schema it was built against and refuses to serve otherwise.
// This asserts and never applies: §1.6 rules out Migrate()/EnsureCreated() here, because this
// host sleeps on a power button and a half-applied migration on the only copy of the fitness
// history is materially worse than an API that will not start.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

    var expected = db.Database.GetMigrations().ToHashSet();
    var applied = (await db.Database.GetAppliedMigrationsAsync()).ToHashSet();

    // Both directions matter. `missing` is the everyday case — a migration was scaffolded and
    // `dotnet ef database update` was never run. `unknown` is rarer and nastier: the database is
    // ahead of the binary, so rolling back the API without rolling back the schema is caught here
    // instead of as a column-not-found from deep inside a query.
    var missing = expected.Except(applied).Order().ToList();
    var unknown = applied.Except(expected).Order().ToList();

    if (missing.Count > 0 || unknown.Count > 0)
    {
        var detail = string.Join("; ", new[]
        {
            missing.Count > 0 ? $"not applied: {string.Join(", ", missing)}" : null,
            unknown.Count > 0 ? $"applied but unknown to this build: {string.Join(", ", unknown)}" : null,
        }.OfType<string>());

        var failure = new InvalidOperationException(
            $"Database schema does not match this build ({detail}). " +
            "Run: dotnet ef database update --project api/Traverser.Api");

        // §9.2 names this failure specifically. It has to be captured by hand: Sentry's ASP.NET
        // Core integration reports unhandled exceptions from the *request pipeline*, and this
        // throws during startup, before there is one — so left alone it would be the one failure
        // the spec asks for and the only one that never arrives. Flush explicitly for the same
        // reason: the process is about to die and the SDK's background sender would die with it.
        SentrySdk.CaptureException(failure);
        await SentrySdk.FlushAsync(TimeSpan.FromSeconds(5));

        throw failure;
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ↯ No UseHttpsRedirection. TLS terminates at `tailscale serve` on the host and the container
// speaks plain HTTP on 8080 (tech-06 §1.2, §3.5), so redirecting here would send the client to a
// port nothing is listening on. This is the inverse of the usual end-to-end-HTTPS instinct.

// tech-02 §3 — the client polls this at the start of every sync and fetches /content/bundle only
// when the number moved. Unauthenticated for now: tech-02 §1.4's bearer token has no storage
// until the amended `auth_token` table is built, and this returns one integer about seeded
// content, not player data. Revisit when registration lands.
app.MapGet("/api/v1/content/version", async (TraverserDbContext db, CancellationToken ct) =>
{
    var version = await db.ContentVersions
        .AsNoTracking()
        .Select(c => c.Version)
        .SingleAsync(ct);

    return Results.Ok(new ContentVersionResponse(version));
});

app.Run();

/// <summary>
/// tech-02 §3 calls this "a single integer", but it ships as a one-member object: everything on
/// tech-02's wire is a snake_case JSON body, and a bare scalar has nowhere to grow if the bundle
/// poll ever needs to carry a second field.
/// </summary>
internal sealed record ContentVersionResponse(int ContentVersion);
