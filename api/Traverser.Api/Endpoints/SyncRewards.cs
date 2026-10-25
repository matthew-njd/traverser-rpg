using Microsoft.EntityFrameworkCore;
using Traverser.Api.Contracts;
using Traverser.Api.Data;
using Traverser.Api.Data.Entities;
using Traverser.Api.Progression;

namespace Traverser.Api.Endpoints;

/// <summary>
/// T2 §4 step 10 — the daily-goal item, level milestones, streak milestones and zone entries.
/// <para>
/// ↯ **The <c>milestone_grant</c> insert is the only permission slip.** Every candidate is re-offered
/// on every sync, and a reward materialises only when its insert reports a row. Nothing here keys off
/// "did this sync already run" or the delta set, so a replay grants nothing and a milestone reached
/// before this step existed is still paid once.
/// </para>
/// </summary>
internal static class SyncRewards
{
    private static readonly GearSlot[] StatSlots = [GearSlot.Weapon, GearSlot.Armor, GearSlot.Accessory];

    public static async Task<(List<RewardResponse> Granted, List<PendingRewardResponse> Pending)> GrantAsync(
        TraverserDbContext db,
        Player player,
        IReadOnlyList<DateOnly> touchedDates,
        IRandomSource rng,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var granted = new List<RewardResponse>();

        var bonuses = await db.GearTierBonuses.AsNoTracking().ToDictionaryAsync(b => b.Tier, ct);
        var pieces = await db.GearDefs.AsNoTracking()
            .Where(g => g.Slot != GearSlot.Trinket)
            .ToDictionaryAsync(g => (g.Slot, g.Tier), g => g.Id, ct);

        var items = await db.PlayerItems.CountAsync(i => i.PlayerId == player.Id, ct);
        var owned = await db.PlayerGear
            .Where(g => g.PlayerId == player.Id)
            .Select(g => new { g.GearDef.Slot, g.GearDef.Tier })
            .ToListAsync(ct);
        var gear = owned.Count;
        var best = owned
            .Where(g => g.Slot != GearSlot.Trinket)
            .GroupBy(g => g.Slot)
            .ToDictionary(g => g.Key, g => g.Max(x => x.Tier));

        void GiveItem(string itemDefId, ItemSource source)
        {
            if (items >= Rewards.ItemCap)
            {
                Park(new PendingReward { Kind = PendingRewardKind.Item, ItemDefId = itemDefId });
                return;
            }

            var item = new PlayerItem { PlayerId = player.Id, ItemDefId = itemDefId, AcquiredAt = now, Source = source };

            db.PlayerItems.Add(item);
            items++;
            granted.Add(new RewardResponse("item", item.Id, itemDefId, Snake(source), null, null, null, now));
        }

        void GiveGear(GearSlot slot, GearTier tier, string source)
        {
            var bonus = Rewards.GearBonus(bonuses[tier].Rate, bonuses[tier].Flat, player.Level);
            var defId = pieces[(slot, tier)];

            if (gear >= Rewards.GearCap)
            {
                Park(new PendingReward
                {
                    Kind = PendingRewardKind.Gear,
                    GearDefId = defId,
                    LevelAtDrop = player.Level,
                    BonusPrimary = bonus,
                });
                return;
            }

            var piece = new PlayerGear
            {
                PlayerId = player.Id,
                GearDefId = defId,
                LevelAtDrop = player.Level,
                BonusPrimary = bonus,
                AcquiredAt = now,
                Source = source,
            };

            db.PlayerGear.Add(piece);
            gear++;
            // A parked piece is not owned yet, so only a real grant moves the overlap rule.
            best[slot] = best.TryGetValue(slot, out var held) && held > tier ? held : tier;
            granted.Add(new RewardResponse("gear", piece.Id, defId, source, player.Level, bonus, null, now));
        }

        void Park(PendingReward reward)
        {
            reward.PlayerId = player.Id;
            reward.CreatedAt = now;
            db.PendingRewards.Add(reward);
        }

        async Task<bool> Claim(MilestoneKind kind, string key, bool fallback = false) =>
            await db.Database.ExecuteSqlAsync(
                $"""
                 INSERT INTO milestone_grant (player_id, milestone_kind, milestone_key, granted_at, overflow_fallback)
                 VALUES ({player.Id}, {Snake(kind)}, {key}, {now}, {fallback})
                 ON CONFLICT (player_id, milestone_kind, milestone_key) DO NOTHING
                 """,
                ct) == 1;

        // Daily goal — GDD 4 §6.2's common item, and GDD 8 §5.3's independent 25% Mortal piece.
        var goalDays = await db.ActivityDays.AsNoTracking()
            .Where(a => a.PlayerId == player.Id && touchedDates.Contains(a.ActivityDate) && a.GoalMet)
            .Select(a => a.ActivityDate)
            .OrderBy(d => d)
            .ToListAsync(ct);

        if (goalDays.Count > 0)
        {
            var commons = await db.ItemDefs.AsNoTracking()
                .Where(i => i.Rarity == ItemRarity.Common)
                .OrderBy(i => i.Id)
                .Select(i => i.Id)
                .ToListAsync(ct);
            var gearChance = await db.DropRates.AsNoTracking()
                .Where(r => r.EncounterKind == DropEncounterKind.DailyGoal && r.RewardKind == DropRewardKind.Gear)
                .Select(r => (decimal?)r.Chance)
                .SingleOrDefaultAsync(ct) ?? 0m;

            foreach (var day in goalDays)
            {
                if (!await Claim(MilestoneKind.DailyGoal, day.ToString("yyyy-MM-dd")))
                {
                    continue;
                }

                GiveItem(commons[rng.Next(commons.Count)], ItemSource.DailyGoal);

                if ((decimal)rng.NextDouble() < gearChance)
                {
                    GiveGear(StatSlots[rng.Next(StatSlots.Length)], GearTier.Mortal, "daily_goal");
                }
            }
        }

        // Level milestones — every one at or below the current level (GDD 4 §6.3, GDD 8 §5.4).
        var levels = await db.LevelMilestones.AsNoTracking()
            .Where(m => m.Level <= player.Level)
            .OrderBy(m => m.Level)
            .ToListAsync(ct);

        foreach (var milestone in levels)
        {
            if (milestone.RewardKind == MilestoneRewardKind.Item)
            {
                if (await Claim(MilestoneKind.LevelItem, $"{milestone.Level}"))
                {
                    GiveItem(milestone.ItemDefId!, ItemSource.LevelMilestone);
                }
            }
            else if (await Claim(MilestoneKind.LevelGear, $"{milestone.Level}"))
            {
                GiveGear(StatSlots[rng.Next(StatSlots.Length)], milestone.GearTier!.Value, "level_milestone");
            }
        }

        // Streak milestones — every day the longest run has reached, so a run that was later broken
        // still pays what it earned (GDD 11 §5).
        var longest = await db.StreakStates.AsNoTracking()
            .Where(s => s.PlayerId == player.Id)
            .Select(s => s.LongestStreak)
            .SingleAsync(ct);
        var streaks = await db.StreakMilestones.AsNoTracking()
            .Where(m => m.Day <= longest)
            .OrderBy(m => m.Day)
            .ToListAsync(ct);

        foreach (var milestone in streaks)
        {
            var target = Rewards.StreakTarget(milestone.Slot, milestone.Tier, best);

            if (!await Claim(MilestoneKind.StreakDay, $"{milestone.Day}", fallback: target is null))
            {
                continue;
            }

            if (target is { } t)
            {
                GiveGear(t.Slot, t.Tier, "streak_milestone");
            }
            else
            {
                for (var i = 0; i < Rewards.FallbackDrafts; i++)
                {
                    GiveItem(Rewards.FallbackItemId, ItemSource.StreakOverflow);
                }
            }
        }

        // Zone entry — GDD 4 §6.3, from the seeded table, for every zone the player has opened.
        var entries = await db.ZoneEntryRewards.AsNoTracking()
            .Where(r => db.PlayerZoneProgress.Any(z => z.PlayerId == player.Id && z.ZoneId == r.ZoneId))
            .OrderBy(r => r.ZoneId).ThenBy(r => r.ItemDefId)
            .ToListAsync(ct);

        foreach (var zone in entries.GroupBy(r => r.ZoneId))
        {
            if (!await Claim(MilestoneKind.ZoneEntry, zone.Key))
            {
                continue;
            }

            foreach (var reward in zone)
            {
                for (var i = 0; i < reward.Quantity; i++)
                {
                    GiveItem(reward.ItemDefId, ItemSource.ZoneEntry);
                }
            }
        }

        await db.SaveChangesAsync(ct);

        var pending = await db.PendingRewards.AsNoTracking()
            .Where(r => r.PlayerId == player.Id && r.ResolvedAt == null)
            .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            .Select(r => new PendingRewardResponse(
                r.Id, r.Kind == PendingRewardKind.Item ? "item" : "gear",
                r.ItemDefId ?? r.GearDefId!, r.LevelAtDrop, r.BonusPrimary, r.BonusSecondary, r.CreatedAt))
            .ToListAsync(ct);

        return (granted, pending);
    }

    private static string Snake(MilestoneKind kind) => kind switch
    {
        MilestoneKind.LevelItem => "level_item",
        MilestoneKind.LevelGear => "level_gear",
        MilestoneKind.StreakDay => "streak_day",
        MilestoneKind.ZoneEntry => "zone_entry",
        MilestoneKind.Tutorial => "tutorial",
        MilestoneKind.DailyGoal => "daily_goal",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown milestone kind."),
    };

    private static string Snake(ItemSource source) => source switch
    {
        ItemSource.DailyGoal => "daily_goal",
        ItemSource.LevelMilestone => "level_milestone",
        ItemSource.StreakOverflow => "streak_overflow",
        ItemSource.ZoneEntry => "zone_entry",
        _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Not a step 10 source."),
    };
}
