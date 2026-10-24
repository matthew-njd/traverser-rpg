using System.Data;
using Microsoft.EntityFrameworkCore;
using Traverser.Api.Auth;
using Traverser.Api.Contracts;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;
using Traverser.Api.Http;

namespace Traverser.Api.Endpoints;

/// <summary>
/// The progression writes and reads that are not the sync transaction (T2 §3).
/// </summary>
public static class ProgressionEndpoints
{
    /// <summary>GDD 11 §2.1's hard floor, also a CHECK on the column.</summary>
    private const int MinDailyStepGoal = 3000;

    /// <summary>tech-01's <c>ck_player_settings_birth_year</c> bounds.</summary>
    private const int MinBirthYear = 1900;
    private const int MaxBirthYear = 2100;

    /// <summary>
    /// A read this wide is a scan of one player's history; the bound keeps a malformed range from
    /// asking for every row ever written. Comfortably more than the Character screen's log shows.
    /// </summary>
    private const int MaxActivityRangeDays = 400;

    public static void MapProgression(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/players/me/allocations", AllocateAsync)
            .WithName("AllocateStatPoints")
            .WithSummary("Spend unspent stat points; idempotent on the client-generated operation_id.");

        routes.MapGet("/players/me/activity", GetActivityAsync)
            .WithName("GetActivity")
            .WithSummary("activity_day rows for the Character screen's log, newest first.");

        routes.MapPatch("/players/me/settings", UpdateSettingsAsync)
            .WithName("UpdateSettings")
            .WithSummary("Step goal and birth year. Last-write-wins.");

        routes.MapPost("/players/me/rest-days", TagRestDayAsync)
            .WithName("TagRestDay")
            .WithSummary("Tag a local date as a Rest Day; restores Vigor to full (GDD 11 §3.1, GDD 2 §6).");

        routes.MapPut("/players/me/gear/{playerGearId:guid}/equipped", EquipGearAsync)
            .WithName("EquipGear")
            .WithSummary("Wear a piece in its slot, displacing the current one, or unequip it (GDD 8 §2).");
    }

    /// <summary>
    /// GDD 8 §2. Equipping into an occupied slot displaces the occupant rather than failing, so two
    /// queued equips replay in order to the same result the device already shows.
    /// </summary>
    private static async Task<IResult> EquipGearAsync(
        Guid playerGearId,
        EquipGearRequest request,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.VigorAfter < 0)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "vigor_after cannot be negative.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var gear = await db.PlayerGear
            .Include(g => g.GearDef)
            .FirstOrDefaultAsync(g => g.Id == playerGearId && g.PlayerId == current.PlayerId, ct);

        if (gear is null)
        {
            return ApiProblem.Create(
                StatusCodes.Status404NotFound, ApiProblem.GearNotFound, "Not Found", "No such gear for this player.");
        }

        if (request.EquippedSlot is GearSlot slot && slot != gear.GearDef.Slot)
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                $"{gear.GearDefId} fits the {gear.GearDef.Slot} slot, not {slot}.");
        }

        // ↯ Its own statement, before the save: the partial unique index is checked per statement,
        // and EF does not promise to clear the occupant before it sets the newcomer.
        if (request.EquippedSlot is not null)
        {
            await db.PlayerGear
                .Where(g => g.PlayerId == current.PlayerId && g.EquippedSlot == request.EquippedSlot && g.Id != gear.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.EquippedSlot, (GearSlot?)null), ct);
        }

        gear.EquippedSlot = request.EquippedSlot;

        if (request.VigorAfter is int vigor)
        {
            var player = await db.Players.FirstAsync(p => p.Id == current.PlayerId, ct);

            player.VigorCurrent = vigor;
            player.VigorAnchorAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        var profile = await PlayerProfile.LoadAsync(db, current.PlayerId, ct)
            ?? throw new InvalidOperationException($"Profile for {current.PlayerId} vanished mid-equip.");

        await transaction.CommitAsync(ct);

        return Results.Ok(profile);
    }

    /// <summary>
    /// T2 §3 — additive on the six <c>alloc_*</c> columns, so the replay defence cannot be "did this
    /// already apply?" and has to be the operation ledger.
    /// </summary>
    private static async Task<IResult> AllocateAsync(
        AllocateStatPointsRequest request,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.OperationId == Guid.Empty)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "operation_id must be a non-empty UUID.");
        }

        // No un-allocation: GDD 1 §5's allocation is one-way and there is no respec in the design.
        // A negative delta would also let a caller mint points by allocating -3 somewhere.
        if (request.HasNegative)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "stat allocations cannot be negative.");
        }

        if (request.Total == 0)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "allocate at least one point.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // Same lock as the sync transaction, for the same reason and against the same row: an
        // allocation and a sync arriving together both write player, and unspent_stat_points is
        // exactly the column a level-up moves.
        var player = await db.Players
            .FromSql($"SELECT * FROM player WHERE id = {current.PlayerId} FOR UPDATE")
            .FirstOrDefaultAsync(ct);

        if (player is null)
        {
            return ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.");
        }

        // ↯ The ledger insert is the idempotency check — and **zero rows means already-applied,
        // which is a success, not an error** (tech-01's client_operation, DECISIONS 2026-08-01). The
        // caller is a client replaying a write it never saw the answer to; the right response is the
        // player's current state, which is what it would have received the first time.
        var inserted = await db.Database.ExecuteSqlAsync(
            $"""
             INSERT INTO client_operation (player_id, operation_id, endpoint)
             VALUES ({player.Id}, {request.OperationId}, {"POST /players/me/allocations"})
             ON CONFLICT (player_id, operation_id) DO NOTHING
             """,
            ct);

        if (inserted == 1)
        {
            if (request.Total > player.UnspentStatPoints)
            {
                return ApiProblem.BadRequest(
                    ApiProblem.InsufficientStatPoints,
                    $"Requested {request.Total} points but only {player.UnspentStatPoints} are unspent.");
            }

            player.AllocVigor += request.Vigor;
            player.AllocMight += request.Might;
            player.AllocResolve += request.Resolve;
            player.AllocFavor += request.Favor;
            player.AllocAegis += request.Aegis;
            player.AllocStride += request.Stride;
            player.UnspentStatPoints -= request.Total;

            await db.SaveChangesAsync(ct);
        }

        var profile = await PlayerProfile.LoadAsync(db, player.Id, ct)
            ?? throw new InvalidOperationException($"Profile for {player.Id} vanished mid-allocation.");

        await transaction.CommitAsync(ct);

        return Results.Ok(profile);
    }

    /// <summary>
    /// T2 §3 — the Character screen's activity log (GDD 13 §3), newest first.
    /// </summary>
    private static async Task<IResult> GetActivityAsync(
        DateOnly? from,
        DateOnly? to,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (from is null || to is null)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "both 'from' and 'to' are required (YYYY-MM-DD).");
        }

        if (from > to)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "'from' must not be after 'to'.");
        }

        if (to.Value.DayNumber - from.Value.DayNumber >= MaxActivityRangeDays)
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                $"the range must span fewer than {MaxActivityRangeDays} days.");
        }

        // ↯ The range is closed on both ends and the dates are the client's own local calendar dates
        // (T2 §2) — no timezone conversion happens here, because the server never had an opinion
        // about where the player's midnight falls.
        var days = await db.ActivityDays
            .AsNoTracking()
            .Where(a => a.PlayerId == current.PlayerId && a.ActivityDate >= from && a.ActivityDate <= to)
            .OrderByDescending(a => a.ActivityDate)
            .Select(a => new ActivityDayResponse(
                a.ActivityDate, a.Steps, a.Tier1Minutes, a.Tier2Minutes, a.Tier3Minutes,
                a.XpAwarded, a.StepGoalSnapshot, a.GoalMet, a.StreakCreditMethod, a.RestTaggedAt))
            .ToListAsync(ct);

        return Results.Ok(days);
    }

    /// <summary>
    /// T2 §3 / §6.3 — last-write-wins is correct here: these are point-in-time preferences, not
    /// accumulating values, so there is nothing an additive merge would protect.
    /// </summary>
    private static async Task<IResult> UpdateSettingsAsync(
        UpdateSettingsRequest request,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.DailyStepGoal is int goal && goal < MinDailyStepGoal)
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                $"daily_step_goal has a hard floor of {MinDailyStepGoal}.");
        }

        // Checked here so a typo is a 400 naming the field rather than a 500 out of the CHECK
        // constraint. This is a data-sanity bound only — a plausible minimum age belongs on the
        // client at GDD 10's Screen 3.
        if (request.BirthYear is int year && year is < MinBirthYear or > MaxBirthYear)
        {
            return ApiProblem.BadRequest(
                ApiProblem.ValidationFailed,
                $"birth_year must be between {MinBirthYear} and {MaxBirthYear}.");
        }

        var player = await db.Players.FirstOrDefaultAsync(p => p.Id == current.PlayerId, ct);
        var settings = await db.PlayerSettings.FirstOrDefaultAsync(s => s.PlayerId == current.PlayerId, ct);

        if (player is null || settings is null)
        {
            return ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.");
        }

        // ↯ Raising the goal changes future days only. Days already rolled up hold their own
        // step_goal_snapshot and are never revisited (tech-01 §4), so a player who raises the bar
        // cannot un-hit a day they legitimately earned.
        if (request.DailyStepGoal is int newGoal)
        {
            player.DailyStepGoal = newGoal;
        }

        // Changing this re-derives HR thresholds for future reads only — no past day is recomputed
        // (T3 §1.4).
        if (request.BirthYear is int newYear)
        {
            settings.BirthYear = newYear;
        }

        await db.SaveChangesAsync(ct);

        var profile = await PlayerProfile.LoadAsync(db, current.PlayerId, ct)
            ?? throw new InvalidOperationException($"Profile for {current.PlayerId} vanished mid-update.");

        return Results.Ok(profile);
    }

    /// <summary>
    /// GDD 11 §3.1's manual Rest Day tag. Unlimited, uncapped, no explanation asked for — a cap here
    /// would contradict the design constraint the whole section is built on.
    /// <para>
    /// The tag credits the day here; the streak's run is recounted by the next sync's step 9.
    /// </para>
    /// </summary>
    private static async Task<IResult> TagRestDayAsync(
        TagRestDayRequest request,
        CurrentPlayer current,
        TraverserDbContext db,
        CancellationToken ct)
    {
        if (request.VigorAfter < 0)
        {
            return ApiProblem.BadRequest(ApiProblem.ValidationFailed, "vigor_after cannot be negative.");
        }

        var player = await db.Players.FirstOrDefaultAsync(p => p.Id == current.PlayerId, ct);

        if (player is null)
        {
            return ApiProblem.Unauthorized(ApiProblem.InvalidBearerToken, "The player for this token no longer exists.");
        }

        var now = DateTime.UtcNow;
        var day = await db.ActivityDays
            .FirstOrDefaultAsync(a => a.PlayerId == player.Id && a.ActivityDate == request.ActivityDate, ct);

        if (day is null)
        {
            // A rest day with no activity yet is the ordinary case — the row is created for the tag
            // to live on, holding the goal in force today like any other insert (tech-01 §4).
            db.ActivityDays.Add(new ActivityDay
            {
                PlayerId = player.Id,
                ActivityDate = request.ActivityDate,
                StepGoalSnapshot = player.DailyStepGoal,
                RestTaggedAt = now,
                StreakCreditMethod = StreakCreditMethod.RestDayTag,
            });
        }
        else
        {
            day.RestTaggedAt = now;
            day.StreakCreditMethod ??= StreakCreditMethod.RestDayTag;
        }

        // ↯ Vigor is the client's number here, as it is on a battle payload (T5 §1.6). A tag that
        // replays after a battle the same offline session leaves this high until the next battle
        // settles — the device's own mirror applied both in order and is what the player sees.
        player.VigorCurrent = request.VigorAfter;
        player.VigorAnchorAt = now;

        await db.SaveChangesAsync(ct);

        var profile = await PlayerProfile.LoadAsync(db, player.Id, ct)
            ?? throw new InvalidOperationException($"Profile for {player.Id} vanished mid-tag.");

        return Results.Ok(profile);
    }
}
