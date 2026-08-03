using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Traverser.Api.Auth;
using Traverser.Api.Contracts;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;
using Traverser.Api.Http;

namespace Traverser.Api.Endpoints;

/// <summary>Identity and the authoritative profile snapshot (tech-02 §3, Identity).</summary>
public static class PlayerEndpoints
{
    /// <summary>GDD 10 §5.1 — the naming screen's own limit, enforced server-side too because a
    /// `text` column would otherwise accept a megabyte.</summary>
    private const int MaxTraverserNameLength = 20;

    /// <summary>
    /// Level 1 base Vigor (GDD 2 §6's "base Vigor pool of 20"). Max Vigor is the effective Vigor
    /// stat — base + allocation + gear — so at registration, with neither, current Vigor starts at
    /// exactly the base. Base stats stay code constants rather than data so a rebalance is a deploy
    /// and not a migration (tech-01 §2); they get a shared home when P4 brings the XP maths in.
    /// </summary>
    private const int Level1BaseVigor = 20;

    /// <summary>Postgres <c>unique_violation</c>.</summary>
    private const string UniqueViolation = "23505";

    /// <summary>Registration — the one endpoint that cannot be behind the auth filter.</summary>
    public static void MapRegistration(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/players", RegisterAsync)
            .WithName("RegisterPlayer")
            .WithSummary("Create or re-attach to the guest profile for a client-minted player_id.");
    }

    public static void MapPlayerReads(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/players/me", GetMeAsync)
            .WithName("GetCurrentPlayer")
            .WithSummary("The full authoritative snapshot; the local mirror's repair path.");
    }

    /// <summary>
    /// ↯ Idempotent on the client-minted <c>player_id</c>: re-registering returns the existing
    /// profile rather than 409, so a response lost on a flaky tailnet link cannot strand a device
    /// that has already been created server-side (tech-02 §3).
    /// <para>
    /// One deviation from §3's wording, forced by tech-01's schema: it says re-registering returns
    /// "the existing profile <em>and token</em>", but only the token's SHA-256 is stored, so the
    /// original is unrecoverable by construction. A fresh token is minted instead and the old rows
    /// are left alone — which is what <c>auth_token</c>'s own note already anticipates when it
    /// allows multiple live rows per player for exactly this reinstall case.
    /// </para>
    /// </summary>
    private static async Task<IResult> RegisterAsync(
        RegisterPlayerRequest request,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.PlayerId == Guid.Empty)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "player_id must be a non-empty UUID.");
        }

        var name = (request.TraverserName ?? string.Empty).Trim();

        if (name.Length is 0 or > MaxTraverserNameLength)
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                $"traverser_name must be 1-{MaxTraverserNameLength} characters.");
        }

        // Rejected rather than stored blindly: the timezone is what tech-01 says derives the local
        // calendar date, and a typo would put the day boundary in the wrong place for every
        // activity_day that follows — silently, and only for that player.
        if (string.IsNullOrWhiteSpace(request.Timezone) || !TimeZoneInfo.TryFindSystemTimeZoneById(request.Timezone, out _))
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                "timezone must be a recognised IANA zone identifier, e.g. 'America/New_York'.");
        }

        var created = false;
        var player = await db.Players.FirstOrDefaultAsync(p => p.Id == request.PlayerId, ct);

        if (player is null)
        {
            player = NewPlayer(request.PlayerId, name, request.Timezone);

            db.Players.Add(player);
            db.PlayerSettings.Add(new PlayerSettings { PlayerId = player.Id });
            db.StreakStates.Add(new StreakState { PlayerId = player.Id });

            // tech-02 §3 names this explicitly. Only *zone* entry is recorded — gate state is
            // derived from lifetime_steps and the bestiary on every read (tech-01), so there is
            // nothing else to seed.
            db.PlayerZoneProgress.Add(new PlayerZoneProgress { PlayerId = player.Id, ZoneId = "olympion" });

            try
            {
                await db.SaveChangesAsync(ct);
                created = true;
            }
            catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: UniqueViolation })
            {
                // Two registrations for the same player_id raced — the retry that the idempotency
                // rule exists for, arriving twice concurrently. The loser drops its insert and
                // proceeds as if it had found the row, which is the same answer either way.
                db.ChangeTracker.Clear();

                player = await db.Players.FirstAsync(p => p.Id == request.PlayerId, ct);
            }
        }

        // Minted on every call, including the idempotent replay. The caller has no other way to
        // obtain one, and a replay is overwhelmingly a device that lost the first response and
        // therefore has no usable token.
        var token = GuestToken.Mint();

        db.AuthTokens.Add(new AuthToken { TokenHash = GuestToken.Hash(token), PlayerId = player.Id });

        await db.SaveChangesAsync(ct);

        var profile = await LoadProfileAsync(db, player.Id, ct)
            ?? throw new InvalidOperationException($"Profile for {player.Id} vanished during registration.");

        var response = new RegisterPlayerResponse(token, profile);

        // 201 on a genuine create, 200 on the idempotent replay. Nothing on the client branches on
        // this, but it is the difference between "your first attempt failed" and "your first
        // attempt worked and you missed the answer", which is worth being able to see in a log.
        return created
            ? Results.Json(response, statusCode: StatusCodes.Status201Created)
            : Results.Ok(response);
    }

    private static async Task<IResult> GetMeAsync(
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        var profile = await LoadProfileAsync(db, current.PlayerId, ct);

        // A live token whose player is gone means the cascade did not fire or the row was deleted
        // by hand. 401 rather than 404: the credential is what has stopped being valid.
        return profile is null
            ? ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.")
            : Results.Ok(profile);
    }

    private static Player NewPlayer(Guid id, string name, string timezone) => new()
    {
        Id = id,
        TraverserName = name,
        Timezone = timezone,

        // created_at is left unset on purpose — the column carries a `now()` store default, and EF
        // omits a property still holding its CLR default, so the database supplies one clock rather
        // than two disagreeing about it.

        // The two columns with no store default, both needing a real value at insert.
        VigorCurrent = Level1BaseVigor,
        VigorAnchorAt = DateTime.UtcNow,
    };

    /// <summary>
    /// One round trip. The 1:1 tables hang off <see cref="Player"/> without inverse navigations
    /// (tech-01's split keeps preference writes from contending with progression writes), so they
    /// are correlated subqueries rather than <c>Include</c>s.
    /// </summary>
    private static async Task<PlayerProfileResponse?> LoadProfileAsync(
        TraverserDbContext db,
        Guid playerId,
        CancellationToken ct)
    {
        var row = await db.Players
            .AsNoTracking()
            .Where(p => p.Id == playerId)
            .Select(p => new
            {
                Player = p,
                Settings = db.PlayerSettings.FirstOrDefault(s => s.PlayerId == p.Id),
                Streak = db.StreakStates.FirstOrDefault(s => s.PlayerId == p.Id),
                XpToNext = db.XpCurve.Where(x => x.Level == p.Level).Select(x => x.XpToNext).FirstOrDefault(),
                ZoneIds = db.PlayerZoneProgress.Where(z => z.PlayerId == p.Id).Select(z => z.ZoneId).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            return null;
        }

        // ↯ Loud rather than defaulted. Registration writes all three rows in one transaction, so a
        // player without settings or streak state is corruption — and this document is what the
        // client overwrites its mirror with, so inventing plausible defaults here would launder a
        // broken row into the device's idea of truth.
        if (row.Settings is null || row.Streak is null)
        {
            throw new InvalidOperationException(
                $"Player {playerId} is missing its settings or streak_state row.");
        }

        var p = row.Player;

        return new PlayerProfileResponse(
            Player: new PlayerStateResponse(
                PlayerId: p.Id,
                TraverserName: p.TraverserName,
                Timezone: p.Timezone,
                CreatedAt: p.CreatedAt,
                Level: p.Level,
                XpCurrent: p.XpCurrent,
                XpToNext: row.XpToNext,
                XpLifetime: p.XpLifetime,
                UnspentStatPoints: p.UnspentStatPoints,
                AllocVigor: p.AllocVigor,
                AllocMight: p.AllocMight,
                AllocResolve: p.AllocResolve,
                AllocFavor: p.AllocFavor,
                AllocAegis: p.AllocAegis,
                AllocStride: p.AllocStride,
                VigorCurrent: p.VigorCurrent,
                LifetimeSteps: p.LifetimeSteps,
                DailyStepGoal: p.DailyStepGoal,
                TutorialCompletedAt: p.TutorialCompletedAt),

            // **This is the Waymarker** — Leagues are lifetime_steps / 1000, derived on read
            // (GDD 9 §2.1). Storing them would create two numbers that can disagree.
            Leagues: p.LifetimeSteps / 1000,

            Streak: new StreakResponse(row.Streak.CurrentStreak, row.Streak.LongestStreak, row.Streak.LastCreditedDate),

            Settings: new PlayerSettingsResponse(
                DailyReminderTime: row.Settings.DailyReminderTime,
                MusicVolume: Decimal2(row.Settings.MusicVolume),
                SfxVolume: Decimal2(row.Settings.SfxVolume),
                BirthYear: row.Settings.BirthYear),

            UnlockedZoneIds: row.ZoneIds);
    }

    /// <summary>Fixed scale and invariant culture — a comma decimal separator would be a wire break.</summary>
    private static string Decimal2(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);
}
