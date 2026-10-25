using System.Net.Http.Json;
using System.Text.Json;

namespace Traverser.Tests.Endpoints;

/// <summary>
/// T2 §4 <b>step 11</b> — GDD 11 §8's threshold, once per session. Whether the banner shows is the
/// device's call (T3 §9), so a closed session is tested on the client.
/// </summary>
[Collection(TraverserApiCollection.Name)]
public class OveractivityTests(TraverserApiFixture api)
{
    private static object Session(string key, int tier1, int tier2 = 0, int tier3 = 0) => new
    {
        external_session_id = key,
        started_at = DateTime.UtcNow.AddHours(-2),
        ended_at = (DateTime?)null,
        activity_date = new DateOnly(2026, 10, 25),
        tier1_minutes = tier1,
        tier2_minutes = tier2,
        tier3_minutes = tier3,
    };

    private static async Task<string[]> WarnedAsync(HttpClient client, params object[] sessions)
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/sync", new { deltas = Array.Empty<object>(), content_version = 2, sessions }, TraverserApiFixture.Json);

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TraverserApiFixture.Json);

        return [.. body.GetProperty("warnings").EnumerateArray()
            .Where(w => w.GetProperty("code").GetString() == "overactivity")
            .Select(w => w.GetProperty("session_id").GetString()!)];
    }

    private async Task<HttpClient> ClientAsync() => api.CreateAuthenticatedClient((await api.RegisterAsync()).Token);

    /// <summary>All three tiers count, so 30 + 30 + 29 is 89.</summary>
    [Fact]
    public async Task Fires_at_90_tier_one_plus_minutes_and_not_at_89()
    {
        var client = await ClientAsync();

        Assert.Empty(await WarnedAsync(client, Session("hr:100", 30, 30, 29)));
        Assert.Equal(["hr:100"], await WarnedAsync(client, Session("hr:100", 30, 30, 30)));
    }

    [Fact]
    public async Task Fires_once_per_session_however_long_it_grows()
    {
        var client = await ClientAsync();

        Assert.Equal(["hr:200"], await WarnedAsync(client, Session("hr:200", 95)));
        Assert.Empty(await WarnedAsync(client, Session("hr:200", 140)));
    }

    /// <summary>GDD 11 §8.3 — a new session resets eligibility.</summary>
    [Fact]
    public async Task A_second_long_session_fires_again()
    {
        var client = await ClientAsync();

        Assert.Equal(["hr:300"], await WarnedAsync(client, Session("hr:300", 90)));
        Assert.Equal(["hr:400"], await WarnedAsync(client, Session("hr:300", 90), Session("hr:400", 91)));
    }
}
