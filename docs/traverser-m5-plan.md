# Traverser M5 build plan — "The Realm"

**Milestone:** M5. **Predecessor:** `traverser-m4-plan.md` (complete, 2026-10-24).
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
| The art phase: sprites, tier art, iconography | M6 | GDD 13 §10. Has never had a milestone (M4 §7.2 item 8). M6's plan decides how art is sourced on a $0 stack. |
| `metro.config.js`, source-map upload | M6 | Release work. Recorded at M0 close-out. |
| The home-lab decision and the second restore drill | M6 | T6 §11 and §10.6 named "M5"; that meant the ship milestone, which is now M6. |
| A respec | undecided | Carried from M4 §2.2. A design question, not a gap. |
| In-game codex or help screen | undecided | Carried from M4 §2.2. Still needs a GDD 13 amendment first. May fold into the bestiary decision (§3.2). |
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

1. **Where lore text lives.** No table and no manifest IDs exist for it. The recommendation is a
   content table in the seed, keyed by manifest IDs, so text arrives with the bundle like every other
   display string. That means manifest IDs and a T1 amendment **before** code (CLAUDE.md: never
   invent IDs).
2. **Where the bestiary lives.** GDD 12 §11 leaves the screen to GDD 13 and GDD 13 never chose one.
   The recommendation is to decide it with a mockup first, as M3's P4a did for the action layout.

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

**Tests:** a Trinket equips into the fourth slot and moves both stats; the refusal still holds from
the Satchel; the Items list matches `player_item`.

### P2 — Gear-granted moves (GDD 8 §4)

- A worn Mythic or Divine Trinket adds its move to the battle's move list for that fight.
- Uses replenish each battle, as for every other Divine move.
- ↯ The move is read when the battle is built, like the stat block. Taking the Trinket off mid-fight
  is already refused, so the frozen copy cannot go stale.

**Tests:** a Mythic Trinket's move is offered and a Heroic one has none; its damage asserts against a
fixtures row; the move leaves the list when the Trinket comes off. ↯ No fixture pins a gear move yet,
so the machine-verified row comes first, the same order T5 §10 followed.

### P3 — Deterministic rewards (T2 §4 step 10)

- The daily-goal item, level milestones, streak milestones (with GDD 11 §5.3's overlap rule) and
  zone-entry grants, each behind its `milestone_grant` row.
- The streak popover on the badge, previewing the next milestone.
- Rewards reveal on the device the same way drops do.

**Tests:** each reward lands once and a replayed sync grants nothing; the overlap rule skips a tier
already reached; no Trinket is ever a streak reward (GDD 11 §5.1).

### P4 — The overactivity warning (T2 §4 step 11, GDD 11 §8)

- At 90 cumulative Tier 1+ minutes in a session, the sync response flags the warning once per session.
- An in-app banner, never a push. Sessions that ended before the app opened do not fire it.
- ↯ **Nothing here is punitive** (GDD 11 §8.4). It is a care message, not a penalty.

**Tests:** fires at 90 and not at 89; once per session; never for a closed session.

### P5 — Story and lore (GDD 12)

- Answer §3.2's two questions first, then the manifest IDs and the T1 amendment.
- Boss intro lines at fight start, defeat text at the end, with the shortened line on a repeat kill.
- A zone-entry narrative after a final boss's first defeat text (GDD 12 §2's timing), Valheon and
  Imperion only.
- Wild flavour text on first sighting, viewable again from the bestiary.
- ↯ Every beat is skippable after its first viewing and none gates anything (GDD 12 §1).

**Tests:** each beat fires on its trigger and only there; a narrative shows once; every enemy and
boss in the roster has its text.

### P6 — The Road layout (GDD 13 §4)

- The encounters card collapses by default to a count, **Face the next ›** and **Show all ▾**.
- One floating Explore button at the bottom left, enabled when the Viewport is on an unlocked zone,
  replacing the per-zone buttons.

**Tests:** the card stays one row high with any number waiting; Explore is disabled on a locked zone.

### P7 — Polish and reliability

- **Note 16:** a longer beat when the turn passes from the player to the enemy, so the counter reads
  as a reply. One timing constant; feel it on the device.
- **Note 17 and the read window:** say that the restore door is closing, and warn before a restore
  discards unread days, or show "last synced N days ago".
- **T2 §5:** the backoff schedule and the 5,000-entry coalescing cap.
- The unlock-cliff check (§3.3).

**Tests:** the actor-change beat is longer than the line beat; backoff follows T2 §5's schedule;
coalescing keeps the queue at the cap with nothing lost.

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

- **GDD 12 has no tech spec.** T1 has no lore table, the manifest has no lore IDs, and GDD 13 never
  placed the bestiary. P5 starts with those, not with screens.
- **GDD 8 §4's first Divine Trinket needs a secondary-effect tooltip** that Section 3 routed to
  Section 12. GDD 12 does not cover it. P2 or P5 must place it, or record where it goes.
- **Note 2 (encounters never expire) remains spec-correct and unaddressed.** Carried from M4 §6.
- **T6 names "M5" for the home-lab decision and the second restore drill.** Both now mean M6. Amend
  T6 when M6 is planned, not before.
