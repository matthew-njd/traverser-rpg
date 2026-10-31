# M6 device drills

**Run:** P7, on the Pixel 9, **on the release build**, from 2026-10-30. **Status:** not started.

**Purpose:** verify the ten exit criteria in `traverser-m6-plan.md` §5 on hardware.

Fill in the **Result** column as you go. Record a failure as a defect, not as a retry. Write anything else you notice in the notes table at the bottom while you see it.

**↯ These drills are written against the build, not against the spec.** Every expected string below was read out of the code on 2026-10-30, and every number out of the server the same day.

---

## Before you start

### State on 2026-10-30

Your profile, `Emdir` (`019fd954-0745-7748-9892-ce6f2e600c04`), read from the server:

| Field | Value |
| --- | --- |
| Level | 23, with **6 unspent** stat points |
| `lifetime_steps` | **278,377** (278 Leagues) |
| Zones open | Olympion, Valheon, Imperion |
| Streak | current **10**, best **10**, credited through 2026-10-30 |
| Today | 9,298 steps, goal met, 5 of 5 encounters used |
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
| 1.1 | With no cable and Metro stopped, force-stop and open Traverser | It opens to Character with no red screen and no "Unable to load script" | |
| 1.2 | Pull to refresh on Character | The spinner settles with no banner. Your step count matches Health Connect's | |
| 1.3 | On the server, read your last sync (Claude runs this) | A `sync_delta` row applied within the last minute | |

### 2. Music by screen, and a battle's way in and out

Covers exit criterion 2. Each track speaks its name, then drones. A crossfade lasts 0.8 seconds: you hear the new name over the old drone fading.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 2.1 | Open the **Character** tab | "hub music", then a drone | |
| 2.2 | Switch to **Satchel** | No change: the same track keeps playing | |
| 2.3 | Switch to **Map** | "map imperion music", crossfaded in. Your Waymarker stands in Imperion | |
| 2.4 | Open **Settings** from Character | No change: Settings keeps whatever was playing | |
| 2.5 | Start a waiting wild fight from the Road's encounters card | "modal open". The map music drops to a fifth of its volume, then "battle imperion music". ("Encounter start" plays only on **Explore**, and today's five are used: run it tomorrow as 2.5a) | |
| 2.5a | Tomorrow, tap **Explore** | "encounter start" | |
| 2.6 | Win it | The battle track stops, then "victory sting". If something dropped, the Reveal Card follows with "reveal 1 sting", 2 or 3 by its tier, and "reveal card flip" | |
| 2.7 | Tap **Continue** back to the Road | The map track returns | |
| 2.8 | Start another wild fight, then **Flee** | "flee success", and the map track fades back in | |

### 3. Stingers on their triggers

Covers exit criterion 3, apart from `stg_overactivity`, which is drill 5.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 3.1 | In a fight, use a move the chevron marks super effective | "Super Effective!" on the plate, and "type super sting" | |
| 3.2 | Use one marked resisted | "Resisted…", and "type resisted sting" | |
| 3.3 | Character → **Tag today as a Rest Day** | "rest day sting", and the music dips under it and returns | |
| 3.4 | Walk at least 1,000 steps, open the app, wait for the sync to settle, then open the **Map**. If the Map was already open when the sync landed, switch tabs and back | The Waymarker walks forward along Imperion's track to "footstep loop", then "waymarker sting" when it stops | |
| 3.5 | Leave the Map and come back | No walk and no sting: it plays once per batch | |
| 3.6 | Open the Map again with no new Leagues | Nothing | |

### 4. Sound effects

Covers exit criterion 4.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 4.1 | Tap between the three tabs | "tab switch" each time | |
| 4.2 | Character's sub-views: Avatar, Stats, Skills, Activity | "subtab switch" each time | |
| 4.3 | Open Settings, then back out | "screen push", then "screen pop" | |
| 4.4 | In a fight, land a physical hit | "hit physical", and the enemy flinches | |
| 4.5 | Land a critical hit, if one comes | "crit", and the enemy staggers harder | |
| 4.6 | Let the enemy hit you | The enemy lunges at you and your panel shakes | |
| 4.7 | Use a healing item | "item heal" | |
| 4.8 | Use a skill until it reads **0 left**, then tap it again. Nothing is locked at Level 23, and a spent skill shares the sound | "skill locked" | |
| 4.9 | Win | "enemy faint", and the enemy fades and sinks | |
| 4.10 | In a boss fight, tap **Flee** | "flee denied" | |
| 4.11 | Read the type chevrons on your skill slots | Drawn icons: a double chevron up in green, a dash in grey, a chevron down in red. Not text | |
| 4.12 | Read **Battle** on the Road's encounter card | It ends in a drawn chevron, not a dot | |

### 5. The overactivity sting, simulated

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
| 6.11 | Settings → **Restore a different identity**, and paste Emdir's file | Emdir returns: Level 23, streak 10 | |

### 7. The daily nudge, overnight

Covers exit criterion 7. **Runs overnight.** A met goal skips the day's nudge, and today's is met, so it has to be tomorrow, before you've walked.

1. Tonight, in Android Settings, turn Traverser's notifications back **on**. Then Settings → **Daily reminder**, and step it to **7 AM**.
2. Claude reads `adb shell dumpsys alarm` and confirms tomorrow's alarm, with the one-hour window.
3. Tomorrow, before 7 AM, open Traverser once. That sets tonight's numbers into the nudge.
4. Don't reach 7,000 steps before 8 AM.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 7.1 | Read the Daily reminder card | "between 7 and 8 AM" | |
| 7.2 | Claude's alarm check | One nudge alarm a day for the coming week, none today (the goal is met), the first tomorrow from 7 AM within an hour's window | |
| 7.3 | Tomorrow, between 7 and 8 AM | One notification, titled **Traverser**: "As of [the time you opened it], Emdir was [N] steps short of today's goal. Walked since? Open Traverser to count it and keep a 10-day streak going." | |
| 7.4 | Set the reminder back to 6 PM | "between 6 and 7 PM" | |
| 7.5 | Across all of M6 | No notification has ever arrived about a broken streak | |

### 8. No placeholder anywhere

Covers exit criterion 8.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 8.1 | Fight one enemy from each zone | Each plate shows an inked silhouette, never a glyph or coloured square | |
| 8.2 | Win a fight that drops something | The Reveal Card shows the item's or gear's silhouette | |
| 8.3 | Satchel → Gear, and → Items | Every piece and item has its silhouette | |
| 8.4 | Read the Road | Each zone card opens with its banner. Your Waymarker is the figure on a gold-ringed marble token | |
| 8.5 | Settings → **Credits** | "Icons by Caro Asercion, DarkZaitzev, Delapouite, Lorc, Skoll, from game-icons.net, under CC BY 3.0. Recoloured, resized, and some combined for Traverser." | |

### 9. The volume sliders survive a restart

Covers exit criterion 5.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 9.1 | Settings → Audio, drag **Music** to about a quarter | The drone gets quieter as you drag | |
| 9.2 | Drag **Sound effects** to zero and release | No "volume" sample, and tab switches go silent | |
| 9.3 | Force-stop and reopen | Music quiet, effects silent, sliders where you left them | |
| 9.4 | Turn **Mute all** on, then off | Everything silent, then back at the slider levels | |
| 9.5 | Set both back to full | | |

### 10. M5 still holds

Covers exit criterion 10. Spot checks against M5's ten.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 10.1 | Satchel: four slots, Gear and Items. Wear another Trinket, then Coilbreaker's Wrath again | Favour and Aegis move with it (M5 criteria 1–2) | |
| 10.2 | Use Coilbreaker's Wrath in a fight and land it | The Weaken line in the log (M5 criterion 3) | |
| 10.3 | Battle a boss again from the Road | Its intro lines open the fight, and its defeat text closes it (M5 criterion 6) | |
| 10.4 | Bestiary → a met wild enemy | Its flavour text reads again (M5 criterion 8) | |
| 10.5 | The Road | The encounters card is one row high, and one Explore button serves every zone (M5 criterion 9) | |
| 10.6 | Turn the API off, force-stop, open the Road | It renders in full from the phone | |

---

## Exit criteria

M6 plan §5, against the drills above.

| # | Criterion | Evidence | Result |
| --- | --- | --- | --- |
| 1 | The signed APK runs with no cable and no Metro, and syncs over Tailscale | 1 | |
| 2 | Each screen plays its GDD 14 track, and a battle enters and exits on §5's transitions | 2, 6.1–6.5 | |
| 3 | Stingers fire on their triggers, `stg_overactivity` with the banner | 3, 5 | |
| 4 | Sound effects play for combat, navigation and the overworld | 4, 3.4 | |
| 5 | Settings' volume sliders change music and effects, and survive a restart | 9 | |
| 6 | Screen 10 asks for notification permission after the tutorial, and a denial changes nothing else | 6.6–6.9 | |
| 7 | The daily notification arrives at its fixed time, and nothing is ever sent for a broken streak | 7 | |
| 8 | No placeholder art is visible in normal play | 8 | |
| 9 | The home-lab decision is recorded, and the second restore drill passes | P6 (DECISIONS 2026-10-30) | PASS |
| 10 | M5's ten criteria still pass | 10 | |

## Notes

| # | Drill | Note |
| --- | --- | --- |
| | | |
