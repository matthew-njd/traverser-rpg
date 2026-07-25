# Traverser GDD — Section 14: Sound Design

## 1. Overview

This section defines the full music track list, trigger conditions, loop-point architecture, transition/mixing rules, and sound effect (SFX) list for Traverser. Per the planning doc: *"Full chiptune-style soundtrack plus sound effects... audio is a priority, not an afterthought."* This section treats that literally — every meaningful state change in the app (a hit landing, a level-up, a zone crossing, a boss's first word) gets a matching audio event, not just background music.

**Numbering note:** under the current 15-section plan, this is Section 14 (Sound Design). Section 15 (Analytics) is next and last.

**Scope boundary.** This is a specification, not a composition — it defines what tracks and cues must exist, when they fire, how they loop, and how they transition into one another. Actual composition (melody, exact BPM, instrumentation choices beyond the general chiptune palette) happens in the audio-production phase, in its own dedicated Claude Project per the planning doc's stated intent to separate GDD work from art/audio production.

**Two design principles carried in from prior sections:**
- **Consolidate, don't proliferate** (Section 13's stated philosophy) — reuse one base sting with tonal variants rather than inventing a new cue for every context, wherever the contexts are functionally similar.
- **Never punitive** (Section 11's core constraint) — no cue in this document plays as failure, alarm, or shame. Defeat, overactivity warnings, and streak resets are all scored *gently*, matching the copy tone already locked in those sections.

---

## 2. Music Track List

### 2.1 Menu, Hub & Onboarding

| ID | Track | Context |
|---|---|---|
| `mus_title` | Title Theme | Splash screen (Section 10 Screen 1) |
| `mus_oldroads` | The Old Roads | Onboarding Story Intro (Section 10 §4) — also reused as Olympion's zone-entry-equivalent track, since Olympion has no separate zone entry narrative overlay (Section 12 confirms Olympion is covered by onboarding, not duplicated) |
| `mus_hub` | Traverser's Rest | Character tab (Avatar + Stats sub-views) **and Inventory tab (Gear/Items/Bestiary sub-views)** — the app's two browsing/management tabs share one hub theme, per the consolidate-don't-proliferate principle; only the Map carries zone-specific score |

### 2.2 Overworld / Map

| ID | Track | Context |
|---|---|---|
| `mus_map_mvp` | Road Placeholder | MVP placeholder Map screen (Section 10 §8.1) — simple, short loop, deliberately understated since this track is temporary scaffolding |
| `mus_map_olympion` | Olympion Roads | Full Map screen (Section 13 §4), Waymarker positioned within Olympion's segment |
| `mus_map_valheon` | Valheon Roads | Full Map screen, Waymarker within Valheon's segment |
| `mus_map_imperion` | Imperion Roads | Full Map screen, Waymarker within Imperion's segment |

### 2.3 Zone Entry Narrative

| ID | Track | Context |
|---|---|---|
| `mus_entry_valheon` | Frostward | Valheon Zone Entry Narrative overlay (Section 12 §2, Section 13 §4.4) |
| `mus_entry_imperion` | Stoneroad Dawn | Imperion Zone Entry Narrative overlay |

Per Section 12's cross-section flag, these are distinct from both the corresponding map theme and any battle theme — a zone entry narrative should feel like a threshold moment, not a preview of gameplay music.

### 2.4 Battle — Wild Encounters

| ID | Track | Context |
|---|---|---|
| `mus_battle_tutorial` | Waystone Echo | Tutorial Battle only (Waystone Wisp, Section 10 §6) — never reused, keeps the tutorial sonically separate from any real roster encounter |
| `mus_battle_olympion` | Marble & Wind | Any wild encounter in Olympion (Harpy, Satyr) |
| `mus_battle_valheon` | Fang & Frost | Any wild encounter in Valheon (Draugr, Valkyrie) |
| `mus_battle_imperion` | Ash & Iron | Any wild encounter in Imperion (Strix, Lemures) |

One shared wild-battle theme per zone rather than per-enemy — four sprites per zone (Section 5) don't each need a unique track, and a single strong zone identity reinforces the "zone visual identity" pairing already established in Section 9's art direction.

### 2.5 Battle — Mid-Bosses

| ID | Track | Context |
|---|---|---|
| `mus_boss_cyclops` | The Slow Reckoning | Cyclops encounter (Olympion mid-boss) |
| `mus_boss_fenrir` | Racing Shadow | Fenrir encounter (Valheon mid-boss) |
| `mus_boss_griffin` | Wingbeat Verdict | Griffin encounter (Imperion mid-boss) |

### 2.6 Battle — Final Bosses

| ID | Track | Context |
|---|---|---|
| `mus_boss_cerberus` | Three-Throated Warden | Cerberus encounter (Olympion final boss) |
| `mus_boss_jormungandr` | The Coiled Deep | Jörmungandr encounter (Valheon final boss) |
| `mus_boss_cacus` | Furnace of the Last Gate | Cacus encounter (Imperion final boss) — the hardest fight in the game (Section 7); scored as the game's most intense track |

### 2.7 One-Shot Stings (non-looping)

| ID | Sting | Context |
|---|---|---|
| `stg_victory` | Victory Fanfare (standard) | Any wild or mid-boss win |
| `stg_victory_boss` | Victory Fanfare (grand) | Zone final-boss win only — longer, fuller variant of `stg_victory` |
| `stg_defeat` | Quiet Fade | Battle loss — see §5.3 for tone rationale |
| `stg_boss_intro` | Threshold Flourish | Fires under each boss's intro dialogue line (Section 12 §5–7), before the boss battle theme begins |
| `stg_reveal_1` | Reveal — Common | Base Reveal Card sting: common loot, routine level-up |
| `stg_reveal_2` | Reveal — Uncommon/Rare | Fuller variant: Uncommon+ loot, streak milestones Day 3–40 |
| `stg_reveal_3` | Reveal — Legendary | Full variant: Rare/first-kill boss drops, Trinket reveals, streak milestones Day 60+, zone-cap level-ups (15/25/35/45/55) |
| `stg_type_super` | Super Effective Chime | Post-hit callout, Type Multiplier = 2.0× |
| `stg_type_resisted` | Resisted Thud | Post-hit callout, Type Multiplier = 0.5× |
| `stg_overactivity` | Gentle Reminder | Overactivity warning banner appears (Section 11 §8, Section 13 §6.5) |
| `stg_rest_day` | Hearth Chime | Rest Day confirmation toast |
| `stg_streak_break` | *(none — silent)* | Streak resets deliberately have no sting at all, matching Section 11's "no notification on break" framing exactly |
| `stg_egypt_tease` | Something Old | Final line of Cacus's first-kill defeat text (Section 12 §7.2) — plays once, ever, per account |
| `stg_waymarker` | Leagues Chime | Waymarker forward-sync animation completes (Section 9 §5) |

### 2.8 Volume Bucket Mapping (resolves Section 13's flag)

Section 13 §7 has since been updated to add an **Audio** row to Settings: independent **Music** and **Sound Effects** sliders plus a **Mute All** toggle, and its new cross-section flag asks this section to confirm every asset above cleanly falls into one of the two buckets, or flag back if a third is genuinely needed.

**Music bucket:** every `mus_` track in §2.1–§2.6 only — continuous, looping background score.

**Sound Effects bucket:** every `stg_` sting (§2.7) **and** every `sfx_` effect (§6), together. Stings are musically constructed (chimes, fanfares, a boss-intro flourish) but functionally they're reactive, event-triggered cues rather than continuous score — the same category as a menu tap or a hit sound, not a background track a player would recognize as "the soundtrack." Grouping them with SFX rather than Music means a player who lowers Music to reduce background clutter (e.g., walking somewhere they want ambient awareness of their surroundings) still gets combat and reward feedback, and a player who lowers SFX to cut UI noise doesn't lose the actual score.

**No third category is needed.** Two buckets cleanly cover every asset ID prefix used in this document (`mus_` vs. `stg_`/`sfx_`); this closes Section 13's flag without requiring any further change to the Settings screen.

---

## 3. Trigger Conditions

### 3.1 Menu, Hub & Onboarding
- `mus_title`: plays on app cold-start, from Splash until Screen 2 (Health Permission) begins.
- `mus_oldroads`: begins at Story Intro Screen 1, continues through Name Your Traverser and Starting Loadout Reveal, stops at Tutorial Battle start.
- `mus_hub`: begins the instant the Character **or Inventory** tab becomes frontmost (post-onboarding Screen 11, and every subsequent visit); persists uninterrupted across sub-tab switches (Avatar ↔ Stats, Gear ↔ Items ↔ Bestiary), across Character ↔ Inventory tab switches (no restart), and across pushed screens that sit "above" the hub conceptually (Settings). Boss Gate Detail is reached via Map, not Character/Inventory — the active `mus_map_[zone]` track simply continues playing underneath it, since it's conceptually still the Map.

### 3.2 Overworld / Map
- `mus_map_mvp`: plays whenever the MVP placeholder Map screen is frontmost (pre-Section 9-activation build only).
- `mus_map_[zone]`: plays whenever the full Map screen is frontmost, selected by whichever zone segment the **Waymarker** currently sits in — not the Viewport's scroll position. Scrolling the Viewport into a different zone while browsing does not change the track; only the Waymarker's canonical position does. This matches Section 9's Waymarker/Viewport distinction directly.

### 3.3 Zone Entry Narrative
- `mus_entry_[zone]`: begins the instant the overlay fires (Waymarker's forward-sync animation crossing into Valheon or Imperion), plays under the full tap-through sequence, stops when the overlay dismisses.

### 3.4 Battle
- `mus_battle_[zone]` / `mus_boss_[name]`: begins the instant the Battle modal opens, replacing whatever track was playing underneath (Map, Hub, or Zone Entry — a battle can in principle interrupt a Zone Entry Narrative only in the tutorial-adjacent edge case where none exists in practice, since Zone Entry is a blocking overlay with no encounters embedded in it).
- `mus_battle_tutorial`: begins at Tutorial Battle start (Section 10 §6.1), the only case where this track ever plays.
- `stg_boss_intro`: fires the instant a mid-boss or final-boss encounter begins, timed to the boss's spoken intro line (Section 12 §5–7); the relevant `mus_boss_[name]` track begins immediately after the flourish resolves, not simultaneously — see §5.2 for exact timing.

### 3.5 Post-Battle
- `stg_victory` / `stg_victory_boss`: fires the instant the enemy's Vigor reaches 0. Boss variant used only for the three final bosses (Cerberus, Jörmungandr, Cacus); mid-bosses and wild encounters use the standard variant.
- `stg_defeat`: fires the instant the player's Vigor reaches 0.
- `stg_reveal_1/2/3`: fires per Reveal Card presentation (Section 13's shared component) — tier selected by content significance, not content type:
  - Tier 1: Common item/gear drop, non-milestone level-up
  - Tier 2: Uncommon or Rare drop (non-first-kill), streak milestones Day 3/7/14/25/40
  - Tier 3: first-kill Rare/Mythic/Divine drop, zone-cap level milestones (15/25/35/45/55), streak milestones Day 60/90/120, and any Trinket reveal

### 3.6 In-Battle Callouts
- `stg_type_super` / `stg_type_resisted`: fires immediately after damage resolves on any hit where TypeMultiplier ≠ 1.0, layered under the existing battle theme (see §5.4). Never fires for Basic Attack or Physical Skills (TypeMultiplier is always 1.0× for those per Section 2).

### 3.7 Retention & Safety
- `stg_overactivity`: fires exactly when the banner renders (Section 11 §8 trigger logic — sync time only, never mid-session).
- `stg_rest_day`: fires on Rest Day tag confirmation (manual tag only; Automatic Sync Grace credits are silent, since they're retroactive and the player isn't watching a toast appear for a day already past).
- `stg_streak_break`: explicitly absent. This entry exists in the table only to make the omission a documented decision, not an oversight.

### 3.8 One-Time Events
- `stg_egypt_tease`: fires once, tied to the `overactivity_warning_shown`-style one-time gating pattern already used elsewhere — specifically, gated on a persisted "Cacus first-kill defeat text viewed" flag so it cannot replay on subsequent visits to the same dialogue.
- `stg_waymarker`: fires once per completed forward-sync animation (i.e., once per app-open where new Leagues were earned), not once per League — a single chime for the whole batch of progress, not a chime-per-1000-steps stutter.

---

## 4. Loop Point & Structure Architecture

Chiptune tracks follow three structural templates depending on category:

### 4.1 Ambient / Hub / Map tracks (long loop)
- **Structure:** 4-bar intro (plays once) → 32-bar seamless loop.
- **Tempo range:** 80–100 BPM — deliberately unhurried, since these tracks underscore browsing and idle time, not action.
- **Loop point:** the 32-bar loop must return to its downbeat with no audible seam; standard chiptune practice of matching the loop's final beat's decay tail to the first beat's transient handles this without a manual crossfade.

### 4.2 Battle tracks (tighter loop, layered intensity)
- **Structure:** 2-bar intro stinger (plays once, doubles as a "battle start" cue) → 16-bar seamless loop.
- **Tempo range:** 130–150 BPM for wild encounters, 140–160 BPM for mid-bosses, 150–170 BPM for final bosses — tempo itself communicates escalating stakes independent of melody.
- **Low-Vigor intensity layer (boss fights only):** final-boss and mid-boss tracks each carry a second, more urgent percussion/harmony layer that fades in when the player's Vigor drops below 25% (matching the same floor used for the post-defeat Vigor recovery rule in Section 2, so the threshold is consistent with an existing number rather than inventing a new one). This layer fades in over 2 seconds and does not retrigger the loop — it simply adds intensity on top of the existing bar position. Wild encounters do not use this layer; they're short enough (2–5 turns per Section 2's target pacing) that the added complexity wouldn't be heard before the fight ends.
- **Loop point:** same seamless-loop requirement as §4.1, at the tighter 16-bar length.

### 4.3 Stings (one-shot, no loop)
- **Structure:** no loop point — plays once start to finish, then silence (or returns to whatever ducked track resumes, per §5).
- **Length:** 1–3 seconds for callouts and toasts (`stg_type_super`, `stg_rest_day`, `stg_waymarker`), 3–6 seconds for Reveal Card stings, 6–10 seconds for victory fanfares, up to 15 seconds for `stg_egypt_tease` (a one-time, savored moment that can afford to breathe).

---

## 5. Transition & Mixing Rules

### 5.1 Standard crossfades
Map ↔ Hub ↔ Settings-adjacent screen transitions: **0.8-second linear crossfade**, outgoing track fades out while incoming fades in simultaneously. This applies to all Map-to-Hub, Hub-to-Map, and zone-to-zone Waymarker-position transitions.

### 5.2 Battle entry
1. Whatever track was playing underneath ducks to 20% volume over 0.3 seconds (not a full stop — a battle opening as a modal should feel like it's overlaying the world, not erasing it).
2. If entering a mid-boss or final-boss fight: `stg_boss_intro` plays at full volume over the ducked underlying track, timed to the dialogue overlay (Section 12 §5–7 — mid-bosses and final bosses both get intro dialogue; wild encounters never do).
3. The underlying track cuts fully (not fades) the instant `stg_boss_intro` ends, and `mus_boss_[name]` begins immediately — a hard cut here is intentional, giving the boss theme's opening stinger (§4.2) maximum impact rather than blending in.
4. If entering a wild encounter, or the one-time Tutorial Battle (neither carries intro dialogue — Section 12 scopes boss dialogue to mid-bosses and final bosses only; Section 10's tutorial script uses tooltips, not a dialogue overlay): the underlying track fades out over 0.5 seconds while `mus_battle_[zone]` or `mus_battle_tutorial` fades in — no hard cut, since there's no dialogue beat to punctuate.

### 5.3 Battle exit
- **Victory:** battle track cuts immediately, `stg_victory`/`stg_victory_boss` plays alone (no underlying music) through Reveal Card presentation, then the pre-battle screen's track resumes via standard crossfade (§5.1) once the Battle modal closes.
- **Defeat:** battle track fades out over 1.5 seconds (slower than victory's hard cut — deliberately unceremonious rather than triggering a fanfare-shaped moment) directly into `stg_defeat`, a short, soft, resolving phrase — not a "failure stinger" in the traditional game-audio sense (no minor-key sting, no descending "game over" motif). This matches Section 2's design ("no XP or permanent penalty" on loss) and Section 11's anti-punishment principle: the game should never sound like it's scolding the player for losing a fight when the mechanical cost is already near-zero (25% Vigor floor, immediate re-attempt available).
- **Flee (wild only):** no sting at all — battle track fades out over 0.5 seconds directly back into the prior screen's track. Fleeing is a routine tactical choice, not an event worth scoring.

### 5.4 Layering stings over active music
`stg_type_super`, `stg_type_resisted`, `stg_reveal_1/2/3`, `stg_rest_day`, `stg_overactivity`, and `stg_waymarker` all **duck-and-layer** rather than interrupt: the currently playing track (battle theme, hub theme, whatever is active) ducks to 60% volume for the sting's duration plus 0.2 seconds, then returns to 100% — never a hard stop. This keeps the world feeling continuous even as individual moments are punctuated. Level-up (a `stg_reveal_*` context) follows the same rule, since a level-up can in principle occur while the player is mid-browse on the Stats screen after opening the app post-walk, not just after a battle.

### 5.5 Priority order (concurrent-trigger resolution)
In the rare case two audio events would fire in the same instant (e.g., a level-up Reveal Card triggered by the same battle win that also plays `stg_victory`), priority is:

`stg_boss_intro` > `stg_victory` / `stg_victory_boss` > `stg_defeat` > `stg_reveal_*` (queued, plays immediately after victory sting resolves, not simultaneously) > `stg_type_super` / `stg_type_resisted` > `stg_overactivity` > `stg_rest_day` / `stg_waymarker` / `stg_egypt_tease`

This mirrors Section 11's existing precedent for resolving simultaneous notification priority (Streak-at-Risk > Milestone > Nudge) — reusing an established pattern rather than inventing a new resolution scheme.

---

## 6. Sound Effect (SFX) List

### 6.1 Combat — Impact Sounds

Impact SFX are typed, not per-move — six type-flavored hit sounds plus a Physical/neutral default, layered under the existing battle music rather than replacing it:

| SFX | Type | Character |
|---|---|---|
| `sfx_hit_physical` | — (Basic Attack, Physical Skills) | Sharp, percussive clack |
| `sfx_hit_storm` | Storm | Crackling static burst |
| `sfx_hit_war` | War | Heavy metallic clang |
| `sfx_hit_trickery` | Trickery | Quick chime/whoosh |
| `sfx_hit_underworld` | Underworld | Low rumble/reverb tail |
| `sfx_hit_sea` | Sea | Splash with a wet decay |
| `sfx_hit_wisdom` | Wisdom | Bright shimmer/glass tone |
| `sfx_crit` | (layer, any type) | Additional sharp transient layered on top of the base impact sound on a critical hit (6.25% chance per Section 2) — not a replacement sound, an added emphasis layer |

### 6.2 Combat — Actions & Items

| SFX | Trigger |
|---|---|
| `sfx_menu_select_action` | Attack/Skill/Item/Flee menu selection |
| `sfx_skill_locked` | Tapping a greyed-out locked Skill slot |
| `sfx_flee_success` | Successful flee from a wild encounter |
| `sfx_flee_denied` | Attempted flee against a boss (Flee button disabled — plays the same denial tone as `sfx_skill_locked`, reused rather than duplicated) |
| `sfx_item_heal` | Healing item consumed (Traveler's Salve / Herald's Draft / Ambrosia Shard) |
| `sfx_item_buff` | Buff item consumed (Ironhide Tincture / Sunder Oil / Fleet Omen) |
| `sfx_item_charm` | Type Charm consumed (Surge or Breach) |
| `sfx_enemy_faint` | Enemy Vigor reaches 0 — a short "defeated" cue distinct from and preceding `stg_victory` |

### 6.3 Navigation & Menus

| SFX | Trigger |
|---|---|
| `sfx_tab_switch` | Bottom-tab navigation (Character/Map/Inventory) |
| `sfx_subtab_switch` | Sub-tab switch within Character or Inventory |
| `sfx_button_tap` | Generic button/CTA press |
| `sfx_button_disabled` | Tap on a disabled control (e.g., locked Boss Gate "Begin Battle") |
| `sfx_screen_push` | Pushed screen opens (Settings, Boss Gate Detail) |
| `sfx_screen_pop` | Pushed screen closes/back navigation |
| `sfx_modal_open` | Battle modal, overflow keep/discard modal, comparison view open |
| `sfx_toggle` | Any stepper/toggle interaction (stat allocation +/−, gear equip) |
| `sfx_dialogue_advance` | Tap-to-advance on any Tooltip/Overlay dialogue box (Section 13's shared component) |

### 6.4 Overworld & Retention

| SFX | Trigger |
|---|---|
| `sfx_footstep_loop` | Ambient walking-cadence loop, used only where the Map has actual traversal animation (post-MVP full Map, not the MVP placeholder) — per the planning doc's explicit footstep-SFX callout |
| `sfx_encounter_start` | A wild encounter checkpoint or Explore roll triggers a battle (distinct from `stg_boss_intro`, which only fires for scripted boss gates) |
| `sfx_banner_appear` | Any banner renders (permission-denied, overactivity) — a single soft appearance tone shared by both, tone-differentiated only by the sting layered on top (`stg_overactivity` for the overactivity case; the permission banner uses this SFX alone, no additional sting, since it's not a Section-11-defined event) |
| `sfx_reveal_card_flip` | Reveal Card's visual flip/presentation animation, layered with (not replacing) the appropriate `stg_reveal_*` sting |

---

## 7. Naming Convention

Following the planning doc's architecture principle that audio (like sprites) should be a swappable data asset, not hardcoded: all IDs use the `mus_`, `stg_`, or `sfx_` prefix shown throughout this document, lowercase snake_case, with zone/boss/type identifiers matching the exact lowercase names already used as data keys elsewhere in the GDD (e.g., `olympion`, `cerberus`, `storm`) rather than display names — this keeps audio asset lookups consistent with however gear, enemy, and zone data is already keyed in Sections 5–9.

---

## 8. Cross-Section Flags — Resolution Trace

| Flag source | Flag | Resolved in |
|---|---|---|
| Section 12 | Sting/stinger per boss intro dialogue beat | `stg_boss_intro`, §3.4, §5.2 |
| Section 12 | Distinct ambient/thematic track per zone for zone-entry narrative screens | `mus_entry_valheon`, `mus_entry_imperion`, §2.3 |
| Section 13 | Reveal Card presentation — three volume/tone variants of one base sting (loot/level-up/milestone) | `stg_reveal_1/2/3`, §3.5 |
| Section 13 | Overactivity warning banner sound — deliberately quiet/non-alarming, distinct from celebratory Reveal Card sting | `stg_overactivity`, §3.7 |
| Section 13 | Type-effectiveness post-hit callout — short stinger distinct per Super Effective/Resisted | `stg_type_super`, `stg_type_resisted`, §3.6 |
| Section 13 (post-lock update) | Confirm every asset ID falls into the new Music/Sound Effects Settings buckets, or flag a third category | §2.8 |
| Planning doc | Chiptune soundtrack: zone ambient music, battle theme, level-up sting, victory/defeat cues | §2 (full track list) |
| Planning doc | Sound effects: level-ups, footsteps, ambient zone music | §6 (full SFX list) |

**No flag was left unaddressed.**

---

## 9. New Cross-Section Flags

- **Section 13 (UI Architecture) — FULFILLED.** Section 13 §7 now has an Audio row (Music / Sound Effects sliders + Mute All toggle), patched directly into the already-locked file rather than left as a standing gap. Its own follow-up flag — confirming every asset here maps cleanly to one of the two buckets — is resolved in §2.8 above.
- **Section 15 (Analytics):** one lightweight optional event worth considering: `audio_settings_changed` (`music_volume`, `sfx_volume`, `muted` bool) — useful only if the team wants to know how many players mute the game, not required for core retention/engagement goals already defined.

---

## 10. Open Questions

- **Exact composition and BPM values** are placeholders for audio-production judgment — this section fixes structure (loop lengths, tempo *ranges*, transition timings) but not final melodies or precise BPM within each stated range. That work belongs to the dedicated audio-production Claude Project once the GDD is complete, per the planning doc's stated intent.
- **Wearable-device audio behavior** (e.g., does a track keep playing if the phone screen is off during a tracked workout): out of scope here since it's an engineering/platform question, not a design one — the design intent (music should score in-app screens, not real-world workouts) is implicit throughout this document and doesn't need separate resolution.
