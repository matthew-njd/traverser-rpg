# Traverser M3 build plan — "The Road"

**Milestone:** M3. **Predecessor:** `traverser-m2-plan.md` (complete, 2026-08-22).
**Theme:** the walk and the battle become one loop.

M1 made steps into XP. M2 made a battle work. Neither connected them: an encounter is reachable
today only from a debug card behind `__DEV__`, so in ordinary play **nothing a player does on foot
ever starts a fight**. M3 builds the surface that joins them — GDD 9's Road, its gates, and the
encounter grants that fall out of walking — and repairs the four M2 gaps that stop the loop being
survivable once it exists.

---

## 1. The ordering constraint that shapes this milestone

**The Road is a server system with a screen, not a screen with a server system.** T2 §4 steps 7 and
8 — gate evaluation and encounter checkpoints — run inside the sync transaction and are the only
authority on whether an encounter happened. The map screen renders `GET /players/me/map`, which
tech-01 §4 says stores nothing: gate state is computed from `lifetime_steps`, `zone_gate` and
`player_bestiary` on every read.

So the order is forced: the two sync steps, then the map read, then the screen, then Explore. Building
the screen first would mean inventing client-side gate state that the server would immediately
contradict.

**The loop repairs are not sequenced against the Road** and can land in any packet. They are grouped
early because two of them (Vigor recovery, the satchel refresh) make the Road's own drills possible —
without Vigor recovery a tester is unplayable after two losses, which is exactly what happened during
M2's drills.

---

## 2. Scope

### 2.1 In

| Area | What | Spec |
|---|---|---|
| Vigor recovery | Passive regen, daily reset, Rest Day restore | GDD 2 §6 |
| Loot visibility | Reveal Card + the local drop grant, landing together | GDD 13 §6.3, T5 §10.1 |
| Inventory drift | The satchel refreshes on an ordinary sync | T2 §3 |
| Sync reliability | A battle settling mid-pass is not stranded | T4 §7.2 |
| Battle pacing | Combat-log line delay, Vigor bars animate | GDD 13 §6 |
| Gate evaluation | T2 §4 step 7 | T2 §4, GDD 9 §3 |
| Encounter checkpoints | T2 §4 step 8 — travel, session bonus, Explore; the 5/day cap | T2 §4, GDD 9 §5 |
| Map read | `GET /players/me/map`, derived on every read | T2 §3, tech-01 §4 |
| The Road screen | Winding path, three segments, node states, Waymarker, Viewport | GDD 9 §4 |
| Explore | Manual roll against a previously-unlocked segment | GDD 9 §4.3, §5.1 |
| Zone unlock | Dual gate — distance **and** prior boss | GDD 9 §3 |
| Rosters | Valheon and Imperion become selectable | GDD 6, GDD 7 |

### 2.2 Out, and where it lands

| Item | Milestone | Why |
|---|---|---|
| Gear beyond the starter Weapon; GDD 8's loot tables | M4 | Needs drop sources, which this milestone builds. Resolving a tier to a piece is the blocker below. |
| Trinkets and gear-granted moves | M4 | GDD 10 §9's own constraint: not until the first Heroic Trinket. |
| T2 §4 step 9 (streak, grace) | M4 | GDD 11. |
| T2 §4 step 10 (deterministic rewards) | M4 | Milestone and daily grants. |
| T2 §4 step 11 (overactivity) | M4 | GDD 11 §8. |
| Battle sprites, animation choreography | M4+ | T5 §13. **Pacing is in scope; art is not** — see §3.4. |
| Zone visual identity, Road art | Art phase | GDD 9 §6, GDD 13 §10. M3 ships the Road as layout and state, not as illustration. |
| In-game codex / help screen | M4+ | Recorded at M2/P8 as a gap; needs a GDD 13 amendment first. |
| A design overview doc | any time | Docs only, no code. Not a packet. |

---

## 3. Decisions taken at plan time

### 3.1 The drop-payload conflict is resolved here, and it is a prerequisite

T5 §10.1 says a gear drop carries a **tier**; T2 §4.1's example shows a resolved **piece**. M2 stopped
the bleeding server-side by skipping unresolvable drops (DECISIONS 2026-08-20) and left the conflict
open. It cannot stay open through a milestone that multiplies drop sources by three zones.

**Decision: the client resolves the piece and sends it.** GDD 8's tier ladder is seeded content the
client already caches, so resolving `mortal` → `gear_weapon_mortal` is a table lookup on a device that
has the table. The alternative — the server resolving a tier — puts a roll on the server that T5 §1.6
deliberately put on the client so loot exists offline.

Both specs are amended together, and the fixture that missed this is regenerated from the producing
side rather than transcribed beside it (`traverser-m2-plan.md` §7.1).

### 3.2 Loot visibility is one packet, not two

The Reveal Card without the local grant announces an item the player does not receive; the local grant
without the Reveal Card is what M2 shipped, which is silence. Neither half is worth shipping alone,
so they are one packet with one exit criterion.

### 3.3 The satchel refresh is tried as a call site first

`traverser-m2-plan.md` §2.2 assumed the fix needs a new API field — the client minting
`player_item_id` and sending it with the drop. Drill 5 suggests it may not: `writeInventory` already
replaces the satchel from the server's authoritative list, ids included, and is simply never called
outside registration and restore. **Try the call site before adding the field.** If an ordinary sync
response can carry the inventory, §3.1's work is smaller than the M2 plan expected.

### 3.4 Pacing is in scope, art is not

Drill note 1.11: a correct turn was read as a failure because the Salve heal and the counterattack
landed in the same frame. That is a comprehension defect, not polish, and it does not need sprites —
a delay between combat-log lines and an animated Vigor bar are both layout-level. T5 §13's
choreography, and every sprite, stay at M4+.

### 3.5 The Road ships as state, not as illustration

GDD 9 §4.1 leaves the axis to the art phase and the design pass already redrew it as a vertical climb
(DECISIONS 2026-08-14). M3 builds node states, thresholds, the Waymarker and the Viewport against
`theme.ts` and GDD 13 §11 only. Nothing here waits on art, and nothing here is drawn to be kept.

---

## 4. Packets

Each packet is one commit. **↯ The commit subject names the packet number from this plan or no number
at all.** M1 mis-attributed six commits; M2 mis-attributed one, by giving a number to work that had no
packet (`traverser-m2-plan.md` §7.1). Work with no packet gets no number.

### P1 — Vigor recovery (GDD 2 §6)

- Passive regen at 1% of max per 10 minutes, computed from `vigor_anchor_at` — never accumulated by a
  ticker (T4 §7.2: timers do not run in the background).
- Daily reset to 100% at the player's own local midnight (T2 §2 — the client owns the boundary).
- Rest Day restores to 100%, via the existing `POST /players/me/rest-days`.
- ↯ `vigor_anchor_at` already exists and is written on every battle. This packet is the first thing to
  **read** it.

**Tests:** regen is a pure function of anchor, max and elapsed, asserted at the boundaries (0 minutes,
9 minutes, 10 minutes, a full day, a clock that went backwards). A daily reset and a battle in the
same pass do not double-apply. Vigor never exceeds max and never falls below the defeat floor by regen.

### P2 — The drop payload, resolved (§3.1)

- The client resolves tier → piece from cached content and sends `def_id` as a real id.
- T5 §10.1 and T2 §4.1 amended together.
- The server's skip-unresolvable guard from M2 **stays** — it is the backstop that made a bad drop cost
  one grant instead of every future sync.

**Tests:** the drop fixture is generated from the client's own roller, so a shape change fails on the
producing side. Every tier the roller can produce resolves to a seeded id.

### P3 — Loot visibility (§3.2)

- GDD 13 §6.3's Reveal Card, as the shared component §6.3 specifies — loot, level-up and streak
  milestones all use it.
- The local drop grant, so the satchel holds what the card announced.
- The satchel refresh on an ordinary sync (§3.3), tried as a call site first.

**Tests:** a won battle with a drop shows the card, adds exactly one satchel row, and adds exactly one
server row. A replayed sync adds neither. A drop the client cannot resolve shows no card rather than an
empty one.

### P4 — Sync reliability and battle pacing

- A battle settling during an in-flight pass is re-checked when that pass resolves (T4 §7.2).
- A persistent server error surfaces, and a poisoned outbox entry stops being retried forever — both
  gaps M2 found the hard way and left open.
- Combat-log lines arrive with a delay; both Vigor bars animate rather than jump (§3.4).

**Tests:** a battle settled mid-pass is uploaded without a foreground. An entry that fails N times is
parked rather than retried. Pacing is device-verified at P9 — RNTL cannot see it, and P1 of M2 was
right about that in writing.

### P5 — Gate evaluation and encounter checkpoints (T2 §4 steps 7, 8)

- Step 7: gate state from the new Waymarker; the dual gate inserts `player_zone_progress`.
- Step 8: the three roll sources, one pool, the 5/day cap against `activity_day.encounters_used`.
- `hr_session.encounter_rolls_granted` so a re-observed session cannot re-grant.

**Tests:** the step-8 arithmetic against fixtures — `floor(new/1000) - floor(old/1000)` rolls, not one
per sync. The cap holds when a single sync crosses many Leagues. A replayed payload issues no second
grant, which is the §4 replay property the whole design rests on.

### P6 — The map read (`GET /players/me/map`)

- Derived on every read from `lifetime_steps`, `zone_gate` and `player_bestiary`. Nothing stored.

**Tests:** a player at exactly a threshold is `available`, not `locked`. A defeated final boss unlocks
exactly one zone.

### P7 — The Road screen (GDD 9 §4)

- Three segments at roughly equal visual length with an internal progress fill, per §4.1 — **not to
  literal scale**, or Olympion is invisible beside Imperion.
- Node states per §4.2; mid-boss gates soft, final-boss gates hard.
- Waymarker, Viewport scrolling to any segment behind it, "Return to the Road", the League counter,
  the zone banner.

**Tests:** node state renders from the map read and nothing else. RNTL cannot see the layout — this
packet's real verification is P9.

### P8 — Explore, and the rosters beyond Olympion

- Explore enabled only when the Viewport is centred on a previously-unlocked segment (GDD 9 §4.3).
- Offline it records intent; the grant is issued by the next sync (T2 §1.3).
- Valheon and Imperion rosters become selectable. They have been seeded since M0.

**Tests:** Explore consumes one roll from the same pool and respects the 5/day cap. An enemy is
selected from the segment's roster, not the frontier's.

### P9 — Device build, drills

- The M2 form, which worked: a sheet with a result column, and a notes table for anything noticed.
- ↯ **Write the drills against the build, not against the spec.** M2's drill 3 asserted a Reveal Card
  no packet had built (`traverser-m2-plan.md` §7.1). A drill written from the spec tests the spec.
- ↯ **Reconcile one real row by hand.** Two milestones running, this has found what the suite could not.

### P10 — Close-out review

M2's P9 checklist unchanged. It stayed a gate for a whole milestone; do not widen it.

### P11 — Wrap-up

- README, `DECISIONS.md`, tech specs amended in place.
- This plan's §7 delivery table and §7.1 divergences.
- `traverser-m4-plan.md`.

---

## 5. Exit criteria

Verified at P9, before the wrap-up. M3 is done when, on the Pixel:

1. Walking a thousand steps can start a real encounter, with no debug card involved.
2. The daily cap holds at 5 encounters, and steps, XP and Leagues keep accruing past it.
3. A final-boss gate blocks the next zone until its boss is defeated, and unlocks it when one is.
4. The Road renders all three segments with correct node states, and the Viewport scrolls behind the
   Waymarker and back.
5. Explore starts an encounter against an earlier zone's roster.
6. Winning a battle shows the Reveal Card, and the item is in the satchel on the next screen.
7. Vigor recovers by regen, by daily reset, and by a Rest Day.
8. A battle settled with the app in the foreground reaches the server without a foreground event.
9. A turn is legible: the log lines and the Vigor bars do not resolve in a single frame.
10. M2's eight criteria still pass.

---

## 6. Cross-spec flags

- **The drop-payload conflict (§3.1) is the one item that cannot be deferred again.** It is stopped,
  not resolved, and M3 triples the number of drop sources.
- **`hr_session` is still empty server-side**, and step 8's session-bonus roll is the first thing that
  needs it. README's M1 section says sessions upload at M2; they did not, because nothing read them.
  Confirm at P5 rather than assuming.
- **GDD 9 §4.1 leaves the Road's axis to the art phase**, and the design pass chose a vertical climb.
  §3.5 builds against that choice; if the art phase revisits it, only layout moves.
- **The overactivity warning (GDD 1 §5, GDD 11 §8)** fires at sync time and is M4's, but it reads the
  same Tier 1+ minutes step 8's session bonus does. Build the minute accounting once.
