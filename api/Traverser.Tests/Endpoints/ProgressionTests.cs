using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Traverser.Api.Data;

namespace Traverser.Tests.Endpoints;

/// <summary>Allocations, the activity log, and settings (T2 §3).</summary>
[Collection(TraverserApiCollection.Name)]
public class ProgressionTests(TraverserApiFixture api)
{
    private static readonly DateOnly Day1 = new(2026, 8, 1);

    private async Task<HttpClient> ClientWithPointsAsync(Guid playerId, string token, int points)
    {
        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        await db.Players.Where(p => p.Id == playerId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UnspentStatPoints, points));

        return api.CreateAuthenticatedClient(token);
    }

    private static async Task<HttpResponseMessage> AllocateAsync(HttpClient client, Guid operationId, object body) =>
        await client.PostAsJsonAsync("/api/v1/players/me/allocations", body, TraverserApiFixture.Json);

    // ---- Allocations ------------------------------------------------------------------------------

    [Fact]
    public async Task Allocating_moves_points_from_unspent_to_the_stats()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 6);
        var operationId = Guid.CreateVersion7();

        var response = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 2, might = 3, resolve = 0, favor = 0, aegis = 1, stride = 0,
        });

        response.EnsureSuccessStatusCode();

        var player = (await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json))
            .GetProperty("player");

        Assert.Equal(2, player.GetProperty("alloc_vigor").GetInt32());
        Assert.Equal(3, player.GetProperty("alloc_might").GetInt32());
        Assert.Equal(1, player.GetProperty("alloc_aegis").GetInt32());
        Assert.Equal(0, player.GetProperty("unspent_stat_points").GetInt32());
    }

    /// <summary>
    /// ↯ The point of the operation ledger. The write is **additive on the six `alloc_*` columns**,
    /// so a replay that slipped through would not overwrite — it would double. A retry of a request
    /// whose response was lost is the ordinary case on this network (T2 §1.2), not an edge case.
    /// </summary>
    [Fact]
    public async Task Replaying_an_allocation_does_not_apply_it_twice()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 6);
        var operationId = Guid.CreateVersion7();

        var body = new { operation_id = operationId, vigor = 3, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0 };

        await AllocateAsync(client, operationId, body);
        var replay = await AllocateAsync(client, operationId, body);

        // ↯ Zero rows from the ledger insert means already-applied, which is a **success** returning
        // current state — not a 409 (DECISIONS 2026-08-01).
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);

        var player = (await replay.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json))
            .GetProperty("player");

        Assert.Equal(3, player.GetProperty("alloc_vigor").GetInt32());
        Assert.Equal(3, player.GetProperty("unspent_stat_points").GetInt32());
    }

    /// <summary>A replay must not consume a second ledger row either.</summary>
    [Fact]
    public async Task The_operation_ledger_holds_one_row_per_operation()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 9);
        var operationId = Guid.CreateVersion7();

        var body = new { operation_id = operationId, vigor = 1, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0 };

        await AllocateAsync(client, operationId, body);
        await AllocateAsync(client, operationId, body);

        await using var scope = api.NewScope();
        var db = scope.ServiceProvider.GetRequiredService<TraverserDbContext>();

        Assert.Equal(1, await db.ClientOperations.CountAsync(o => o.PlayerId == playerId && o.OperationId == operationId));
    }

    /// <summary>Distinct operation IDs are distinct allocations, even with identical bodies.</summary>
    [Fact]
    public async Task Two_different_operations_both_apply()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 6);

        foreach (var _ in Enumerable.Range(0, 2))
        {
            var operationId = Guid.CreateVersion7();

            await AllocateAsync(client, operationId, new
            {
                operation_id = operationId, vigor = 3, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0,
            });
        }

        var profile = await client.GetFromJsonAsync<JsonElement>("/api/v1/players/me", TraverserApiFixture.Json);

        Assert.Equal(6, profile.GetProperty("player").GetProperty("alloc_vigor").GetInt32());
        Assert.Equal(0, profile.GetProperty("player").GetProperty("unspent_stat_points").GetInt32());
    }

    [Fact]
    public async Task Allocating_more_than_is_unspent_is_rejected()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 3);
        var operationId = Guid.CreateVersion7();

        var response = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 4, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal("insufficient_stat_points", problem.GetProperty("code").GetString());
    }

    /// <summary>
    /// Allocation is one-way — GDD 1 §5 has no respec, and a negative delta would let a caller mint
    /// points by "allocating" −3 into a stat.
    /// </summary>
    [Fact]
    public async Task Negative_allocations_are_rejected()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 6);
        var operationId = Guid.CreateVersion7();

        var response = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 5, might = -3, resolve = 0, favor = 0, aegis = 0, stride = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_all_zero_allocation_is_rejected()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 6);
        var operationId = Guid.CreateVersion7();

        var response = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 0, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// A rejected allocation must not burn its operation ID — otherwise the client's corrected
    /// retry, which reuses that ID, would be swallowed as a replay and silently do nothing.
    /// </summary>
    [Fact]
    public async Task A_rejected_allocation_can_be_retried_with_the_same_operation_id()
    {
        var (playerId, token) = await api.RegisterAsync();
        var client = await ClientWithPointsAsync(playerId, token, 3);
        var operationId = Guid.CreateVersion7();

        var tooMany = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 10, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);

        var corrected = await AllocateAsync(client, operationId, new
        {
            operation_id = operationId, vigor = 3, might = 0, resolve = 0, favor = 0, aegis = 0, stride = 0,
        });

        corrected.EnsureSuccessStatusCode();

        var player = (await corrected.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json))
            .GetProperty("player");

        Assert.Equal(3, player.GetProperty("alloc_vigor").GetInt32());
        Assert.Equal(0, player.GetProperty("unspent_stat_points").GetInt32());
    }

    // ---- Activity log ------------------------------------------------------------------------------

    /// <summary>GDD 13 §3's activity log is reverse-chronological.</summary>
    [Fact]
    public async Task Activity_returns_touched_days_newest_first()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        foreach (var (day, steps) in new[] { (1, 1_000), (2, 2_000), (3, 3_000) })
        {
            await client.PostAsJsonAsync("/api/v1/sync", new
            {
                deltas = new[]
                {
                    new
                    {
                        client_delta_id = Guid.CreateVersion7(),
                        activity_date = new DateOnly(2026, 8, day),
                        source = "steps",
                        steps_delta = steps,
                        minutes_delta = 0,
                        hr_tier = (int?)null,
                        recorded_at = DateTime.UtcNow,
                    },
                },
                content_version = 1,
            }, TraverserApiFixture.Json);
        }

        var days = await client.GetFromJsonAsync<JsonElement>(
            "/api/v1/players/me/activity?from=2026-08-01&to=2026-08-31", TraverserApiFixture.Json);

        var dates = days.EnumerateArray().Select(d => d.GetProperty("activity_date").GetString()).ToList();

        Assert.Equal(["2026-08-03", "2026-08-02", "2026-08-01"], dates);
    }

    [Fact]
    public async Task Activity_excludes_days_outside_the_range()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await client.PostAsJsonAsync("/api/v1/sync", new
        {
            deltas = new[]
            {
                new
                {
                    client_delta_id = Guid.CreateVersion7(),
                    activity_date = Day1,
                    source = "steps",
                    steps_delta = 4_000,
                    minutes_delta = 0,
                    hr_tier = (int?)null,
                    recorded_at = DateTime.UtcNow,
                },
            },
            content_version = 1,
        }, TraverserApiFixture.Json);

        var days = await client.GetFromJsonAsync<JsonElement>(
            "/api/v1/players/me/activity?from=2026-09-01&to=2026-09-30", TraverserApiFixture.Json);

        Assert.Empty(days.EnumerateArray());
    }

    [Theory]
    [InlineData("?from=2026-08-01")]
    [InlineData("?to=2026-08-01")]
    [InlineData("")]
    [InlineData("?from=2026-08-31&to=2026-08-01")]
    [InlineData("?from=2020-01-01&to=2026-08-01")]
    public async Task Malformed_activity_ranges_are_rejected(string query)
    {
        var (_, token) = await api.RegisterAsync();

        var response = await api.CreateAuthenticatedClient(token)
            .GetAsync($"/api/v1/players/me/activity{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Settings -----------------------------------------------------------------------------------

    [Fact]
    public async Task Settings_updates_the_step_goal_and_birth_year()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        var response = await client.PatchAsJsonAsync(
            "/api/v1/players/me/settings",
            new { daily_step_goal = 9_000, birth_year = 1990 },
            TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        var profile = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal(9_000, profile.GetProperty("player").GetProperty("daily_step_goal").GetInt32());
        Assert.Equal(1990, profile.GetProperty("settings").GetProperty("birth_year").GetInt32());
    }

    /// <summary>Null means "leave alone", not "clear" — a partial PATCH must not blank the other field.</summary>
    [Fact]
    public async Task An_omitted_field_is_left_untouched()
    {
        var (_, token) = await api.RegisterAsync();
        var client = api.CreateAuthenticatedClient(token);

        await client.PatchAsJsonAsync("/api/v1/players/me/settings", new { birth_year = 1985 }, TraverserApiFixture.Json);

        var response = await client.PatchAsJsonAsync(
            "/api/v1/players/me/settings", new { daily_step_goal = 8_500 }, TraverserApiFixture.Json);

        var profile = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        Assert.Equal(1985, profile.GetProperty("settings").GetProperty("birth_year").GetInt32());
        Assert.Equal(8_500, profile.GetProperty("player").GetProperty("daily_step_goal").GetInt32());
    }

    /// <summary>GDD 11 §2.1's hard floor, returned as a 400 naming the field rather than a 500 out
    /// of the CHECK constraint.</summary>
    [Theory]
    [InlineData(2_999)]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task A_step_goal_below_the_floor_is_rejected(int goal)
    {
        var (_, token) = await api.RegisterAsync();

        var response = await api.CreateAuthenticatedClient(token).PatchAsJsonAsync(
            "/api/v1/players/me/settings", new { daily_step_goal = goal }, TraverserApiFixture.Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_floor_itself_is_accepted()
    {
        var (_, token) = await api.RegisterAsync();

        var response = await api.CreateAuthenticatedClient(token).PatchAsJsonAsync(
            "/api/v1/players/me/settings", new { daily_step_goal = 3_000 }, TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();
    }

    [Theory]
    [InlineData(1899)]
    [InlineData(2101)]
    public async Task An_out_of_range_birth_year_is_rejected(int year)
    {
        var (_, token) = await api.RegisterAsync();

        var response = await api.CreateAuthenticatedClient(token).PatchAsJsonAsync(
            "/api/v1/players/me/settings", new { birth_year = year }, TraverserApiFixture.Json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/v1/players/me/activity?from=2026-08-01&to=2026-08-02")]
    public async Task Progression_reads_require_a_token(string route)
    {
        var response = await api.CreateClient().GetAsync(route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
