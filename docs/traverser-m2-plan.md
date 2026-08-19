# Traverser Build Plan — M2: The Fight

**Status:** planned 2026-08-16, not started. Predecessor: M1 (complete, 2026-08-16).
**Inputs:** GDD 2 (type chart & combat) · GDD 3 (moves) · GDD 4 (battle items) · GDD 5 §1–§3 (Olympion roster, partial) · GDD 10 §5.2, §6, §6.5 (screens 5–7) · GDD 13 §2, §6, §11 · `traverser-tech-02-api-sync.md` §4 step 2, §4.1 · `traverser-tech-04-client.md` §5, §9 · `traverser-tech-05-battle.md` (all) · `traverser-test-fixtures.md` §1, §2, §3, §6, §10 · `DECISIONS.md`.

**Playable outcome:** the tutorial battle is playable end to end — starting gear and Salves are granted, a scripted Wisp is fought and beaten with deterministic damage, and the victory screen reveals the loadout. Outside the tutorial, a debug control starts a real battle against any Olympion enemy at the player's level, resolves it under the full engine, and syncs the result. The app is restyled to the ratified design language throughout.

---

## 1. The ordering constraint that shapes this milestone

**The engine is pure TypeScript and its fixtures already exist, so it can be finished before a single battle pixel is drawn.** T5 §1.1 keeps `src/battle/` free of React and Expo imports, and fixtures §10 was delivered machine-verified at Phase 1 close-out (2026-07-26) — the eight rows T5 §11.8 owed are already on the shelf. That inverts the instinct to build a battle screen and grow the rules behind it.

Two consequences for the packet order:

- **The content bundle comes first (P2), because the engine reads it.** M1 deferred it (`traverser-m1-plan.md` §3.2) on the grounds that nothing read enemy stats, moves or drop tables. Everything in this milestone does.
- **The design language comes before the battle UI (P1), not after it.** M1's Tier 1/Tier 2 split (DECISIONS 2026-08-15) left the layout half undone deliberately, and the components it rebuilds — the segmented control, hairline rows — are the same primitives the battle screens are built from. Restyling after would mean building those screens twice.

The one thing that genuinely cannot move earlier is the device drill set, for the reason M1 proved: RNTL renders a tree, not a layout, and all of M1's device-only defects were layout or platform behaviour.

---

## 2. Scope

### 2.1 In

| Area | What lands | Spec |
|---|---|---|
| Design language | Tier 2 restyle, Spectral embedded, the ratified palette's remaining tokens | GDD 13 §11 (new, §3.1 below) |
| Content bundle | Embedded at build time + `GET /content/bundle`, version negotiation | T4 §5.1, T2 §3 |
| Battle engine | Damage pipeline, type rule, RNG, effects — pure TS | T5 §3, §4, §6 |
| Battle flow | State machine, enemy AI, turn order, snapshot/resume | T5 §5, §7, §8 |
| Battle sync | T2 §4 **step 2** — battle rows, drops, bestiary, vigor | T2 §4, §4.1 |
| Battle UI | The event-queue screen GDD 13 §6 specifies | GDD 13 §6, T5 §9 |
| Onboarding | GDD 10 screens **5, 6, 7** — starting gear, tutorial battle, reveal | GDD 10 §5.2, §6 |
| Items | The Item action and Traveler's Salve, in battle only | GDD 4 |
| Reachability | The type-reachability test M1 owed (§6 below) | fixtures §1 |

### 2.2 Out, and where it lands

| Deferred | Milestone | Why |
|---|---|---|
| T2 §4 steps 7, 8 (gates, encounter grants) | M3 | Encounters are earned on the Road, and the Road is GDD 9 |
| The Road / overworld map (GDD 10 screen 8) | M3 | GDD 9. The design pass's Road screen is redrawn as a vertical climb first (DECISIONS 2026-08-14) |
| Enemy rosters beyond Olympion | M3 | GDD 6, GDD 7 seed at M0 already; nothing selects them until zones exist |
| T2 §4 step 9 (streak, grace) | M4 | GDD 11 |
| T2 §4 step 10 (deterministic rewards) | M3/M4 | Milestone and daily grants |
| T2 §4 step 11 (overactivity) | M4 | GDD 11 §8 |
| Gear beyond the starter Weapon | M3 | GDD 8's loot tables need drop sources, which need encounters |
| **Granting battle drops into the local satchel** | **M3, and it needs one API field** | Added 2026-08-18 (P6). `player_item.id` is a server-minted uuid (T1 §4) and §4.1's drop objects carry only `def_id`, so a client-minted row would be named by an id the server never had — and every later `items_consumed` naming it is a no-op delete, drifting the server's inventory up by one per spend. **The fix is the client minting `player_item_id` and sending it with the drop**, exactly as `activity_date` was added at P5. Not taken at P6 because it is an API change inside a UI packet. Until then the Reveal Card shows the roll and the satchel holds only granted items. See DECISIONS 2026-08-18 |
| Trinkets and gear-granted moves | M3 | GDD 10 §9's own constraint: not until the first Heroic Trinket |
| Battle animation choreography, sprites | M3+ | T5 §13. The engine resolves a turn synchronously; pacing is the UI's problem |
| Audio (battle music, hit stingers) | M5 | No audio bus until M5 |
| T2 §5 backoff + coalescing cap | M5 | Carried from M1 §2.2 unchanged |
| Multi-enemy encounters | never (as specified) | T5 §13 — nothing in GDD 5–7 has one |

---

## 3. Decisions taken at plan time

**3.1 The design language becomes GDD 13 §11, amended in place.** This discharges the obligation the 2026-08-06 deferral placed on this plan (DECISIONS 2026-08-14: *"lands in the M2 plan as the design-language section"*). Of the two permitted forms — widening GDD 13 §10's art phase in writing, or scheduling a section — the section is chosen because §10 covers assets and gear-tier colours, and the thing that has no owner is the app's own skin: background, surface, typography, control styling, radius. Widening §10 would file the skin under "art delivery" and it would arrive with the sprites, which is exactly the M5 failure the 2026-08-04 entry named. §11 records the ratified "Dusk on the Old Roads" palette, the Spectral face, the 2–8px radius scale, and tabular numerals as *design decisions with a date*, so a future screen has something to be built against rather than a `theme.ts` to imitate.

**3.2 Spectral is embedded via the `expo-font` config plugin, not loaded at runtime.** It crosses tech-04 §3.2's rebuild boundary, which is free here — P2's content bundle already forces a rebuild. The alternative (`useFonts` at runtime) needs a loaded-state guard on every screen and shows a fallback flash on cold start, and a battle screen that reflows one frame in is worse than a rebuild. SIL OFL, bundled locally, $0.

**3.3 Non-tutorial battles are started from a debug control, not earned.** Encounter grants (T2 §4 step 8) are M3's, because a grant comes from walking the Road. Without one, the engine would only ever run the scripted tutorial — which bypasses crits, variance *and* the type chart (GDD 10 §6.1), so it exercises almost none of the engine it is meant to prove. The control lives behind the same dev-only flag as the existing debug affordances and is deleted at M3 when real encounters replace it. **This is the one place M2 ships something it intends to remove**, and it is stated here so the removal is scheduled rather than discovered.

**3.4 The tutorial is an engine instance, not a special case.** T5 §7.4 already specifies this: the tutorial is a battle configured with crits, variance and the type chart disabled, not a separate code path. Restating it as a plan decision because the tempting shortcut — scripting screens 6's five turns directly against fixtures §3 — would produce a passing tutorial that proves nothing about the engine, and M1's step-XP bug is the reminder that a thing can look right and be arithmetically wrong.

**3.5 The damage-ceiling question stays open and unaddressed.** T5 §12 flags that fixtures §10.9 disproves GDD 3 and GDD 4's closed "never approaches a one-shot" claim: a Favor-specialised build one-shots Satyr and Cyclops at their normal encounter levels. **M2 implements the locked formula unchanged and asserts a bound (T5 §11.5), changing no game behaviour.** It is a balance call, it is partly self-limiting (a full-Favor build sits at Vigor 20 all game), and the levers are content-table edits. It wants a playtest, which M2 is the first milestone able to give it.

---

## 4. Packets

Each packet is one commit. **↯ The commit subject names the packet number from this plan or no number at all** — M1's labels drifted from its packets and six commits are mis-attributed in `git log` as a result (`traverser-m1-plan.md` §7.1).

### P1 — Design language (GDD 13 §11) & Tier 2 restyle

- Write GDD 13 §11 per decision §3.1: palette with the three scoped additions (`verdigris` mythic/threshold, `oxblood` **enemy health only**, `marble` art plates), the type scale on Spectral, radius 2–8px, tabular numerals, and the inked-silhouette-on-cream-plate art rule.
- Embed Spectral via the `expo-font` config plugin (§3.2). ↯ Rebuild boundary, not a reload (T4 §3.2).
- Tier 2 components, deferred from M1 by regression class: segmented control → underlined tab pair, stat cards → hairline rows, activity rows gaining a proportional step bar.
- The three new tokens land **with their first consumer**, not before — M1 declined to add them for exactly this reason (DECISIONS 2026-08-15), and `oxblood`/`marble` get theirs at P6/P7.

**Tests:** the existing 254 client tests stay green. RNTL cannot see layout, so this packet's real verification is P8's device build — noted here so nobody mistakes a green suite for a working screen.

### P2 — Content bundle (API + client)

- `GET /api/v1/content/bundle` — the seeded content tables as the versioned payload T4 §5.1 describes, authenticated like `/content/version` (M1 §3.3).
- The bundle **embedded at build time** so a never-fetched app is playable (T4 §5.1), with the fetched copy superseding it when newer.
- Version negotiation: M1's client holds `CLIENT_CONTENT_VERSION = 0` and reports it staleness-only. This packet makes the number mean something.

**Tests:** embedded and fetched bundles agree for the same version; a bundle newer than the client's is adopted and one older is ignored; every ID the bundle carries resolves in the manifest.

↯ **`ContentValidationTests` already covers what T5 §12 asked for** — `Every_enemy_has_at_least_one_move` and `Every_enemy_move_weight_is_strictly_positive` shipped at M0. T5 flagged "an enemy whose move rows are missing produces a battle with no enemy actions" as uncaught; it is caught, at seed time. No new work, recorded so it is not rebuilt.

### P3 — Battle engine core (T5 §3, §4, §6)

Pure TypeScript, no React, no Expo (T5 §1.1).

- The damage pipeline **normatively per T5 §3.2**, not per GDD 2 §7's formula line — §3.1 corrects the notation in favour of the GDD's own worked example.
- ↯ **The double floor.** `base = floor((Power × Atk) / (Def × 8))` floors *first*, then multipliers apply and the result floors again. Single-flooring passes four of the five fixture cases; fixtures §10.1 exists to pin it and is the highest-value single test in the suite.
- The type rule as the engine sees it (§3.3): the chart applies **only to the player's own typed attacks**. Enemy moves never get a multiplier; physical moves never get one in either direction.
- `SeededRng` and §4.1's draw order, which is part of the contract — fixtures §10.8 consumes an explicit 18-value sequence rather than a seed, so the fixture is implementation-independent.
- Effects (§6): Surge, Breach, Rend, Fortify, Weaken, including Surge/Breach non-consumption on a mismatched move.

**Tests (delegable — every expected value is already locked):** fixtures §1 (chart), §2 (four damage cases), §10.1–§10.7. **fixtures §10.8 end to end** — the full Harpy L15 battle, round by round, all 18 draws consumed.

**Also this packet: the type-reachability test M1 owed.** For every enemy type in the manifest, compute the level at which the player first has a 2× answer across `skill_*` unlocks **and** Trinket-granted `move_*`, and fail if that level is later than where an enemy of that type first appears. ↯ It belongs here because this is the first packet holding the chart, the unlock ladder and the enemy roster in one place — reachability exists only in that join, and fixtures §1's existing tests all check the matrix in isolation. **It is expected to land red:** storm is unanswerable until `skill_tidecallers_grasp` at L36 while `enemy_harpy` is an Olympion wild encounter (DECISIONS 2026-08-15). Whether that is fixed by encounter weighting, a move's type or an unlock level is a GDD balance call, so **the test may ship with a recorded exemption rather than block the packet** — what it must not do is stay unwritten.

### P4 — State machine, AI, snapshot (T5 §5, §7, §8)

- §7.2's states and §7.3's turn order, including the Stride tie and both-Swift cancellation (fixtures §10.7). ↯ **Stride never receives gear bonuses.**
- §5's enemy AI in full — weighted move selection and nothing else. GDD 5–7 say "no conditional logic" in identical words thirteen times.
- The snapshot (§8) and §8.1's three resume hazards, each with its defined answer. The snapshot write shares a transaction with any item spend (T4 §5.3).
- §7.4: the tutorial as a configured instance (decision §3.4).

**Tests:** fixtures §3 (the tutorial, executed end to end — not asserted screen by screen), §6 (stats and turn order), T5 §11.6 (state machine and AI), §11.7 (snapshot and resume). A battle abandoned mid-turn because content moved returns its grant unspent — a local no-op at M2, since grants do not exist until M3 (T5 §12).

### P5 — Battle sync (API, T2 §4 step 2)

- `battle` rows on `ON CONFLICT (player_id, client_battle_id) DO NOTHING RETURNING`, the whole idempotency story.
- **Drops materialised only for the `RETURNING` set** — the same gate as the bestiary increment. A replayed battle's `drops` array is never read. T2 §4.1 calls deriving this from an "already granted?" lookup the way a boss's Divine drop gets granted twice.
- `player_bestiary` increments, `vigor_after` applied, `vigor_anchor_at` reset, `items_consumed` deleted — all only for newly-inserted battles.
- Battle XP (`15 + level × 2`, wins only) joins the existing §4 step 4 derivation.

**Tests:** **the replay test, extended.** M1's asserts 0 XP and a byte-identical player block on a re-applied payload; M2's must also assert **0 duplicate drops and 0 bestiary increments**. T2 §8 says that if a future change breaks the design, it breaks here.

### P6 — Battle UI (GDD 13 §6, T5 §9)

- The event queue rendered: `damage_dealt` carries `typeMultiplier` so the post-hit callout and the pre-selection chevron cannot disagree (T5 §9).
- Enemy health in `oxblood` — its only sanctioned use.
- The four actions: Attack, Skill, Item, Flee, per GDD 2 §5.

**Tests:** RNTL over the event queue with a stubbed engine. ↯ The engine is already fully tested as pure functions; this packet tests *rendering*, and duplicating damage assertions here would be the second transcription M0 spent a packet avoiding.

### P7 — Onboarding screens 5–7 (GDD 10 §5.2, §6, §6.5)

- Screen 5: starter Mortal Weapon auto-equipped, 3 Traveler's Salves granted **before** the tutorial so the Item action can be demonstrated live rather than explained.
- Screen 6: the tutorial battle, GDD 10 §6.4's script, deterministic per §6.1 — no crits, no variance, no type chart.
- Screen 7: the loadout reveal, on `marble` plates.
- Inserted into the `(onboarding)` stack M1 P8 built for this insertion.
- **Carried from P6, and delivered here: resume an unresolved snapshot on cold start (T5 §8).** ✅ `bootRuntime` resumes before `markBooted`; a battle in progress outranks every other boot destination; §8.1’s three hazards each asserted.

**Tests:** the scripted five turns produce GDD 10 §6.3's verified damage values exactly, executed through the engine (§3.4). A fresh install reaches the hub with the gear equipped, the Salves in the satchel, and the battle recorded. A battle interrupted mid-fight and reopened resumes at the same round, and one whose content moved underneath it is abandoned with the grant unspent (§8.1).

### P8 — Device build, drills

- Build to the Pixel, run the tutorial from a fresh install, fight a debug battle, sync both.
- **Drills, in a sheet with a result column** — the M1 form worked and the four criteria below are device-only.
- ↯ **Reconcile one real row by hand** (§7.1's lesson): take a completed battle and check `battle`, `player_item`, `player_gear`, `player_bestiary` and `activity_day.xp_awarded` against what the screen showed. M1's only real defect was found this way and nothing on a review checklist would have caught it.

### P9 — Close-out review

M1's checklist (`traverser-m1-plan.md` P10) unchanged, plus two items its own delivery earned:

9. **The review takes no new work.** M1's P10 absorbed a design pass and a comment-density pass and ran for a week; a review packet that accepts new work stops being a gate. Anything found that is not a defect goes in the next plan.
10. **One row of real production data is reconciled against the spec's arithmetic**, not just read. Item 2 checks that tests assert against fixtures; it cannot see a formula that is wrong in a way the fixtures never pinned.

### P10 — Wrap-up

- README, `DECISIONS.md`, tech specs amended in place per the dated-blockquote convention.
- Mark this plan complete with a §7 delivery table and a §7.1 divergence section.
- `traverser-m3-plan.md`.

---

## 5. Exit criteria

Verified at P9, before the wrap-up. M2 is done when, on the Pixel:

1. A fresh install reaches the tutorial, fights it, and wins with GDD 10 §6.3's exact damage values on screen.
2. The starter Weapon is equipped and 3 Salves are in the satchel before the first turn; using one in battle consumes exactly one.
3. A debug battle against an Olympion enemy at the player's level resolves under the full engine — crits, variance and the type chart all live — and the type callout matches the chart.
4. Winning a battle grants its drops once. **Killing the app after the win and reopening grants nothing a second time.**
5. Losing a battle costs no XP and leaves the player at the 25% Vigor floor.
6. A battle interrupted by force-stop resumes from its snapshot on the same turn, with the same enemy health and the same item count.
7. The app renders in Spectral from first paint, with no fallback flash on cold start.
8. M1's eight criteria still pass — steps and HR minutes still sync, and the activity log still reconciles.

---

## 6. Cross-spec flags

- **The design-language obligation from 2026-08-06 is discharged by §3.1 and P1**, as GDD 13 §11 rather than a widening of §10. This is the item M1 P10 was amended to check for rather than resolve; M2 P9 checks that §11 exists and that no screen built in this milestone hardcodes a colour outside it.
- **The type-reachability test is written at P3 and may ship red with a recorded exemption.** M1 §6 owed it to this milestone. The failure it is expected to record (storm unanswerable until L36) is a GDD balance call, and the three content-only levers are named in DECISIONS 2026-08-15.
- **T5 §12's manifest flag is already satisfied** — `ContentValidationTests` covers both halves at seed time. Recorded so P2 does not rebuild it.
- **GDD 2 §7's worked-example erratum** ("a Sea-aligned enemy … ×2.0 vs Storm", where the chart in the same section puts Storm → Sea at 0.5×) is a one-word documentation fix, no balance impact, fixtures §2 unaffected. Fix it at P3 while the chart is open.
- **The damage-ceiling question (T5 §12, fixtures §10.9) stays open by decision §3.5** and wants a playtest pass, which this is the first milestone able to give it. If it needs addressing, the levers are Surge's ×1.5 or the per-battle charm supply — both content-table edits, no engine change.
- **The debug battle control is scheduled for deletion at M3** (§3.3), when encounter grants replace it.
- **M3 inherits** the Road (GDD 9, redrawn as a vertical climb), encounter grants and gates (T2 §4 steps 7–8), the Valheon and Imperion rosters, gear beyond the starter Weapon, and Trinkets with their gear-granted moves.
- **Manifest:** M2 introduces no content IDs. It makes `enemy_move` weights and `enemy_drop_pool` load-bearing at runtime for the first time — the seed already validates both.
