# M6 device drills

**Run:** P7, on the Pixel 9, **on the release build**, from 2026-11-01. **Status:** complete on 2026-11-03 apart from 7.3, as a short pass (DECISIONS 2026-11-03). Drills 5 and 6 are deferred to Phase 3.

**Purpose:** verify the ten exit criteria in `traverser-m6-plan.md` §5 on hardware.

Fill in the **Result** column as you go. Record a failure as a defect, not as a retry. Write anything else you notice in the notes table at the bottom while you see it.

**↯ These drills are written against the build, not against the spec.** Every expected string below was read out of the code on 2026-10-30. Every number was read out of the server again on 2026-11-01, after the 10:35 AM sync.

### The short pass (from 2026-11-03)

Matthew can't run the long drills for a while, so M6 closes on a short pass (DECISIONS 2026-11-03):

- **Run:** 3.3–3.6, 4, 8, 9 and 10. Each takes a few minutes sitting down, apart from 3.4, which waits for your next walk. You have 23 waiting fights in Valheon, so drill 4 needs no Explore.
- **Deferred to Phase 3:** 5 (the overactivity walk) and 6 (onboarding again). Drill 7, first deferred, then passed in daily use. Their criteria are marked **ACCEPTED**, not PASS, with the evidence named in the exit-criteria table. Confirm each in daily use when it comes up.

---

## Before you start

### State on 2026-11-01

Your profile, `Emdir` (`019fd954-0745-7748-9892-ce6f2e600c04`), read from the server after the 10:35 AM sync:

| Field | Value |
| --- | --- |
| Level | 23, with **6 unspent** stat points |
| `lifetime_steps` | **291,416** (291 Leagues) |
| Zones open | Olympion, Valheon, Imperion |
| Waymarker | **Valheon.** Imperion is open, but its road begins at 900 Leagues, and the Waymarker stands in the furthest open zone you've reached |
| Streak | current **11**, best **11**, credited through 2026-10-31 |
| Today | 3,160 steps, **goal not met**, 2 of 5 encounters used |
| Waiting encounters | **3**, all workout grants in Valheon: Valkyrie, and Draugr twice |
| Gear | **12 of 12.** Worn: Ascendant's Blade +9, Paragon's Guard +7, Ascendant's Band +9, Coilbreaker's Wrath (+5 Favour, +5 Aegis) |
| Items | 20 |
| Settings | Music and effects at 1.00, not muted, reminder **6 PM**, male figure |

### Build it once, from the commit that carries the temp audio

Every sound in this build **speaks its own cue name**: "hub music", "victory sting", "button tap". Music adds a quiet drone after its name, so a crossfade or a duck is audible. That's what makes drills 2–5 possible before real sound exists (DECISIONS 2026-10-30). So the APK must be built after the temp audio landed. From `app/`:

```
npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Then unplug the cable and stop Metro. Every drill runs without either.

### Export your identity first

Drill 6 clears the app's storage to run onboarding again. **Settings → Identity export** before anything else, and check that the file reached Google Drive. Drill 6 ends by restoring Emdir from it.

### Turn the volume up

Media volume, not ringer volume. The temp audio is quiet speech.

---

## Drills

### 1. The release build, alone

Covers exit criterion 1.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 1.1 | With no cable and Metro stopped, force-stop and open Traverser | It opens to Character with no red screen and no "Unable to load script" | PASS |
| 1.2 | Pull to refresh on Character | The spinner settles with no banner. Your step count matches Health Connect's | PASS |
| 1.3 | On the server, read your last sync (Claude runs this) | A `sync_delta` row applied within the last minute | PASS: a 4-step delta for Nov 1 applied at 10:49:26 AM, read 24 seconds later. Today now stands at 3,164 |

### 2. Music by screen, and a battle's way in and out

Covers exit criterion 2. Each track speaks its name, then drones. A crossfade lasts 0.8 seconds: you hear the new name over the old drone fading.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 2.1 | Open the **Character** tab | "hub music", then a drone | PASS |
| 2.2 | Switch to **Satchel** | No change: the same track keeps playing | PASS |
| 2.3 | Switch to **Map** | "map valheon music", crossfaded in. Your Waymarker stands in Valheon | PASS |
| 2.4 | Open **Settings** from Character | No change: Settings keeps whatever was playing | PASS |
| 2.5 | Start a waiting wild fight from the Road's encounters card | "modal open". The map music drops to a fifth of its volume, then "battle valheon music" | PASS |
| 2.5a | Tap **Explore Valheon**. Three of today's five are left | If the roll finds a fight, "encounter start" and a new row on the encounters card. If it finds nothing, no sound: tap again | PASS |
| 2.6 | Win it | The battle track stops, then "victory sting". If something dropped, the Reveal Card follows with "reveal 1 sting", 2 or 3 by its tier, and "reveal card flip" | PASS |
| 2.7 | Tap **Continue** back to the Road | The map track returns | PASS |
| 2.8 | Start another wild fight, then **Flee** | "flee success", and the map track fades back in | PASS |

### 3. Stingers on their triggers

Covers exit criterion 3, apart from `stg_overactivity`, which is drill 5.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 3.1 | In a fight, use a move the chevron marks super effective | "Super Effective!" on the plate, and "type super sting" | PASS |
| 3.2 | Use one marked resisted | "Resisted…", and "type resisted sting" | PASS |
| 3.3 | Character → **Tag today as a Rest Day**. Tags are unlimited, so this costs nothing | "rest day sting", and the music dips under it and returns | PASS |
| 3.4 | After your next walk of 1,000+ steps, open the app, wait for the sync to settle, then open the **Map**. If the Map was already open when the sync landed, switch tabs and back | The Waymarker walks forward along Valheon's track to "footstep loop", then "waymarker sting" when it stops | PASS |
| 3.5 | Leave the Map and come back | No walk and no sting: it plays once per batch | PASS |
| 3.6 | Open the Map again with no new Leagues | Nothing | PASS |

### 4. Sound effects

Covers exit criterion 4.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 4.1 | Tap between the three tabs | "tab switch" each time | PASS |
| 4.2 | Character's sub-views: Avatar, Stats, Skills, Activity | "subtab switch" each time | PASS |
| 4.3 | Open Settings, then back out | "screen push", then "screen pop" | PASS |
| 4.4 | In a fight, land a physical hit | "hit physical", and the enemy flinches | PASS |
| 4.5 | Land a critical hit, if one comes | "crit", and the enemy staggers harder | PASS |
| 4.6 | Let the enemy hit you | The enemy lunges at you and your panel shakes | PASS |
| 4.7 | Use a healing item | "item heal" | PASS |
| 4.8 | Use a skill until it reads **0 left**, then tap it again. Nothing is locked at Level 23, and a spent skill shares the sound | "skill locked" | PASS |
| 4.9 | Win | "enemy faint", and the enemy fades and sinks | PASS |
| 4.10 | In a boss fight, tap **Flee** | "flee denied" | PASS |
| 4.11 | Read the type chevrons on your skill slots | Drawn icons: a double chevron up in green, a dash in grey, a chevron down in red. Not text | PASS |
| 4.12 | Read **Battle** on the Road's encounter card | It ends in a drawn chevron, not a dot | PASS |

### 5. The overactivity sting, simulated

**Deferred to Phase 3** (DECISIONS 2026-11-03).

Covers exit criterion 3's `stg_overactivity`. **A 90-minute session doesn't fit a drill**, so this runs at a 10-minute threshold, set on the **server** only. No APK change.

1. Tell Claude you're ready. Claude rebuilds the API container with `OveractivityMinutes = 10`, uncommitted.
2. Start a brisk walk with the watch recording heart rate, and keep it going past 12 minutes.
3. Open Traverser **while the walk is still going**.
4. Claude puts 90 back and rebuilds. Check `git status` shows no change to `SyncEndpoints.cs` afterwards.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 5.1 | Open the app mid-session | The overactivity banner, and "overactivity sting" once, as the banner appears | |
| 5.2 | Switch tabs | The banner stays, and the sting doesn't repeat | |
| 5.3 | Check the notification shade | No notification about the session | |

### 6. Onboarding again: the figure, Screen 10, and a denial

**Deferred to Phase 3** (DECISIONS 2026-11-03).

Covers exit criterion 6, and the figure choice. **Needs the identity export from "Before you start".**

First, in Android Settings → Apps → Traverser → Notifications, turn notifications **off**, so that Screen 10 really asks. Then Apps → Traverser → Storage → **Clear storage**.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 6.1 | Open Traverser | The splash, with "title music" | |
| 6.2 | Continue to the story screens | "oldroads music" | |
| 6.3 | On **Name your Traverser**, read the figure picker | Two plates, **Male** and **Female**, with Male chosen | |
| 6.4 | Choose **Female**, name the Traverser, and take the first step | It continues to the starting loadout | |
| 6.5 | Finish the tutorial battle | "battle tutorial music" during it, and the victory screen after | |
| 6.6 | The next screen | "We'll gently remind you when the road is waiting — nothing pushy." with **Allow reminders** and **Not now** | |
| 6.7 | Tap **Allow reminders**, then **Don't allow** on Android's prompt | It continues to the Map | |
| 6.8 | Character → Avatar | The female figure, the starting blade in the top-left corner, and three dashed empty slots: Armour, Accessory, Trinket | |
| 6.9 | Everything else on Character | Unchanged by the denial. No banner about notifications | |
| 6.10 | Settings → **Traverser** | The same two plates, Female chosen. Tap **Male**, and Avatar shows the male figure | |
| 6.11 | Settings → **Restore a different identity**, and paste Emdir's file | Emdir returns: Level 23, streak 11 | |

### 7. The daily nudge

**Passed in daily use**, outside the short pass.

Covers exit criterion 7. **Runs today.** A met goal skips the day's nudge, and today's isn't met yet, so tonight's 6 PM nudge is already scheduled. It stays scheduled only if your last open before 6 PM still finds you under the goal.

1. After drill 6, in Android Settings, turn Traverser's notifications back **on**. Drill 6 turned them off.
2. Watch your steps. You're at 3,160, and drills 3.4 and 5 add about 2,500. Stay under 7,000 by your last open before 6 PM.
3. Plug the cable in. Claude reads `adb shell dumpsys alarm` and confirms tonight's alarm, with the one-hour window.
4. Open Traverser once more before 6 PM. That sets the latest numbers into the nudge.
5. Don't open Traverser again until the notification arrives. Don't tag the rest day (3.3) until after it.

**If you pass 7,000 first,** today's nudge is cancelled. Run 7.3 tomorrow instead, before you've walked 7,000 steps.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 7.1 | Read the Daily reminder card | "between 6 and 7 PM" | PASS |
| 7.2 | Claude's alarm check | One nudge alarm a day for the coming week, the first today from 6 PM within an hour's window | Not run. The notifications arriving on Nov 2 and 3 cover it |
| 7.3 | On a day you opened the app before 6 PM, under your goal, between 6 and 7 PM | One notification, titled **Traverser**: "As of [the time you last opened it], Emdir was [N] steps short of today's goal. Walked since? Open Traverser to count it and keep a [current]-day streak going." At 14 days the article is right; note 1 still applies at 18 | Not yet tested: on Nov 2 and 3 the first open came after 6 PM, so each night's notification was scheduled the evening before, with the original copy, as designed (note 3) |
| 7.4 | Step the reminder to 7 AM, then back to 6 PM | "between 7 and 8 AM", then "between 6 and 7 PM" | PASS |
| 7.5 | Across all of M6 | No notification has ever arrived about a broken streak | PASS |

### 8. No placeholder anywhere

Covers exit criterion 8.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 8.1 | Fight one enemy from each zone | Each plate shows an inked silhouette, never a glyph or coloured square | PASS |
| 8.2 | Win a fight that drops something | The Reveal Card shows the item's or gear's silhouette | PASS |
| 8.3 | Satchel → Gear, and → Items | Every piece and item has its silhouette | PASS |
| 8.4 | Read the Road | Each zone card opens with its banner. Your Waymarker is the figure on a gold-ringed marble token | PASS |
| 8.5 | Settings → **Credits** | "Icons by Caro Asercion, DarkZaitzev, Delapouite, Lorc, Skoll, from game-icons.net, under CC BY 3.0. Recoloured, resized, and some combined for Traverser." | PASS |

### 9. The volume sliders survive a restart

Covers exit criterion 5.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 9.1 | Settings → Audio, drag **Music** to about a quarter | The drone gets quieter as you drag | PASS |
| 9.2 | Drag **Sound effects** to zero and release | No "volume" sample, and tab switches go silent | PASS |
| 9.3 | Force-stop and reopen | Music quiet, effects silent, sliders where you left them | PASS |
| 9.4 | Turn **Mute all** on, then off | Everything silent, then back at the slider levels | PASS |
| 9.5 | Set both back to full | | PASS |

### 10. M5 still holds

Covers exit criterion 10. Spot checks against M5's ten.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 10.1 | Satchel: four slots, Gear and Items. Wear another Trinket, then Coilbreaker's Wrath again | Favour and Aegis move with it (M5 criteria 1–2) | PASS |
| 10.2 | Use Coilbreaker's Wrath in a fight and land it | The Weaken line in the log (M5 criterion 3) | PASS |
| 10.3 | Battle a boss again from the Road | Its intro lines open the fight, and its defeat text closes it (M5 criterion 6) | PASS |
| 10.4 | Bestiary → a met wild enemy | Its flavour text reads again (M5 criterion 8) | PASS |
| 10.5 | The Road | The encounters card is one row high, and one Explore button serves every zone (M5 criterion 9) | PASS |
| 10.6 | Turn the API off, force-stop, open the Road | It renders in full from the phone | PASS |

---

## Exit criteria

M6 plan §5, against the drills above.

| # | Criterion | Evidence | Result |
| --- | --- | --- | --- |
| 1 | The signed APK runs with no cable and no Metro, and syncs over Tailscale | 1 | PASS |
| 2 | Each screen plays its GDD 14 track, and a battle enters and exits on §5's transitions | 2, 6.1–6.5 | Drill 2 PASS. Onboarding music (6.1–6.5) ACCEPTED on `cues.test.ts`'s `musicForRoute` cases |
| 3 | Stingers fire on their triggers, `stg_overactivity` with the banner | 3, 5 | Drill 3 PASS. `stg_overactivity` ACCEPTED on `OveractivityTests`, `cues.test.ts`, and M5 drill 5's banner PASS |
| 4 | Sound effects play for combat, navigation and the overworld | 4, 3.4 | PASS |
| 5 | Settings' volume sliders change music and effects, and survive a restart | 9 | PASS |
| 6 | Screen 10 asks for notification permission after the tutorial, and a denial changes nothing else | 6.6–6.9 | ACCEPTED on code review: `10-notifications.tsx` sends both answers to `/map`, and the answer only decides whether a nudge is scheduled. No test covers it. Confirm on the next fresh install |
| 7 | The daily notification arrives at its fixed time, and nothing is ever sent for a broken streak | 7 | 7.1, 7.4 and 7.5 PASS: delivered on Nov 2 and 3, and no streak notification ever. 7.3, the same-day copy, is still to test |
| 8 | No placeholder art is visible in normal play | 8 | PASS |
| 9 | The home-lab decision is recorded, and the second restore drill passes | P6 (DECISIONS 2026-10-30) | PASS |
| 10 | M5's ten criteria still pass | 10 | PASS |

## Notes

| # | Drill | Note |
| --- | --- | --- |
| 1 | 7.3 | Found while updating the sheet on 2026-11-01: `todayBody` in `notifications/nudge.ts` writes "a 11-day streak". Streaks of 8, 11, 18 and 80–89 days need "an". Not yet fixed |
| 2 | — | Found 2026-11-03, between drills: with the server off, Nov 2 was opened over its goal but synced on Nov 3. Grace was spent, so the streak broke at 11. Fixed in step 9 (DECISIONS 2026-11-03), and the 7:39 PM sync re-credited Nov 2 as `goal_hit`: streak 14, best 14 |
| 3 | 7.3 | Nov 2 and 3: notifications arrived with "The road is waiting…". The phone's reads show first opens at 6:10 PM and 6:08 PM, after each night's notification was due, so the evening before had scheduled them with the original copy. Working as GDD 11 §6 specifies |
| | | |
