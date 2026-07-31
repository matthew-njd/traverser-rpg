using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Traverser.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.Run();
