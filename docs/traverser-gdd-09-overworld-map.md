# Traverser GDD — Section 9: Overworld Map & Zone Structure

## 1. Overview

The overworld map is Traverser's central metaphor for "The Old Roads": a single continuous, winding **Road** that the Traverser physically reopens through real-world movement. It is symbolic and abstract rather than GPS-based — the player's position on the Road is driven entirely by **cumulative lifetime steps**, not literal geography.

The Road passes through the game's zones in a fixed sequence — **Olympion → Valheon → Imperion → (Egyptian zone, Phase 2)** — with each zone containing a mid-boss gate and a final-boss gate that must be defeated to continue advancing. Zone unlock has always been specified (per the planning doc and prior sections) as a dual gate: **cumulative distance threshold reached AND previous zone's final boss defeated.** This section defines the actual threshold numbers, the map's visual/interaction structure, and the daily wild-encounter cap that has been unhoused since Sections 1 and 4.

---

## 2. The Distance Mechanic

### 2.1 Unit: the League

Distance is tracked as **cumulative lifetime steps**, converted to a flavor unit for display:

> **1 League = 1,000 lifetime steps**

This is a narrative framing device only — it makes no claim about real-world distance (stride length varies too much per person to convert steps to km/mi meaningfully), and it keeps the number on-screen small and readable. Using raw cumulative steps directly (rather than an estimated km/mi conversion) also sidesteps imperial/metric localization entirely, and reuses data the app already tracks precisely for Step XP (Section 1) with zero new instrumentation.

Leagues only ever increase — there is no way to lose distance progress, consistent with XP never being at risk.

### 2.2 Two separate positions on the map

The map distinguishes between two things that are easy to conflate:

- **The Waymarker** — the Traverser's canonical position on the Road, representing total lifetime Leagues walked. It only ever moves forward, automatically, as new steps are earned. This is what gates zone unlocks.
- **The Viewport** — where the player is currently *looking/exploring* on the map screen. The player can freely scroll the Viewport backward to any previously-reached point on the Road to revisit earlier zones (see 4.3). Moving the Viewport does **not** move the Waymarker.

Default behavior: opening the Map screen centers the Viewport on the Waymarker's current position (the frontier). A single tap always returns the Viewport there.

### 2.3 Sync model

Per the planning doc, activity syncs only when the app is opened. On open, any steps earned since last sync are converted to new Leagues, and the Waymarker animates forward along the Road by that amount. Wild-encounter checkpoints (Section 5) are resolved during this forward animation.

---

## 3. Zone Unlock Thresholds

All thresholds were calibrated against the Section 1 XP/level curve and the average/highly-active user daily baselines already established there. **Correction from the previous draft:** Section 1's actual "Daily XP Baselines" table specifies **~7,000 steps/day** for the average profile, not the 8,000-step illustrative example used earlier in that same section to demonstrate the Step XP rate. This draft recalibrates against the correct 7,000/425 (avg) and 10,000/730 (active) figures — it conveniently also matches the default 7,000-step daily goal threshold from Sections 4/8, so the average profile used here is the same one the rest of the GDD's economy models are built on.

| Gate | Zone | Type | Threshold | Avg user reaches at | Active user reaches at |
|---|---|---|---|---|---|
| Zone entry | Olympion | — | 0 Leagues | Level 1 (immediate) | Level 1 (immediate) |
| Cyclops gate | Olympion | Mid-boss | **90 Leagues** (90,000 steps) | ~Level 10, day 13 | ~Level 11, day 9 |
| Cerberus gate | Olympion | Final boss → unlocks Valheon | **220 Leagues** (220,000 steps) | ~Level 15, day 31 | ~Level 17, day 22 |
| Fenrir gate | Valheon | Mid-boss | **380 Leagues** (380,000 steps) | ~Level 20, day 54 | ~Level 22, day 38 |
| Jörmungandr gate | Valheon | Final boss → unlocks Imperion | **900 Leagues** (900,000 steps) | ~Level 31, day 129 | ~Level 34, day 90 |
| Griffin gate | Imperion | Mid-boss | **1,850 Leagues** (1,850,000 steps) | ~Level 44, day 264 | ~Level 48, day 185 |
| Cacus gate | Imperion | Final boss → unlocks Egyptian zone (Phase 2) | **2,900 Leagues** (2,900,000 steps) | ~Level 54, day 414 | ~Level 59, day 290 |

The League thresholds themselves are unchanged from the previous draft — they were already round, sensible numbers — but the levels the average user actually reaches them at shift upward by 1–5 levels with the corrected step rate (a slower walking pace means more days pass, so more real-world XP accumulates before each distance gate is hit). Every gate still lands inside its target level window from Sections 5–7: Cyclops 8–12 ✅, Cerberus 12–18 ✅ (now Level 15, still comfortably "mid-teens" per the Section 1 flag), Fenrir 16–22 ✅, Jörmungandr 28–32 and never before 28 ✅, Griffin 38–45 ✅ (now Level 44 — close to the top of its window, worth watching if any future rebalancing happens), Cacus 48–56 ✅.

**Design note — highly active players arrive over-leveled, on purpose.** The active-user profile still consistently reaches gates several levels above the average profile (e.g., Level 59 at the Cacus gate, versus the target 48–56, and versus an average-user arrival of Level 54 at that same gate). This is accepted rather than corrected: it's the direct reward for real additional effort, consistent with the anti-grind principle that effort is never wasted. It does mean Cacus — the hardest fight in the game — will be comfortably easier for the most active players by the time they arrive, while remaining the tightest-margin fight in the GDD for the average-pace player it was tuned against. That tradeoff is intentional, not a balance gap. With the corrected baseline, the gap between the two profiles is somewhat narrower than the earlier draft suggested, but the same directional design holds.

### 3.1 Egyptian zone (Phase 2) — flagged, not specified

The Road continues past Cacus's gate to a visible-but-locked terminus (a "the road ahead is not yet open" marker) until the Phase 2 Egyptian zone is designed. Its distance threshold isn't set here — see Open Questions.

---

## 4. Map Layout Spec

### 4.1 Structure

The Road is rendered as a single winding path, laid out left-to-right (or bottom-to-top — an art decision for Section 12) in three visually distinct **zone segments**, each capped by a Final Boss Gate node that visually blocks further travel until defeated.

**Segments are not drawn to literal scale.** A 1:1 rendering would make Olympion (220 Leagues) nearly invisible next to Imperion (2,000 Leagues from entry to Cacus). Instead, each zone occupies a fixed, roughly equal share of visual Road length, with an internal progress-fill (a lit/unlit road texture, matching the "reopening the road" theme) scaled to that zone's own threshold range. This keeps all three zones feeling substantial regardless of their underlying step-count size.

### 4.2 Node types

| Node | States | Behavior |
|---|---|---|
| Zone Entry | Unlocked (always, once reached) | Cosmetic waypoint; no gameplay gate |
| Mid-boss Gate (Cyclops / Fenrir / Griffin) | Locked → Available → Defeated | Available once Waymarker reaches its League threshold. Tapping starts the fight. Does not block further Road progress — it's a recommended checkpoint, not a hard wall. |
| Final-boss Gate (Cerberus / Jörmungandr / Cacus) | Locked → Available → Defeated | Available once Waymarker reaches its threshold. **Hard gate** — the Road visually and mechanically stops here until the boss is defeated, blocking entry to the next zone regardless of further Leagues earned. |
| Zone terminus (post-Cacus) | Locked, "coming soon" | Visual-only placeholder for the Egyptian zone until Phase 2. |

Mid-bosses being soft gates (not blocking) versus final bosses being hard gates matches the existing repeat-boss policy (Section 5): players can walk straight past an undefeated Cyclops and keep earning Leagues, but they cannot enter Valheon without having beaten Cerberus.

### 4.3 Revisiting earlier zones

Because bosses are explicitly repeat-fightable (Section 5's Repeat Boss Policy) and the item/gear economy assumes ongoing wild encounters in already-cleared zones, the Viewport can scroll freely to any zone behind the Waymarker. From there, the player can tap an **Explore** action to manually trigger a wild encounter check against that zone's roster (see 5.2) — useful for farming a specific type charm or item from an earlier zone (e.g., returning to Olympion for Storm/War charms while leveling in Imperion).

### 4.4 On-screen elements (Map screen)

- The Road, rendered per 4.1, with all discovered nodes visible and locked-but-visible future nodes greyed out.
- The Waymarker (Traverser sprite) at its current frontier position, or Viewport-scrolled elsewhere per 4.3.
- League counter: current Leagues, and Leagues remaining to the next gate ("653 / 900 Leagues to Jörmungandr's Gate").
- A "Return to the Road" button that snaps the Viewport back to the Waymarker.
- An Explore button, enabled only when the Viewport is centered on a previously-unlocked zone segment.
- Zone name banner reflecting whichever segment the Viewport currently shows.

---

## 5. Daily Wild Encounter Cap

This closes the open item flagged in Sections 1 and 4 ("daily encounter cap... currently unhoused").

### 5.1 Trigger sources

Three sources feed the same daily pool:

1. **Forward travel (passive):** every 1,000 new steps synced (i.e., every 1 League of new forward Waymarker movement), roll a 25% chance of a wild encounter from the zone segment that League falls within.
2. **Workout session bonus (active):** for each tracked HR session at Tier 1 (Moderate) or above, grant 1 guaranteed encounter roll per 15 continuous minutes in the session, up to a **max of 2 bonus rolls per session**. This rewards structured workouts specifically, not just raw step count — matching how the "highly active" persona in Section 1 combines steps with a real workout.
3. **Manual Explore (Section 4.3):** each tap of the Explore button on a previously-unlocked zone consumes one roll from the same daily pool.

### 5.2 Roll resolution

A triggered roll draws from the current zone's wild encounter table (Sections 5–7), using standard drop rates (Section 4). Whether the roll comes from forward travel or a manual Explore action, it's mechanically identical — only the zone table it draws from differs.

### 5.3 Daily cap

**Hard cap: 5 wild encounters per calendar day**, reset at local midnight (same reset cadence as Vigor's daily restore, Section 2). Once the cap is hit, further steps/workouts still earn XP and advance the Waymarker normally — only new wild encounters stop triggering until reset.

### 5.4 Expected volume check against Sections 4 and 8's economy models

| Profile | Passive rolls/day (expected) | Workout bonus rolls | Total expected | Sections 4/8's original assumption |
|---|---|---|---|---|
| Average (7,000 steps, no structured workout) | 7 × 25% = 1.75 | 0 | **~1.75** | 2 enc/day (close — ~12% under) |
| Highly active (10,000 steps + 45 min Vigorous) | 10 × 25% = 2.5 | 2 (capped) | **~4.5** | 4 enc/day (close — ~12% over, cap of 5 absorbs it) |

Both Section 4 (battle items) and Section 8 (gear/loot) explicitly built their weekly-supply models on a "2 enc/day average, 4 enc/day active" placeholder, both flagging that it should be revisited once this section defined the real number. The real expected values (~1.75 and ~4.5) land close enough on both sides that **no rebalancing of Section 4's 35% wild item-drop rate or Section 8's 20%/60% wild/mini-boss gear-drop rates is needed** — the small average-side shortfall (1.75 vs. 2) and active-side overshoot (4.5 vs. 4) roughly offset each other in spirit, and both are well inside the daily cap of 5. Section 8's specific "~4.1 Mortal gear/week" and "~1.3 weeks to a full Mortal set" figures (§5.3, §9) hold up: at ~1.75 wild encounters/day × 7 days × 20% wild gear-drop rate ≈ 2.45 wild Mortal gear/week, plus its own step-goal roll (§5.3) of ~1.25/week, totals ~3.7/week for the average profile — close enough to Section 8's ~4.1 estimate that its "roughly 1.3 weeks to a full Mortal set" conclusion is unaffected.

---

## 6. Zone Visual Identity Notes

Brief art-direction anchors for each Road segment, for Section 12/asset production to expand on:

- **Olympion:** Sun-bleached marble road, white stone columns and olive groves flanking the path, warm golden-hour lighting.
- **Valheon:** Packed frost and dark timber planking, pine forest and jagged fjord cliffs, cool blue-grey palette with amber firelight accents near settlements.
- **Imperion:** Paved Roman stone road (basalt sett pattern) with aqueduct arches in the distance, terracotta and cypress-green palette, more architecturally dense/urban than the prior two zones to sell "empire."
- **Egyptian zone (Phase 2, name TBD):** Not designed here — flagged for Phase 2 art direction. Placeholder terminus should read as sand dunes fading into a heat-haze horizon, hinting at the theme without committing to final direction.

---

## 7. Cross-Section Flags

- **Section 1 (XP/Leveling):** Zone unlock distance thresholds are now fully specified in Leagues (Section 3 above), closing that section's open cross-reference. Cerberus/Valheon-unlock lands the average user at Level 15 — inside the "mid-teens" target Section 1 asked for. This draft also corrects an error from the first pass, which had used Section 1's illustrative 8,000-step Step-XP example instead of its actual 7,000-step average-user baseline — no fault of Section 1's, just a misread on the first draft.
- **Section 4 (Battle Items):** Daily encounter cap is now defined (Section 5 above) — 5/day hard cap, expected volumes of ~1.75 (avg) and ~4.5 (active) land close to the 2/4 placeholder the weekly item-supply model was built on. No changes needed to the 35% wild drop rate.
- **Section 5, 6, 7 (Enemy Rosters):** All boss gate level-window targets are satisfied for the average-user profile; the highly-active profile arrives over-leveled at every gate by design (Section 3, design note) — flagged explicitly since Cacus in particular loses most of its intended tension for that persona. Griffin's gate now lands the average user at Level 44, near the top of its 38–45 window — worth keeping an eye on rather than an active problem.
- **Section 8 (Gear & Loot Tables): FULFILLED.** Section 8 flagged its 60%/20% mini-boss/wild gear-drop rates as needing revisiting once this section's daily encounter cap was final — confirmed in §5.4 above that no revision is needed. Section 8 also noted it has no further dependency on Section 9 beyond the boss gate thresholds Sections 5–7 already flagged, which are now set.
- **Section 10 (Onboarding):** The MVP map is explicitly scoped by the planning doc as "a simple placeholder... enough for the player to land somewhere after the tutorial battle." This section's full spec (Road, Leagues, gates, Explore) is the target state — Section 10 should specify which subset (likely: just the Olympion entry node and Waymarker, no scrolling/Explore yet) ships in the MVP tutorial flow.
- **Section 13 (UI Architecture): FULFILLED.** The full Map screen component spec per Section 4.4 above, the Road orientation decision (vertical, bottom-to-top), and the locked/available/defeated node visual states are all delivered in Section 13 §4.
- **Overactivity warning (90-min threshold): RESOLVED downstream.** Trigger logic is owned by Section 11 §8 (fires at sync time only); the visual component is owned by Section 13 §6.5.

---

## 8. Open Questions

- **Egyptian zone (Phase 2) distance threshold:** Genuinely unresolvable until the Phase 2 roster and Level 61–80 curve exist. When that design work happens, use this section's same methodology (target level window → average-user day count → Leagues) to stay consistent with the calibration approach here.
- **Road orientation and exact rendering approach** (horizontal scroll vs. vertical, isometric vs. flat) is an art/engineering call for Section 12, not a numbers question — flagged rather than assumed.
