# M2 device drills

**Run:** P8, on the Pixel 9. **Status:** complete, 2026-08-22. All eight exit criteria pass.
**Purpose:** verify the eight exit criteria in `traverser-m2-plan.md` §5. Every one is device-only. The test suite cannot reach any of them.

Fill in the **Result** column as you go. Record a failure as a defect, not as a retry.

M1's lesson, from `traverser-m1-plan.md` §7.1: run this from the sheet, not from memory. Reconciling one real row by hand surfaced M1's only shipped defect. A review checklist would not have found it.

---

## Before you start

> **Warning:** Drill 1 needs a fresh install, and uninstalling destroys the only copy of `player_id` and the bearer token on the device (T4 §6.5). Export your identity first. Without it, no client can claim the `Emdir` profile on the server.

1. Open **Settings → Identity export** and save the file to Google Drive.
2. Confirm the API answers from the phone. Open `https://workshop.tail465912.ts.net/api/v1/content/version` in the phone's browser. A `401` is the correct answer, because it proves routing and TLS work. A timeout means Tailscale is down on one of the two devices.
3. Confirm the API and the database are running on the PC.

### Building to the device

```
adb uninstall com.oldroads.traverser
npm start
```

Then, in a second terminal:

```
npx expo run:android
```

The schema migrates from v4 to v6 at first launch. The migration is additive and runs before any screen reads.

---

## Drills

### 1. Running the tutorial from a fresh install

Covers exit criteria 1, 2, and 7.

| #    | Step                                 | Expected                                                                                                | Result |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Launch after install                 | Splash, then onboarding screen 1. Text renders in Spectral from the first frame, with no fallback flash | PASS   |
| 1.2  | Complete screens 1–4                 | Registration succeeds. Screen 5 follows naming, not the hub                                             | PASS   |
| 1.3  | Read screen 5                        | Traveler's Blade, `Equipped · +1 Might`. Traveler's Salve, `×3`                                         | PASS   |
| 1.4  | Tap Continue, then Begin             | Waystone Wisp named. No type tag, and no level indicator anywhere                                       | PASS   |
| 1.5  | Read the Vigor bars                  | The enemy shows a percentage. You show `20 / 20`                                                        | PASS   |
| 1.6  | Round 1: tap Attack                  | Wisp `15 → 9`. You `20 → 16`. Log reads `Basic Attack — 6 damage.`                                      | PASS   |
| 1.7  | Tap Skill                            | Greyed. Tapping shows `Skills unlock at Level 4.`                                                       | PASS   |
| 1.8  | Tap Flee                             | Greyed. Tapping shows the cannot-flee line                                                              | PASS   |
| 1.9  | Round 2: tap Attack                  | Wisp `9 → 3`. You `16 → 12`                                                                             | PASS   |
| 1.10 | Round 3: tap Attack                  | Refused, with `Not this round — the Salve is what you need.`                                            | PASS   |
| 1.11 | Round 3: Item, then Traveler's Salve | Heals `+4` to 16, then the Wisp's hit takes you to 12. The satchel now shows 2                          | PASS   |
| 1.12 | Round 4: tap Attack                  | The Wisp reaches 0. The battle ends in 4 rounds at `12 / 20`                                            | PASS   |
| 1.13 | Read screen 7                        | `The road remembers this. Onward.` and `+17 XP`                                                         | PASS   |
| 1.14 | Tap Begin your journey               | Lands on the map tab                                                                                    | PASS   |
| 1.15 | Open the Character tab               | Might reads 11, not 10                                                                                  | PASS   |

**GDD 10 §6.3 values, for reference:** every player hit is 6, every Wisp hit is 4, and the Salve heals 4. These are exact. A value that is off by one is a defect rather than variance, because the tutorial bypasses the random factor and the crit roll.

### 2. Running a debug battle under the full engine

Covers exit criterion 3.

**Which enemy to fight, and why.** Steps 2.5 to 2.7 each need a specific matchup, because the
chevron and the callout both read the type chart. Pick from this table.

| For this tone                      | Use                       | Against                   | Chart                                 |
| ---------------------------------- | ------------------------- | ------------------------- | ------------------------------------- |
| `▲▲` verdigris, `Super Effective!` | Thunderer's Wrath (Storm) | **Cyclops** or **Satyr**  | Storm is 2× into War and Trickery     |
| `–` grey, no callout               | Thunderer's Wrath (Storm) | **Harpy** or **Cerberus** | Storm is 1× into Storm and Underworld |
| `▽` madder, `Resisted…`            | Warlord's Advance (War)   | **Harpy**                 | War is 0.5× into Storm                |

↯ Nothing in Olympion resists Storm, so the resisted tone needs a War move rather than a Storm one.
That is a property of the roster, not of the code, and it is a near relative of the storm-reachability
gap recorded on 2026-08-15.

| #    | Step                                       | Expected                                                                        | Result            |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------- |
| 2.1  | Settings → Debug encounters → Harpy        | The battle opens. Enemy level is not shown, but equals your level               | PASS              |
| 2.2  | Attack several times                       | Damage varies between hits. A crit appears eventually and reads `Critical hit!` | PASS              |
| 2.3  | Open Skill                                 | Unlocked skills are listed with uses remaining                                  | PASS              |
| 2.4  | Fight the Harpy a second time              | Chevrons now appear beside typed moves. They did not on the first fight         | PASS              |
| 2.5  | Thunderer's Wrath against the Harpy        | Chevron `–`, and no callout. Silence is the correct answer for a neutral hit    | PASS              |
| 2.6  | Thunderer's Wrath against Cyclops or Satyr | Chevron `▲▲` in green, and the callout `Super Effective!` in the same green     | PASS on re-battle |
| 2.7  | Warlord's Advance against the Harpy        | Chevron `▽` in muted red, and the callout `Resisted…` in the same red           | PASS              |
| 2.8  | Long-press a typed move                    | The hint reads _move type_ vs. _enemy type_, never one type alone               | PASS              |
| 2.9  | Spend a skill down to 0 uses               | The row greys out and cannot be tapped                                          | PASS              |
| 2.10 | Flee a wild encounter                      | Succeeds immediately, with no loot                                              | PASS              |

### 3. Granting drops once, across a force-stop

Covers exit criterion 4. This is the idempotency drill.

> **A drop is invisible on the device at M2.** GDD 13 §6.3's Reveal Card is not built, and drops do
> not reach the local satchel until inventory reconciles at M3. The grant is real and server-side, so
> this drill is verified in the database rather than on screen. Tell me when you reach 3.4 and I will
> run the queries.

| #   | Step                                                                    | Expected                                                                                         | Result |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| 3.1 | Win a debug battle against the Harpy or Satyr                           | The victory panel reads `The road remembers this.` Nothing names a drop, which is correct for M2 | PASS   |
| 3.2 | Force-stop the app from Android settings **before** foregrounding again | —                                                                                                | PASS   |
| 3.3 | Reopen                                                                  | Lands on the hub, not back in the battle. The fight does not replay                              | PASS   |
| 3.4 | Foreground so it syncs, then tell me                                    | Exactly one `battle` row for that fight, and at most one `player_item` beside it                 | PASS   |
| 3.5 | Foreground a second time                                                | No new rows. The replay is a no-op, which is the property T2 §8 says breaks here first           | PASS   |

### 4. Losing a battle

Covers exit criterion 5. Vigor persists between battles (GDD 2 §6), so reach a loss by fighting repeatedly without healing rather than by contriving one fight.

| #   | Step                         | Expected                                     | Result |
| --- | ---------------------------- | -------------------------------------------- | ------ |
| 4.1 | Note your XP before          | —                                            | PASS   |
| 4.2 | Fight until you lose         | The battle ends in defeat                    | PASS   |
| 4.3 | Check Vigor                  | Sits at 25% of max, floored                  | PASS   |
| 4.4 | Check XP after the next sync | Unchanged. A loss awards 0 and costs nothing | PASS   |

### 5. Resuming from a snapshot

Covers exit criterion 6. P7 delivered this, and it has never run on hardware.

| #   | Step                                                   | Expected                                                                                    | Result |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------ |
| 5.1 | Start a debug battle, take two turns, and use one item | The satchel count drops by 1                                                                | PASS   |
| 5.2 | Force-stop the app from Android settings               | —                                                                                           | PASS   |
| 5.3 | Reopen                                                 | Lands straight back in the battle, not on the hub                                           | PASS   |
| 5.4 | Compare against 5.1                                    | Same round, same enemy Vigor, same satchel count. The combat log is empty, which is correct | PASS   |
| 5.5 | Finish the fight                                       | Settles normally, and writes one battle row                                                 | PASS   |

### 6. Confirming M1 still works

Covers exit criterion 8.

| #   | Step                                  | Expected                                                        | Result |
| --- | ------------------------------------- | --------------------------------------------------------------- | ------ |
| 6.1 | Walk, then foreground the app         | Steps and XP rise                                               | PASS   |
| 6.2 | Open the activity log                 | Today's row is present, and its bar is proportional to the goal | PASS   |
| 6.3 | Allocate a stat point                 | Persists across a restart                                       | PASS   |
| 6.4 | Stop the API, then foreground the app | No error surfaces. Offline is the normal case                   | PASS   |

---

## 7. Reconciling one row by hand

**↯ Do not skip this drill.** Reconciling a row by hand found M1's only real defect. Nothing on a review checklist would have caught it, and the screens looked correct at the time.

Take one completed debug battle. Write down what the screen showed. Then query the server and compare.

```sql
-- Replace PLAYER_ID with the value from Settings, Identity export.
select client_battle_id, enemy_id, enemy_level, outcome, vigor_after, xp_awarded, ended_at
from battle where player_id = 'PLAYER_ID' order by ended_at desc limit 1;

select item_def_id, source, acquired_at from player_item where player_id = 'PLAYER_ID';
select gear_def_id, equipped_slot, level_at_drop, bonus_primary from player_gear where player_id = 'PLAYER_ID';
select enemy_id, encounter_count, defeat_count from player_bestiary where player_id = 'PLAYER_ID';
select activity_date, steps, xp_awarded from activity_day where player_id = 'PLAYER_ID' order by activity_date desc limit 3;
```

Check each claim by arithmetic, not by eye.

| Claim                                                                                     | How to check                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `enemy_level` equals your level when the fight started                                    | Compare against the Character screen                                                                                               |
| The battle's `xp_awarded` is `15 + level × 2`                                             | Compute it                                                                                                                         |
| `activity_day.xp_awarded` includes that battle XP **and** the day's step and tier XP      | Step XP is the day's cumulative total divided by 20 and floored once, not floored per delta. This is exactly where M1's defect was |
| `vigor_after` matches the number the victory screen showed                                | Compare against what you wrote down                                                                                                |
| One `player_item` row per drop, and the tutorial Salves still carry `source = 'tutorial'` | Count the rows                                                                                                                     |
| `encounter_count` counts every fight, and `defeat_count` counts only wins                 | Compare against how many times you fought that enemy                                                                               |
| `bonus_primary` on the Blade is 1, and `equipped_slot` is `weapon`                        | Read the row                                                                                                                       |

---

## Recording the outcome

Record the result here when the sheet is complete. A failed drill goes to `DECISIONS.md` as a defect with its fix, not as a note.

| Exit criterion                                                    | Pass? | Notes |
| ----------------------------------------------------------------- | ----- | ----- |
| 1. A fresh install fights and wins the tutorial with exact values | PASS  | Drill 1. Every GDD 10 §6.3 value exact: 6 per player hit, 4 per Wisp hit, 4 healed, 4 rounds, ends 12/20. |
| 2. Blade equipped, 3 Salves, and one consumed per use             | PASS  | Drill 1.3 and 1.11. Granted server-side at registration; the satchel dropped 3 to 2 on use. |
| 3. Debug battle under the full engine, callout matches the chart  | PASS  | Drill 2. All three tones seen against the enemies the matchup table names. Long-press tooltip defect found and fixed at 2.8. |
| 4. Drops granted once, including across a force-stop              | PASS  | Drill 3. 36 battles, 36 distinct `client_battle_id`. A replayed outbox entry inserts nothing, and a second foreground adds no rows. |
| 5. A loss costs no XP and floors Vigor at 25%                     | PASS  | Drill 4. 17 losses and 8 flees, every one 0 XP and none negative. Vigor floored to 11, which is floor(0.25 x 45). |
| 6. A force-stopped battle resumes on the same turn                | PASS  | Drill 5. Same round, enemy Vigor and satchel count. The empty combat log is correct, being L3 state per T4 §5.2. `router.back()` defect found and fixed at 3.3. |
| 7. Spectral from first paint, with no flash                       | PASS  | Drill 1.1, on a fresh install. |
| 8. M1's eight criteria still pass                                 | PASS  | Drill 6 and 7. All four days reconcile exactly to GDD 1, and step XP floors once on the cumulative total rather than per delta. |

---

## Notes

Write anything you notice here as you see it, not afterwards. Do not sort it or judge whether it
is worth doing — that comes after the drills, when the whole list is visible at once.

| #    | Comment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.5  | The round # is above the player health, it should show the player's name. Let's find somewhere else for the round number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.11 | Turns resolve in a single frame, so the Salve heal and the Wisp's counterattack land together. I read it as a failure at first. The combat log needs a delay between lines, and both Vigor bars need to animate rather than jump.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.12 | **FIXED before drills 2-7.** Everything anchored to the bottom of a screen sat too low — the action menu, and Continue on screen 7. It needs bottom padding. This applies to every bottom-anchored control except the main nav tabs. Cause: `Screen` sets `edges={['top', 'left', 'right']}` and omits `bottom`, so nothing clears the Android gesture bar on a screen with no tab bar. Fix: `Screen` now takes the bottom inset by default, and the three tab screens pass `tabbed` to opt out.                                                                                                                                                                 |
| 2.2  | **DEFECT, fixed.** Lost the fight before a crit appeared, then could not leave the defeat screen — every later battle re-rendered it. Cause: the route guard skipped `begin` whenever a snapshot existed, and `settle` leaves the settled battle in the store. Fixed with `battleInProgress()`. Re-run 2.2 after reloading.                                                                                                                                                                                                                                                                                                                                      |
| 2.x  | **DEFECT, fixed.** A won battle that rolled gear sent the tier `mortal` as a `gear_def_id`. The server 500ed on the foreign key, and a 500 keeps the entry queued — so sync wedged and no allocation, Vigor or step data reached the device again. It surfaced as "my Vigor will not update". The server now skips drops it cannot resolve.                                                                                                                                                                                                                                                                                                                      |
| 2.8  | **DEFECT, fixed.** The long-press matchup tooltip was never implemented for sighted players — the description was wired only to `accessibilityHint`, so TalkBack read it and nothing appeared on screen. Now shown in the action menu note slot on long press. Re-run 2.8 after reloading.                                                                                                                                                                                                                                                                                                                                                                       |
| 3.3  | **DEFECT, fixed.** Reopening after the force-stop landed back in the settled battle with no way out — no back, no navigation. Cause: `finish()` and the error-state Back button both called `router.back()`, but boot re-enters `/battle` through a `Redirect`, which leaves no history to pop, so `back()` was a silent no-op. Fix: both exits now go through `leave()`, which falls back to `router.replace('/character')` when `canGoBack()` is false. Note that the same trap sat on exit criterion 6's resume path. Re-run 3.1-3.3 after reloading.                                                                                                         |
| 5.x  | **GAP, recorded not fixed.** The satchel never refreshes on an ordinary sync, so every drop silently widens a drift between the device and the server. `writeInventory` (`app/src/sync/mirror.ts:318`) is written and correct, but it is only reachable from `writeProfile` — registration and restore. `applySyncResponse`, the path every foreground takes, does not touch inventory. Found because the drill-5 satchel was empty on the device while the server held three items. This is smaller than the 2026-08-20 entry claims: not an M3 feature, a missing call site.                                                                                   |
| 5.y  | **GAP, recorded not fixed.** A battle that settles while a sync is already running is not uploaded until the next foreground. `finish()` fires a best-effort `syncNow()`, but the re-entrancy guard at `app/src/runtime.ts:69` returns the **in-flight** promise, whose payload was already built. Seen live: the fight ended at 14:32:21, a pass had started at 14:32:17, and the battle sat in the outbox for four minutes. No data is at risk — the outbox is durable — but the Continue-tap sync trigger is unreliable and nothing retries until the player happens to background the app. Fix is a re-check after the in-flight pass resolves, not a queue. |
| doc  | **No design overview exists.** The 15 GDD sections are designer-facing specs, read one at a time. Nothing summarises the whole game in one place. Cheap to write, useful as an orientation page and as the thing to hand a future collaborator instead of 15 files. Docs only, no code.                                                                                                                                                                                                                                                                                                                                                                          |
| gap  | **The game never explains itself after onboarding.** GDD 13's screen inventory has no help screen, codex or glossary — grepped and confirmed. GDD 10 teaches the loop once and GDD 12's lore is deliberately mechanics-free, so a player has no reference for the type chart, the six domains, Trinket vs. Weapon, streaks and Rest Days, or the Level 60 XP stop. This is a GDD 13 amendment plus an M3+ build packet, not a note to action inside M2.                                                                                                                                                                                                          |
