using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Traverser.Api.Contracts;
using Traverser.Api.Data;

namespace Traverser.Api.Endpoints;

/// <summary>
/// Builds the authoritative player snapshot. Shared so that <c>GET /players/me</c>, <c>POST /sync</c>
/// and the progression writes all return the <em>same</em> document — the client replaces its mirror
/// from whichever arrives last, so two endpoints disagreeing about the shape would be a mirror that
/// changes depending on which call refreshed it.
/// </summary>
internal static class PlayerProfile
{
    /// <summary>
    /// One round trip. The 1:1 tables hang off <c>player</c> without inverse navigations (tech-01
    /// splits them so preference writes never contend with progression writes), so they are
    /// correlated subqueries rather than <c>Include</c>s.
    /// </summary>
    public static async Task<PlayerProfileResponse?> LoadAsync(
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
