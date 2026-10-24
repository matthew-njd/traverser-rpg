# M4 device drills

**Run:** P7, on the Pixel 9, 2026-10-24. **Status:** COMPLETE — all ten drills run, all eleven exit criteria pass. Six defects found and fixed during the run, two layout packets scheduled for M5, and one balance reading over its ceiling, explained as a seeding artifact (note 8).

> **Vigor first, before every boss fight.** Each boss drill measures what a fight costs, which means it must start from a full bar. The order that works: settle or flee any open fight, then fill the bar (a Rest Day, or `./infra/drill-reset.sh`), then foreground, then **check that the bar on Character reads full before tapping the gate**. A boss fight started below full measures nothing.

**Purpose:** verify the eleven exit criteria in `traverser-m4-plan.md` §5 on hardware, and measure GDD 2 §7's boss ceilings for the first time.

Fill in the **Result** column as you go. Record a failure as a defect, not as a retry. Write anything else you notice in the notes table at the bottom while you see it.

**↯ These drills are written against the build, not against the spec.** Every expected string below was read out of the code that ships at commit `3e05b4d` (P6), and every number out of the server on 2026-10-24.

---

## Before you start

### State on 2026-10-24

Your profile, `Emdir` (`019fd954-0745-7748-9892-ce6f2e600c04`), read from the server:

| Field            | Value                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Level            | 20, with **6 unspent** stat points                                                                                                                                                                                                                   |
| `lifetime_steps` | **217,698** (217 Leagues). Repaired today from 210,896. See DECISIONS 2026-10-24                                                                                                                                                                     |
| Max Vigor        | **34**: base 20, 12 allocated, +2 from the worn Traveler's Band                                                                                                                                                                                      |
| Zones open       | Olympion, Valheon. Valheon was opened by M3's drill 3                                                                                                                                                                                                |
| Streak           | current **3**, best **6**. 2 of 3 grace days used in the rolling 30                                                                                                                                                                                  |
| Gear             | Worn: Traveler's Blade +2, Traveler's Guard +2, Traveler's Band +2. Spare: Warden's Band (Heroic accessory) +4, a second Traveler's Guard +2, Traveler's Band +2, Traveler's Blade +1, and the Skyroad Sigil (a Trinket, which has no slot until M5) |

### Checks

1. Confirm the API answers from the phone. Open `https://workshop.tail465912.ts.net/api/v1/content/version` in the phone's browser. A `401` is the correct answer.
2. Confirm the API is the P6 build. It is if the container was rebuilt after the P5 migrations, which it was on 2026-10-24.

### No rebuild needed

M4 added no native module and no client schema change, so the installed dev build runs P1 to P6 from Metro. Start Metro, with the port fix if the phone shows "Unable to load script":

```
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8081
```

### Seeding distance and restoring it

Drill 8 sets `lifetime_steps` to 900,000. **Restore it from the step ledger, never from a written-down number.** M3 restored a number noted before its seed and erased 6,802 steps synced in between. The ledger always holds every synced step:

```sql
update player
   set lifetime_steps = (select sum(steps_delta) from sync_delta
                          where player_id = '019fd954-0745-7748-9892-ce6f2e600c04')
 where id = '019fd954-0745-7748-9892-ce6f2e600c04';
```

### Refilling Vigor

**Character → Tag today as a Rest Day** restores to full immediately and cannot be raced by a battle. Use it first. It works once per local day, and drill 2 spends today's.

The fallback is the script, run only with no fight open. It now counts the worn Accessory, so it fills to the true max:

```
./infra/drill-reset.sh
```

Foreground the app afterwards, and check the bar reads full **on screen** before fighting. The device owns Vigor, and a battle settling after the reset overwrites it.

---

## Drills

### 1. Gear

Covers exit criteria 1, 2 and 3.

| #    | Step                                                                                      | Expected                                                                                                                                                                                                     | Result |
| ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1.1  | Character → Avatar, scroll to the **Gear** card                                           | Three slots, each headed by its slot and stat: `Weapon · Might`, `Armor · Resolve`, `Accessory · Vigor`. No Trinket slot                                                                                     | PASS   |
| 1.2  | Read the Accessory slot                                                                   | Three pieces: `Traveler's Band · worn` with `+2 Vigor`, a spare `Traveler's Band` with `+2 Vigor · Vigor 34 → 34`, and `Warden's Band` with `+4 Vigor · Vigor 34 → 36`. The unworn two have **Wear** buttons | PASS   |
| 1.3  | Tap **Wear** on Warden's Band                                                             | Warden's Band reads `· worn` and its button reads **Take off**. Traveler's Band loses `· worn` and gains a `Vigor 36 → 34` preview                                                                           | PASS   |
| 1.4  | Read the Vigor card above the Gear card                                                   | The max reads **36**. Current Vigor did **not** rise: wearing a piece adds headroom, and regen fills it                                                                                                      | PASS   |
| 1.5  | Character → Stats                                                                         | Vigor reads 36                                                                                                                                                                                               | PASS   |
| 1.6  | Back to Avatar, tap **Take off** on Warden's Band                                         | The Accessory slot has nothing worn. Max Vigor reads **32**. If current Vigor was above 32, it now reads 32: the clamp (DECISIONS 2026-10-24)                                                                | PASS   |
| 1.7  | Wear Warden's Band again, then pull to sync                                               | Nothing changes on screen. The server agrees, so the profile it returns matches                                                                                                                              | PASS   |
| 1.8  | Tap a waiting encounter to open a fight, then press Android **back** before tapping Begin | You're back on the Road, and the encounter is **still waiting**. Back before Begin cancels an accidental tap                                                                                                 | PASS   |
| 1.8a | Open it again, tap **Begin**, then press **back**                                         | **Nothing happens.** You stay in the fight. Back is swallowed mid-fight                                                                                                                                      | PASS   |
| 1.9  | Force-stop the app and reopen it                                                          | The app returns to the open fight, not to Character                                                                                                                                                          | PASS   |

**About criterion 3.** "Equipping is refused while a battle is open, and says why" was written when Android back could leave a fight open behind Character. P6 closed that exit, so the Gear card's refusal (`A fight is still open. Settle or flee it first.`) cannot be reached from the UI any more. Steps 1.8 and 1.9 verify the stronger guarantee, and `writes.test.ts` keeps the refusal itself covered. Flee or finish the fight before drill 2.

### 2. Vigor on Character

Covers exit criterion 4. **Spends today's Rest Day.**

| #   | Step                            | Expected                                                                                                                                                    | Result |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2.1 | Character → Avatar              | Cards in order: the streak card, **Rest Day**, **Vigor**, **Gear**                                                                                          | PASS   |
| 2.2 | Read the Vigor card             | A bar and `current / max`, with max matching drill 1. Server value this morning: 8                                                                          | PASS   |
| 2.3 | Tap **Tag today as a Rest Day** | The bar fills to max **immediately**, with no network wait. The confirmation reads `Rest tagged. Emdir's strength returns — the road isn't going anywhere.` | PASS   |
| 2.4 | Leave Character and come back   | Still full. The readout is derived from the mirror on focus                                                                                                 | PASS   |

### 3. What a slot and a stat say

Covers exit criteria 5 and 6.

| #   | Step                                         | Expected                                                                                                                                                                                                                                                                                              | Result |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 3.1 | Open any wild fight and read the skill slots | Every filled slot has a second line: `Physical` for a Physical move, `Divine · <type>` for a typed Divine move. No slot's second line is blank                                                                                                                                                        | PASS   |
| 3.2 | Flee, then Character → **Stats**             | Four captions: **Hardiness** above Vigour, **Fierceness** above Might and Favour, **Sturdiness** above Resolve and Aegis, **Quickness** above Stride                                                                                                                                                  | PASS   |
| 3.3 | Read each stat's line                        | Vigor `Your health. Lets you take more hits.` Might `Increases damage of Physical moves, Attack included.` Resolve `Less damage from enemy Physical moves.` Favor `Increases damage of Divine moves.` Aegis `Less damage from enemy Divine moves.` Stride `Turn order. Higher acts first each round.` | PASS   |
| 3.4 | Read the header                              | `6 points to spend`, and steppers beside each stat. The line is readable **before** a point is spent                                                                                                                                                                                                  | PASS   |

Spend the 6 points however you like. Note the split in the Result column, because it changes the boss fights.

### 4. The streak

Covers exit criterion 7. **This drill edits yesterday's row on the server and puts it back.** Run it in one sitting.

| #   | Step                                                              | Expected                                                                                                                                                   | Result                                                                |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 4.1 | Character → Avatar, read the streak card                          | A gold flame and `4`, then `Best 6`. No other line. Four, not three: drill 2's Rest Day credited today                                                     | PASS — read `4`; the sheet first said `3`, written before drill 2 ran |
| 4.2 | Run the **break** statement below, then pull to sync on Character | The flame and `1`, `Best 6`, and one line: `A new road begins today.` One, because today's Rest Day still counts. No red, no "lost", no count of what went | PASS                                                                  |
| 4.3 | Look for anything else                                            | No notification, no banner, no toast. A break writes nothing (GDD 11 §4)                                                                                   | PASS                                                                  |
| 4.4 | Read the Rest Day card                                            | A second button: **Tag yesterday as a Rest Day**                                                                                                           | PASS                                                                  |
| 4.5 | Tap it, then pull to sync                                         | The button disappears. The streak reads `4` again: yesterday counts as rest, and the run carries through it                                                | PASS                                                                  |
| 4.6 | Run the **repair** statement below                                | Yesterday reads as a goal hit again on the server. Nothing changes on screen                                                                               | PASS                                                                  |

```sql
-- Break: yesterday (2026-10-23, Toronto) as a day that met nothing.
update activity_day set goal_met = false, streak_credit_method = null, rest_tagged_at = null
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' and activity_date = '2026-10-23';

-- Repair, after 4.5: the day met its goal, so it reads as it did.
update activity_day set goal_met = steps >= step_goal_snapshot,
       streak_credit_method = 'auto_sync_grace', rest_tagged_at = null
 where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' and activity_date = '2026-10-23';
```

If you run this drill on a later date, change both dates to the day before you run it, and set the repair's credit to whatever that row held before.

### 5. A geared wild fight

Covers exit criterion 10. GDD 2 §7 caps an **ungeared** wild win at 30% of the bar. Gear is meant to do better.

Fight three wild encounters, each from a known Vigor. Read the Vigor card on Character before and after. Cost is `(before − after) / max`.

| #   | Enemy | Before | After | Max | Rounds | Cost | Result (under 30%?) |
| --- | ----- | ------ | ----- | --- | ------ | ---- | ------------------- |
| 5.1 | Satyr | 36 | 28 | 36 | 3 | 22% | PASS |
| 5.2 | Harpy | 28 | 24 | 36 | 2 | 11% | PASS |
| 5.3 | Harpy | 24 | 21 | 36 | 2 | 8% | PASS |

A loss is a data point, not a retry. Record it with its cost.

### 6. A mid-boss: Cyclops

Covers exit criterion 8. Ceiling: **75%** of the bar (GDD 2 §7). **Start from full.**

| #   | Step                                   | Expected                                                                                                                                                               | Result |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.1 | Road → Olympion, read the Cyclops node | `✦ defeated · you may walk on`, and **Face again ›** at the right | PASS |
| 6.2 | Tap it                                 | The Cyclops fight opens. Not a waiting encounter's enemy | PASS |
| 6.3 | Tap **Flee**                           | `There is no leaving this one.` You stay in the fight | PASS |
| 6.4 | Fight it out, noting rounds            | — | PASS |
| 6.5 | Read the victory panel | `The road remembers this.` and Reveal Cards from GDD 8's mid-boss table: the Skyroad Sigil every time (guaranteed Heroic Trinket), Heroic gear 60% of the time, and 1–2 items 75% of the time, all Common or Uncommon. Up to four cards. If they overflow, they scroll and **Continue** stays visible | PASS on the re-run — three cards (Ironhide Tincture, a Heroic weapon +4, Skyroad Sigil), and they scroll. First written as "0–2, the repeat table", which was wrong: see note 4 |
| 6.6 | Record the cost | Before ___ / after ___ / max ___ / rounds ___ / cost ___% | 36 → 25 of 36, 5 rounds, **31%**. Under the 75% ceiling |

### 7. A zone boss: Cerberus

Covers exit criterion 8. Ceiling: **85%**. **Walk first:** Cerberus is at 220 Leagues, and you are at 217. That's **2,302 steps** by the ledger.

**Seeded 2026-10-24:** `lifetime_steps` set to 219,900, then to 220,000 when the walk didn't sync in time. The ledger held 218,127 real steps at the time. Drill 8.9's ledger restore undoes the seed.

**↯ This fight rolls Cerberus's first-kill table again.** The server has Cerberus beaten once (M3's drill 3), but the phone's bestiary lost that row at M3's restore, and the drop table is chosen from the phone's bestiary. Expect first-kill drops. That's M3 note (c), not a P6 defect.

| #   | Step                                                  | Expected                                                                       | Result |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| 7.1 | After the walk, foreground and read the Cerberus node | `◈ ready to face · the road stops here`, with **Face ›**                       | PASS |
| 7.2 | Fill Vigor, check it reads full, then tap **Face ›**  | The Cerberus fight opens                                                       | PASS |
| 7.3 | Try **Flee**                                          | Refused, with `There is no leaving this one.`                                  | PASS |
| 7.4 | Fight it out, then record the cost | Before ___ / after ___ / max ___ / rounds ___ / cost ___% | 36 → 16 of 36, 6 rounds, **56%**. Under the 85% ceiling |
| 7.5 | Read the victory panel | First-kill cards: the Rare (Fleet Omen) plus 1–2 more items, a Divine gear piece and Gatekeeper's Snare (Divine Trinket). Up to five cards, all reachable by scrolling, with **Continue** visible | **FAIL, fixed** — four cards (Warhex, Gravemark, Divine accessory +9, Gatekeeper's Snare), no Fleet Omen, and Warhex is repeat-only. Two loot defects (note 5) |
| 7.6 | Return to the Road                                    | Cerberus reads `✦ defeated`. Valheon was already open, so nothing else changes | PASS |

### 8. A final boss opens the next zone: Jörmungandr

Covers exit criterion 9. Ceiling: **85%**. **This drill seeds distance.** Restore it at 8.9.

```sql
update player set lifetime_steps = 900000 where id = '019fd954-0745-7748-9892-ce6f2e600c04';
```

| #   | Step                                                                 | Expected                                                                                                                                                           | Result |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 8.1 | Run the seed, then foreground                                        | `900 Leagues` on the Road                                                                                                                                          | PASS |
| 8.2 | Read Valheon                                                         | Fenrir `◈ ready to face · you may walk on`. Jörmungandr `◈ ready to face · the road stops here`. Both with **Face ›**                                              | PASS |
| 8.3 | Read Imperion                                                        | Dimmed, tagged `Locked`, and **no** `Explore Imperion` button                                                                                                      | PASS |
| 8.4 | Fill Vigor, check it reads full, then face Jörmungandr               | The fight opens, and Flee is refused                                                                                                                               | PASS |
| 8.5 | Fight it out and record the cost                                     | Before **_ / after _** / max **_ / rounds _** / cost \_\_\_%. **A loss here is a balance finding, not a failed drill.** Record it, refill, and try again only once | 36 → 15 of 36, 5 rounds, **58%**. Under the 85% ceiling. Drops: Ambrosia Shard (the guaranteed Rare, first test of the drill 7 fix), Shadowbind, Divine weapon +9, Coilbreaker's Wrath |
| 8.6 | Tap **Continue** after a win                                         | The fight settles and syncs on its own. Nothing else is needed                                                                                                     | PASS |
| 8.7 | Read Imperion                                                        | **No longer `Locked`**, and an `Explore Imperion` button. This came from the phone's battle reaching the server, not a seeded row                                  | PASS — server: `imperion` unlocked 0.1 s after the battle ended |
| 8.8 | Tap `Explore Imperion`                                               | If an encounter is granted, it names a **Lemures** or a **Strix**. Today's cap may already be spent, which grants nothing and is correct                           | PASS — a Strix |
| 8.9 | Run the **ledger restore** under "Seeding distance", then foreground | Leagues back to your real total. Imperion stays open, and the Waymarker stays where your real Leagues put it                                                       | PASS — restored from the ledger after Fenrir; foreground to confirm |

Optional, if Vigor allows: face **Fenrir** (mid-boss, 75% ceiling) before 8.9 and record its cost here: **36 → 2 of 36, 9 rounds, 94%.** See the balance table and note 8.

### 9. Reconciling one row by hand

**↯ Do not skip this drill.** It has found a shipped defect in two of the last three milestones.

Take the Jörmungandr win from drill 8. Write down what the screen showed, then query and compare.

```sql
select client_battle_id, grant_id, enemy_id, encounter_kind, enemy_level, outcome, xp_awarded, ended_at
from battle where player_id = '019fd954-0745-7748-9892-ce6f2e600c04'
order by ended_at desc limit 3;

select item_def_id, source, acquired_at from player_item
where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' order by acquired_at desc limit 5;

select gear_def_id, source, bonus_primary, level_at_drop, acquired_at from player_gear
where player_id = '019fd954-0745-7748-9892-ce6f2e600c04' order by acquired_at desc limit 5;

select zone_id, unlocked_at from player_zone_progress
where player_id = '019fd954-0745-7748-9892-ce6f2e600c04';

select vigor_current, vigor_anchor_at from player where id = '019fd954-0745-7748-9892-ce6f2e600c04';
```

| Claim                                                                                                                                                                             | How to check                                                                           | Result |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| The battle is `zone_boss`, has **no** `grant_id`, and its `enemy_level` is your level                                                                                             | A gate tap spends no encounter, so `grant_id` is null. Enemy level always equals yours | PASS — `zone_boss`, `grant_id` null, `enemy_level` 20 = player level |
| `xp_awarded` is `15 + level × 2` on a win, `0` on a loss                                                                                                                          | Compute it                                                                             | PASS — 55 = 15 + 20 × 2 |
| One drop row per Reveal Card: an item in `player_item` with `source = 'boss_drop'`, a gear piece in `player_gear` with `source = 'gear'`, and a Trinket with `source = 'trinket'` | Count the cards against the rows                                                       | PASS by arithmetic — the screen count wasn't remembered (4 or 5). A first kill can only make 4 cards: 2 items (the guaranteed Rare plus one draw, since the engine draws `qty_min`), 1 gear and 1 Trinket. The server holds exactly 4 rows: `player_item` Ambrosia Shard and Shadowbind with `source = boss_drop`, `player_gear` `gear_weapon_divine` (`gear`) and Coilbreaker's Wrath (`trinket`) |
| `player_zone_progress` gained `imperion`, with `unlocked_at` after the battle's `ended_at`                                                                                        | Compare the timestamps                                                                 | PASS — `imperion` at 18:32:30.718, battle ended 18:32:30.607 |
| `vigor_current` matches the screen at the end of the fight                                                                                                                        | Only the latest fight is checkable                                                     | PASS — 15, the screen's 15/36 |
| The day's `encounters_used` did not move for the boss fight                                                                                                                       | Compare with the count before drill 8                                                  | PASS — 0 before and after |

### 10. M3 still holds

Covers exit criterion 11. Spot checks, not M3's whole sheet.

| #    | Step                                            | Expected                                                                                                      | Result |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| 10.1 | Explore a zone after the day's 5 are spent      | Nothing new appears. The cap holds (M3 drill 2)                                                               | PASS — 5 Explore taps granted 5 encounters and the 6th none; server `encounters_used` = 5, 5 `explore` grants. The Fenrir refill had reset the count to 0 |
| 10.2 | Scroll the Road with several encounters waiting | The encounters card scrolls with the Road. **Return to the Road** lands on your zone (M3 note 1, fixed at P6) | PASS |
| 10.3 | Win a fight and stay in the app                 | The battle reaches the server without a foreground (M3 drill 7)                                               | PASS — the battle row reached the server 20 s after the fight ended, with the app still open (a Harpy loss at 2/36 Vigour, then a Harpy win at 19:18, both on the server within seconds) |
| 10.4 | Turn the API off, force-stop, open the Road     | It renders in full from the mirror (M3 drill 4.9)                                                             | PASS |
| 10.5 | Open the Satchel | Still the M3 stub: `Nothing to carry yet. Gear and items arrive with your first battles.` The Gear and Items sub-views are M5's (M4 plan §2.2). First written as "items listed", which the build can't do | PASS — after the tab bar was relabelled Satchel (note 10) |

The tutorial (M3 drill 10) is not re-run. It needs an uninstall, which loses the bestiary again, and M4 changed nothing in onboarding.

---

## Exit criteria

M4 plan §5, against the drills above.

| # | Criterion | Evidence | Result |
| --- | --- | --- | --- |
| 1 | A dropped piece of gear can be equipped, and the stat change is visible | 1.2–1.5 | PASS |
| 2 | Unequipping returns the stat, and one slot never holds two pieces | 1.3, 1.6 | PASS |
| 3 | Equipping is refused while a battle is open, and says why | 1.8a, 1.9. P6 closed the only way to reach Character mid-fight, so the refusal is covered by `writes.test.ts` | PASS |
| 4 | Vigour is readable on Character, and a Rest Day's restore shows there | 2.1–2.4 | PASS |
| 5 | Every filled skill slot states its category | 3.1 | PASS |
| 6 | A stat's effect is shown before a point is spent | 3.2–3.4 | PASS |
| 7 | A streak survives a rest day and resets quietly | 4.1–4.6 | PASS |
| 8 | Tapping an available boss gate starts the fight, and it can't be fled | 6.2–6.3, 7.2–7.3, 8.4 | PASS |
| 9 | Defeating a final boss opens the next zone from the device | 8.7, 9 | PASS |
| 10 | A geared wild fight costs measurably less than the ungeared floor | 5: 14% against 30% | PASS |
| 11 | M3's criteria still pass | 10.1–10.5 (spot checks; the tutorial was not re-run) | PASS |

## Balance results

Filled from drills 5–8. The ceilings are for an **ungeared** reference build, so a geared fight should come in under them.

| Fight                  | Kind      | Ceiling | Cost | Rounds | Under? |
| ---------------------- | --------- | ------- | ---- | ------ | ------ |
| Wild (mean of 5.1–5.3) | wild | 30% | 14% | 2.3 | Yes |
| Cyclops | mid-boss | 75% | 31% | 5 | Yes |
| Cerberus | zone boss | 85% | 56% | 6 | Yes |
| Jörmungandr | zone boss | 85% | 58% | 5 | Yes |
| Fenrir | mid-boss | 75% | **94%** | 9 | **No, but a seeding artifact.** Fought at L20, below Fenrir's L22 gate level (`balance.test.ts` `GATE_FROM`). The model predicts 90% for this build at L20 and 68% for the reference build at L22, where a Power 80 Physical skill unlocks. See note 8 |

## Notes

Write anything you notice here as you see it, not afterwards. Don't sort it or judge whether it's worth doing. That comes after the drills, when the whole list is visible at once.

| #   | Comment                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Drill 1 first run: back was blocked from the moment a fight opened, so an accidental tap could only be fled, which spends the encounter, and an accidental boss tap couldn't be left at all. Changed the same day: back before Begin now cancels with the encounter kept (DECISIONS 2026-10-24). Steps 1.8 and 1.8a re-test it |
| 2   | Drills 1–3 ran before the switch to Canadian spelling, so their quoted strings show the American text seen at the time (`Armor`, `Vigor`, `Traveler's`). From drill 4 on, the app reads `Armour`, `Vigour`, `Favour` and `Traveller's` (DECISIONS 2026-10-24)                                                                  |
| 3   | Drill 6, first run: Cyclops won in 5 rounds, but the victory panel still couldn't scroll to the last drop: the first scroll fix let the list's own content shrink. Saving the second fix hot-reloaded the battle route, which opened a new Cyclops fight over the unrecorded win, so the win and its drops were lost (DECISIONS 2026-10-24). Re-run from full |
| 4   | Drill 6.5's expected drops were wrong as first written. They described GDD 5 §5's repeat-kill item rule alone, but GDD 8 adds a guaranteed Heroic Trinket and a 60% Heroic gear roll to every mid-boss kill, and GDD 5 §3.3 gives Cyclops one item table for first and repeat kills, all Common or Uncommon. The game was right, and the sheet is corrected |
| 5   | Drill 7's Cerberus first kill dropped repeat-only Warhex and no Fleet Omen. Two defects: the item pool merged first-kill and repeat lists, and the first-kill Rare GDD 5–7 guarantee was never built. Both fixed with tests (DECISIONS 2026-10-24). The Fleet Omen from this kill is not re-granted |
| 6   | Character's Avatar pane is crowded. Matthew suggested a third Character sub-tab for the Vigour and Gear cards. GDD 13 §5.1 already puts gear on the Satchel tab as its default Gear sub-view, and P1's Gear card on Character departed from that unrecorded. Decided: the Gear card moves to the Satchel tab in M5 with the Trinket slot, and Vigour stays on Character (M4 plan §2.2, DECISIONS 2026-10-24) |
| 7   | Granted the Fleet Omen the Cerberus first kill was owed (note 5), by a server insert with `source = boss_drop`. Seeded 900,000 steps and refilled Vigour for drill 8 (2026-10-24 18:29 Toronto) |
| 8   | Fenrir cost 94% at L20, over the 75% ceiling. Not a content defect: the seed put the fight two levels below Fenrir's normal gate level (L22). The model reproduces it (90% for this build at L20), and at L22 the reference build costs 68%, because a Power 80 Physical skill unlocks there. Worth knowing for M5 balance: that unlock is a cliff, a boss about 25 points cheaper across two levels. Also, Cerberus and Jörmungandr came in 15–20 points under the model, as typed moves and items should. Matthew had 6 unspent points and wore the +2 Traveller's Blade throughout |
| 9   | With 9 encounters waiting, every **Explore** button sat below a full-height list, so each Explore meant scrolling past all of it (M3 note 1 again). Decided for M5: the encounters card collapses to a count, **Face the next ›** and **Show all ▾**, and Explore becomes GDD 13 §4's single floating button (M4 plan §2.2, DECISIONS 2026-10-24) |
| 10  | At 10.5 Matthew asked whether "the Satchel" meant the Inventory tab. The tab bar still read Map and Inventory: the 2026-08-14 relabel to Road and Satchel was decided and written into GDD 13 but never built. Fixed during the drill (DECISIONS 2026-10-24) |
| 11  | |
