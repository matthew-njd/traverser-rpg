# Traverser M5 build plan — "The Realm"

**Milestone:** M5. **Predecessor:** `traverser-m4-plan.md` (complete, 2026-10-24).
**Status:** complete, 2026-10-28. See §7.
**Theme:** finish the game before dressing it.

M4 made the loop pay off: gear equips, the game explains its stats and moves, the streak counts, and
the Road's bosses can be fought. What remains splits cleanly in two:

- **The game is not finished.** The fourth gear slot, gear-granted moves, the milestone rewards, the
  overactivity warning, the Satchel tab and every word of GDD 12's story are unbuilt. The boss fights
  M4 built open and close in silence.
- **The game is not dressed.** Sound, notifications, real art and release polish have not started.

The kickoff's M5, "The Song", held both halves. **Matthew split it on 2026-10-24** (DECISIONS): M5
finishes the game, and M6, "The Song", dresses it. Each is about the size of M3 or M4.

---

## 1. The ordering constraint that shapes this milestone

**The Satchel's Gear sub-view comes first, because every reward in this milestone is gear.** The
streak ladder (GDD 11 §5.2) and the level milestones (GDD 8 §5.4) grant pieces, the Trinket is the
fourth slot, and a gear-granted move needs a Trinket to be worn. All of them land on a screen that
does not exist yet: P1 put the Gear card on Character, and GDD 13 §5.1 puts it on the Satchel tab
(DECISIONS 2026-10-24). Building the rewards first would mean building their display twice.

The rest of the order is looser. The lore packet is independent of everything else. The polish
packet is small and goes last so the drills feel every fix at once.

---

## 2. Scope

### 2.1 In

| Item | Source | Note |
|---|---|---|
| Satchel tab: Gear and Items sub-views, the Trinket slot | GDD 13 §5.1, GDD 8 §2 | Decided 2026-10-24 (M4 §2.2). The Gear card leaves Character; the Vigour card stays. Ends M3 note 7. |
| Gear-granted moves | GDD 8 §4, GDD 10 §9 | Mythic and Divine Trinkets only. The `gear_move` rows are already seeded. |
| T2 §4 step 10 — deterministic rewards | GDD 8 §5.3–5.4, GDD 11 §5 | Daily goal, level milestones, streak milestones, zone-entry grants. Brings the streak popover (GDD 13 §3.1, DECISIONS 2026-10-24). |
| T2 §4 step 11 — the overactivity warning | GDD 11 §8 | In-app banner, never a push. |
| Story and lore | GDD 12 | Never scheduled by any plan (M4 §7.2 item 5). Zone-entry narratives, boss intro and defeat text, wild flavour text. |
| Road layout: collapsible encounters, one Explore button | GDD 13 §4 | Decided 2026-10-24 (M4 §2.2). |
| The actor-change beat (M3 note 16) | GDD 13 §6 | Dropped from M4's scope by omission (M4 §7.2 item 5). Polish. |
| The restore door's silence (M3 note 17), and the discarded read window | GDD 10, T3 §4.1 | Carried from M4 §2.2. Same screen, same kind of choice. |
| T2 §5 backoff schedule and 5,000-entry coalescing cap | T2 §5 | Assigned to M5 by M1 and M2, then dropped from M3's and M4's lists (M4 §7.2 item 5). |
| Device drills, close-out review, wrap-up | — | The M4 form. |

### 2.2 Out, and where it lands

| Item | Milestone | Why |
|---|---|---|
| Sound design and the audio bus | M6 | GDD 14. "The Song" is the milestone's name. |
| Audio sliders in Settings | M6 | No audio bus until M6 (M1 §2.2). |
| Fixed-time daily notification, and its permission screen | M6 | GDD 11 §6–7, GDD 10 screen 10. Local notifications only (CLAUDE.md). |
| The art phase: sprites, tier art, iconography | M6 | GDD 13 §10. Has never had a milestone (M4 §7.2 item 8). M6's plan decides how art is sourced on a $0 stack. It carries M4's three art rows by name: battle sprites and animation choreography (T5 §13), zone visual identity and Road art (GDD 9 §6), and layered gear sprites with tier colours (GDD 8). |
| The `›` on **Battle ›** and **Battle again ›** reads as a dot | M6 | Drill note 5. Iconography, so the art phase replaces it. |
| `metro.config.js`, source-map upload | M6 | Release work. Recorded at M0 close-out. |
| The home-lab decision and the second restore drill | M6 | T6 §11 and §10.6 named "M5"; that meant the ship milestone, which is now M6. |
| A respec | undecided | Carried from M4 §2.2. A design question, not a gap. |
| In-game codex or help screen | undecided | Carried from M4 §2.2. Still needs a GDD 13 amendment first. May fold into the bestiary decision (§3.2). |
| Shorten or skip a boss's intro on a rematch | undecided | Drill note 4. GDD 12 §2 plays the intro at every boss encounter start; changing it is a GDD 12 amendment first. |
| A further pass on the battle screen's UI | undecided | Matthew may revisit it after P7c. No known defect. |
| The Egyptian zone | Phase 2 | GDD 9, GDD 12 §9. |

---

## 3. Decisions taken at plan time

### 3.1 The data exists; this milestone is behaviour

The content for every reward system in §2.1 is already in the seed and the client bundle:
`gear_move` (the Trinket moves), `level_milestone`, `streak_milestone`, `milestone_grant` and the
`daily_goal` drop rows. `GearSlot.Trinket` exists on the server, and the equip endpoint already
validates any slot against the piece's `gear_def`. What is missing is the code that reads those rows.

↯ **Step 10's idempotency is the ledger, not the sync.** T2 §4 gates every reward on an
`INSERT INTO milestone_grant ... ON CONFLICT DO NOTHING` that must report a row. A reward that keys off
"did this sync already run" pays twice on a replay — the same shape M1's step-XP defect had.

### 3.2 Two lore questions are open, and are answered at the packet

These are not decided here (DECISIONS records a decision only after Matthew picks).

1. ~~**Where lore text lives.**~~ **Closed 2026-10-25 (P5): columns on `enemy` and `zone`.** No table and no manifest IDs exist for it. The recommendation is a
   content table in the seed, keyed by manifest IDs, so text arrives with the bundle like every other
   display string. That means manifest IDs and a T1 amendment **before** code (CLAUDE.md: never
   invent IDs).
2. ~~**Where the bestiary lives.**~~ **Closed 2026-10-25 (P1).** GDD 13 §5.3 already places it as the
   Satchel's third sub-tab; this question was stale. P5 builds it there (DECISIONS).

### 3.3 Balance is measured, not retuned

M4's drills measured the boss ceilings for the first time, and all held (M4 §7.1). The one open
reading is the L22 skill-unlock cliff, where Fenrir costs about 25 points less across two levels.
`balance.test.ts` already models it. M5 adds a check that reports unlock cliffs and asks whether any
breaks a ceiling; it retunes nothing unless one does.

---

## 4. Packets

The commit subject names the packet number from this plan or no number at all.

### P1 — The Satchel tab, with four slots (GDD 13 §5.1)

- The Satchel tab gets its Gear and Items sub-views, with Gear the default. Gear shows the four slots
  in a row, with a per-slot comparison before equipping.
- The Gear card leaves Character. The Vigour card stays, beside Rest Day.
- The Trinket slot equips like the others. Its bonus splits across Favour and Aegis (GDD 8 §3.1).
  ↯ `progression/stats.ts` deliberately leaves the Trinket out of its slot table, so `effectiveStats`
  ignores a worn one today. It needs both halves, `bonus_primary` and `bonus_secondary`.
- ↯ The open-battle refusal moves with the control. It must not be lost in the move between tabs.
- **Healing items can be used from Items** (GDD 4 §4), added 2026-10-25. A new T2 endpoint replays
  the use, with the item row as its ledger.

**Tests:** a Trinket equips into the fourth slot and moves both stats; the refusal still holds from
the Satchel; the Items list matches `player_item`; a heal stacks on accrued regen, stops at max, is
refused when full or in a fight, and a replayed use changes nothing.

### P2 — The skill loadout, and gear-granted moves (GDD 2 §5, GDD 8 §4)

- **The loadout picker comes first**, added 2026-10-25: no plan had built GDD 2 §5's choice, so
  skills past the fourth never reached the battle menu. A Skills card on Character's Stats pane
  (GDD 13 §3.2, amended), `PUT /skills`, and the loadout on the profile.
- A worn Mythic or Divine Trinket adds its move to the loadout's pool, competing for the four
  slots (GDD 3 §4.1). A Divine move's effect applies after its own hit.
- Uses replenish each battle, as for every other Divine move.
- ↯ The move is read when the battle is built, like the stat block. Taking the Trinket off mid-fight
  is already refused, so the frozen copy cannot go stale.

**Tests:** a Mythic Trinket's move is offered and a Heroic one has none; its damage asserts against a
fixtures row; the move leaves the list when the Trinket comes off. ↯ No fixture pins a gear move yet,
so the machine-verified row comes first, the same order T5 §10 followed. Fixtures §10.10 added.
Also: unchosen slots fill in unlock order; a stored choice survives a restore; a swap is refused in a
fight.

### P3 — Deterministic rewards (T2 §4 step 10)

- The daily-goal item (and GDD 8 §5.3's 25% Mortal piece), level milestones, streak milestones
  (with GDD 11 §5.3's overlap rule) and zone-entry grants, each behind its `milestone_grant` row.
- The daily "road find" goes straight into the satchel, flagged new: a Satchel badge and a highlight
  in Items (GDD 13 §5.2). Decided 2026-10-25.
- A reward that would pass the 12-piece or 20-item cap parks as a `pending_reward`; P3b resolves it.
- The streak popover on the badge, previewing the next milestone.
- Rewards reveal on the device the same way drops do.

**Tests:** each reward lands once and a replayed sync grants nothing; the overlap rule follows GDD
11 §5.3 (fixtures §7, amended); no Trinket is ever a streak reward (GDD 11 §5.1); a reward past a cap
parks rather than vanishing.

### P3b — The caps and the overflow prompt (GDD 8 §5.5, GDD 4 §5.1–5.2, GDD 13 §5.1–5.2)

Split from P3 on 2026-10-25 (Matthew's choice). No plan had scheduled any of it.

- 12 gear pieces and 20 items, and GDD 4 §5.1's per-item maximums (5 Salves, 3 of each charm…),
  which stop a drop at acquisition.
- The keep/discard modal: on the victory panel for battle drops, and for `pending_reward` rows.
- T2's discard and pending-reward endpoints, both unbuilt.

**Tests:** a 13th piece or a 21st item prompts and is never silently lost; a sixth Salve does not
drop; a kept pending reward lands once.

### P4 — The overactivity warning (T2 §4 step 11, GDD 11 §8)

- At 90 cumulative Tier 1+ minutes in a session, the sync response flags the warning once per session.
- An in-app banner, never a push. Sessions that ended before the app opened do not fire it.
- ↯ **Nothing here is punitive** (GDD 11 §8.4). It is a care message, not a penalty.

**Tests:** fires at 90 and not at 89; once per session; never for a closed session.

### P5 — Story and lore (GDD 12)

- §3.2 answered 2026-10-25: the text lives in columns on `enemy` and `zone`, keyed by IDs that
  already exist, so no manifest IDs are added. T1 is amended for the columns.
- Boss intro lines at fight start, defeat text at the end, with the shortened line on a repeat kill.
- A zone-entry narrative after a final boss's first defeat text (GDD 12 §2's timing), Valheon and
  Imperion only.
- Wild flavour text on first sighting, in the boss-intro box at the start of the first fight, and
  viewable again from the bestiary.
- The bestiary, as the Road's second sub-tab beside Path (GDD 13 §5.3, amended; DECISIONS).
- ↯ Every beat is skippable after its first viewing and none gates anything (GDD 12 §1).

**Tests:** each beat fires on its trigger and only there; a narrative shows once; every enemy and
boss in the roster has its text.

### P5b — The two one-time screens (GDD 10 §7.2, GDD 13 §6.4)

Split from P5 on 2026-10-25 (DECISIONS).

- GDD 10 §7.2's Level 6 type screen, before the next battle. Never built and never scheduled; a
  player already past Level 6 sees it once.
- The secondary-effect overlay, the first time a Divine move is in the loadout at battle start. The
  copy comes from GDD 3 §4.3's table, and GDD 13 §6.4 is amended with it.
- Both share one mechanism: a device flag per screen, so each shows once.

**Tests:** each screen shows once and only on its trigger; neither shows during the tutorial.

### P6 — The Road layout (GDD 13 §4)

- The encounters card collapses by default to two fixed lines: the next enemy and **Battle ›**, over
  the count and **Show all ▾**.
- The Road now has two sub-views, Path and Bestiary (P5). Everything below is Path's, and the
  Explore button shows on Path only.
- **One floating Explore button at the bottom left, acting on a selected zone**, replacing the
  per-zone buttons. Decided 2026-10-25 (DECISIONS):
  - The target defaults to the zone the Waymarker is in, the stretch of road being walked.
  - Tapping another unlocked zone card selects it: the card is highlighted and the button relabels.
    A locked zone cannot be selected.
  - The label names the target, "Explore Valheon", so no tap is a surprise.
  - ↯ Not GDD 13 §4's "centred on the Viewport": the Road is a vertical list, and a target derived
    from scroll position is the ambiguity DECISIONS 2026-08-22 rejected. The selection is explicit.
  - GDD 13 §4.2 amended 2026-10-25, when built.

**Tests:** the card stays one row high with any number waiting; Explore targets the Waymarker's
zone by default; selecting another unlocked zone retargets it and relabels the button; a locked zone
cannot be selected.

### P7 — Polish and reliability

- **Note 16:** a longer beat when the turn passes from the player to the enemy, so the counter reads
  as a reply. One timing constant; feel it on the device.
- **Note 17 and the read window:** say that the restore door is closing, and warn before a restore
  discards unread days, or show "last synced N days ago".
- **T2 §5:** the backoff schedule and the 5,000-entry coalescing cap.
- The unlock-cliff check (§3.3).

**Tests:** the actor-change beat is longer than the line beat; backoff follows T2 §5's schedule;
coalescing keeps the queue at the cap with nothing lost.

### P7c — The combat log, redesigned (GDD 13 §6.1)

Split from P7 on 2026-10-25 (DECISIONS), and built before P7b. Found on the device: when the enemy
is faster it strikes first, its line lands before the player's, and no line names who acted.

- Name the actor on every line, and say why a side went first ("Harpy is faster — it strikes first").
- Separate the two sides at a glance, and mark where a round begins.
- Revisit note 16's beat: where it falls once lines name their actor, or whether it is needed.
- A layout proposal and mockup go to Matthew before building. Amend GDD 13 §6.1 when built.

**Tests:** every line names its actor; turn order is stated when the enemy goes first; the beat
falls where the design puts it.

### P7b — The balance pass (GDD 2 §7)

Split from P7 on 2026-10-25 (DECISIONS). The full-level sweep found four enemies over §7's ceilings.

- Make `balance.test.ts` sweep every level from each gate to 60, not eight samples.
- Trim the growth rates of Valkyrie, Draugr, Fenrir and Lemures until every level holds.
- Amend GDDs 6–7 and the fixtures as a recorded design change, and regenerate the content.

**Tests:** the sweep passes at every level for all twelve enemies.

### P8 — Device build, drills

The M4 form: a sheet with a result column and a notes table.

- ↯ **Write the drills against the build, not against the spec.**
- ↯ **Reconcile one real row by hand.** Make it a step 10 reward, since that is the new ledger.
- ↯ **Seed a boss drill to the gate's own level** (M4 §7.1), or the reading measures the seed.

### P9 — Close-out review

M4's ten-item checklist, unchanged.

### P10 — Wrap-up

- README, `DECISIONS.md`, tech specs amended in place.
- This plan's §7 delivery table and §7.1 divergences.
- `traverser-m6-plan.md`.

---

## 5. Exit criteria

Verified at P8, before the wrap-up. M5 is done when, on the Pixel:

1. The Satchel tab shows Gear with four slots and Items, and Character no longer holds the Gear card.
2. A Trinket can be worn, and its bonus shows on both stats it splits across.
3. A worn Mythic or Divine Trinket's move can be used in battle.
4. A level milestone and a streak milestone each land once, and a replayed sync grants nothing.
5. The overactivity banner appears once in a long session and never as a notification.
6. A boss fight opens with its intro lines and closes with its defeat text.
7. A final boss's first defeat leads into the next zone's entry narrative.
8. A wild enemy's flavour text can be read again after its first sighting.
9. The Road's encounters card stays one row high, and one Explore button serves every zone.
10. M4's eleven criteria still pass.

---

## 6. Cross-spec flags

- **GDD 12 has no tech spec.** T1 has no lore table and the manifest has no lore IDs. P5 starts with
  those, not with screens. The bestiary's place is settled: GDD 13 §5.3 (§3.2).
- **GDD 8 §4's first Divine Trinket needs a secondary-effect tooltip** that Section 3 routed to
  Section 12. GDD 12 does not cover it. P2 gives every Trinket effect a combat-log line; the
  one-time overlay GDD 13 §6.4 lists goes with P5's other overlays.
- **Note 2 (encounters never expire) remains spec-correct and unaddressed.** Carried from M4 §6.
- ~~**T6 names "M5" for the home-lab decision and the second restore drill.**~~ **Closed at P10:** T6
  is amended, and both are in `traverser-m6-plan.md`.

---

## 7. Packets, as delivered

| Plan packet | Commit(s) | Date | Contents |
|---|---|---|---|
| **P1** | `070b41e` | 10-25 | The Satchel tab: Gear with four slots including the Trinket, and Items. The Gear card leaves Character. Healing items usable from the Satchel, and T2 gains the endpoint. The caps and the overflow prompt were moved into P3 here. |
| **P2** | `f8bd9e9`, `3571f3b` | 10-25 | The skill loadout, never built before: from Level 22, every later skill had been unreachable. Gear-granted moves in the same four slots. Then Character's four sub-views, Avatar, Stats, Skills and Activity, at Matthew's request. GDD 13 and T1 amended. |
| **P3** | `b4c039e` | 10-25 | T2 §4 step 10: the daily goal's road find and Mortal piece, level and streak milestones, zone-entry grants, the reveal and the streak popover. `milestone_grant` gains `daily_goal`. T1, T2 and fixtures §7 amended. |
| **P3b** | `6582993` | 10-25 | Split from P3. The 12-piece and 20-item caps, per-item maximums, the keep/discard prompt and parked-reward resolution. |
| **P4** | `08cf5b2` | 10-25 | T2 §4 step 11: the overactivity warning and its banner host. |
| **P5** | `6bfd0e5` | 10-25 | GDD 12's text, verbatim, in columns on `enemy` and `zone`: boss intros and defeat text, zone-entry narratives, wild flavour. The Bestiary moves to the Road as Path \| Bestiary. GDD 13 and T1 amended. |
| **P5b** | `fb0ada2` | 10-25 | Split from P5. The one-time type and secondary-effect screens. GDD 13 §4.4 and §6.4 amended. |
| **P6** | `bb1489e` | 10-25 | The Road layout: the two-line encounters card, one Explore button acting on a selected zone, the ◆ return button and the Battle labels. Many rounds on the device with Matthew. GDD 13 §4.2 amended. |
| **P7** | `e3d41a1` | 10-25 | Restore warnings and the gap banner, T2 §5's retry backoff and the queue cap, and note 16's beat. A full-level balance sweep found four enemies over GDD 2 §7, and P7b and P7c were split off. |
| **P7c** | `be9a09e` | 10-25 | The combat log, redesigned: two-sided, every line names its actor, a beat when the side changes, the enemy's Vigour as x/y. GDD 13 §6.1 amended. |
| **P7b** | `d488422` | 10-26 | Four growth-rate trims (Valkyrie and Fenrir Vigor, Draugr Favor, Lemures Resolve), and `balance.test.ts` sweeps every level. GDDs 6–7 and fixtures §6 amended, content version 6. |
| **P8** | `3176be5`, `08a1d16` | 10-26 – 10-28 | Ten drills, all ten exit criteria pass. Two defects found and fixed. Drill 5 ran at a temporary threshold. |
| **P9** | `0135564` | 10-28 | Close-out review, ten items. Item 5 failed as found and was corrected in §2.2. See §7.2. |
| **P10** | *this packet* | 10-28 | Wrap-up: this section, T3 §4.1, GDD 13 §6.5 and T6 amended, the README, and `traverser-m6-plan.md`. |

### 7.1 Where the delivery diverged from the intent

- **Four packets split, and none was planned to.** P3b, P5b, P7b and P7c each came out of a packet that turned out to hold two decisions. Every split was Matthew's call, made before the second half was built, so no packet landed half-done. *Lesson: when a packet's work reaches a choice the player will see, split it there rather than guess.*

- **"Unscheduled" kept meaning "already owned by a GDD".** The skill loadout (GDD 2 §5), healing between fights (GDD 4 §4), the caps and the overflow prompt (GDD 8 §5.5, GDD 4 §5.1), the Level 6 type screen (GDD 10 §7.2) and the Bestiary's place (GDD 13 §5.3) were each found unbuilt, and each was in a locked section all along. The loadout cost the most: from Level 22, every later skill had been unreachable since M2. *Lesson: before calling anything unowned, grep the GDDs for it.*

- **The balance test passed while four enemies broke the ceilings.** GDD 2 §7 says its invariants hold "at every level", and the test checked eight. A full sweep found Valkyrie at 40% against 30%, Draugr at 32%, Fenrir at 77% against 75%, and Lemures at 6 rounds against 5, all just below the L22 skill unlock M4 flagged. §3.3 said nothing would be retuned unless a ceiling broke, and four did. Drill 10's three Lemures fights then cost 12–15% at 3 rounds each. *Lesson: a property stated for every level needs a test at every level.*

- **A trap documented at one call site was missed at two others.** `battleInProgress` already explained that a settled fight stays in the store, so `snapshot !== null` reads a finished fight as open. Both layouts used that check anyway. After any fight, the reward reveal, the keep/discard prompt and both banners stayed hidden until a restart. Drill 3 found it, and drill 5 would have failed on it. The fix is one selector the three share. *Lesson: when a comment warns against an expression, give the right expression a name, so the wrong one has no reason to exist.*

- **The first defect was found while writing the drill sheet, not while running it.** Reading the server's state for the expected values showed a piece the phone held and the server didn't. A sync response computed before the device's keep replayed brought the reward back, and the second answer discarded the piece just kept. *Lesson: reconciling one row by hand pays even before the drills, which is why drill 9 is never skipped.*

- **A 90-minute session doesn't fit a drill schedule.** Drill 5 needed a real long workout, and the dev build can't start without Metro. It ran at a temporary 10-minute threshold that was never committed, with the device path real and `OveractivityTests` pinning the 90. *Lesson: a drill whose input takes hours should plan its simulation upfront. M6's release build also removes the Metro tether.*

- **The packets absorbed the polish this time, not the drills.** P6 and P7c went through many rounds on the device with Matthew before they were committed, so the drills found two defects and no design changes. M4 was the opposite.

### 7.2 Close-out review (P9) result

Ten items, M4's checklist unchanged.

| # | Item | Result |
|---|---|---|
| 1 | Every spec amendment has code behind it | PASS, with one owed amendment. All 25 M5 amendments were built in their packets. P7's gap banner existed only in `DECISIONS.md`; T3 §4.1 and GDD 13 §6.5 are amended at P10. |
| 2 | Tests assert against fixtures | PASS. Every packet's stated tests exist, including P7b's every-level sweep and fixtures §10.10's Trinket moves. |
| 3 | In-scope T2 §4 steps built | PASS. Step 10 at P3 and P3b, step 11 at P4. |
| 4 | Obligations discharged | PASS. The backup task ran nightly through M5, with Drive dumps from 10-25 to 10-28 and a last result of 0. |
| 5 | Nothing deferred silently | **FAILED as found, corrected at P9.** Drill notes 4 and 5 and a possible battle-UI pass had no row, and M4's three art rows had folded into one unnamed row. All four are now in §2.2. Every M4 §2.2 row and inherited flag maps to a packet or a row. |
| 6 | Suites green, tree clean | PASS. 285 API and 804 client tests, `tsc` exit 0, clean at `08a1d16`. |
| 7 | `⟨verify⟩` markers resolved | PASS. M5 introduced none. |
| 8 | The visual style has a named owner | PASS. GDD 13 §11 owns the skin, and the art phase is M6's. |
| 9 | The review takes no new work | PASS. Every correction is documentation. |
| 10 | One row of real production data reconciled | PASS. Drill 9: Paragon's Guard matched by id on both sides, six claims. |
