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
| Battle action layout | Attack centred, four skill slots always visible | GDD 13 §6.1, §6.2 — **amended here** |
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

### 3.5 The action menu is re-laid out, and GDD 13 §6.1 is amended to match

`docs/mockups/battle-action-layout.png`. Attack becomes a circle at the centre; the four equipped
skill slots sit in the quadrants around it and are **always visible**; Items and Flee are thin bars
beneath. The Skill submenu disappears.

§6.1 currently reads *"four buttons — Attack, Skill, Item, Flee — always in this fixed order and
position (spatial consistency reduces menu-scanning time)"*. The new layout has seven targets and no
Skill button, so the sentence changes — **but its stated reason survives intact and is better served**:
a skill costs one tap instead of two, and every action sits at a permanently fixed location. An
amendment that serves the original rationale better than the wording it replaces is the kind worth
taking; one that only serves the code is not.

§6.2 moves with it. The pre-selection chevron is specified as appearing *"when the Skill sub-menu is
open"*, and there is no submenu. The hint becomes always-visible on a typed slot, still gated on the
enemy's **second** encounter — that gate is the part §6.2 cares about and it does not change.

↯ **The empty state decides what the tutorial says, so it is a design question and not a layout one.**
Levels 1–3 have zero skills (GDD 3 §2.4) and that is exactly when GDD 10's tutorial runs — so a new
player's first screen is the Attack circle ringed by four empty slots. GDD 10's script also says
*"tap Skill to use it"* at the Iron Advance beat, wording that names a button this layout deletes.
**Both are settled at P4a before any component is written**, not discovered while building it.

### 3.6 The Road ships as state, not as illustration

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
- The health banner clears on a permission re-grant without waiting out the next completed pass —
  named "a polish item for M2" on 2026-08-16 and never landed.

**Tests:** a battle settled mid-pass is uploaded without a foreground. An entry that fails N times is
parked rather than retried. Pacing is device-verified at P9 — RNTL cannot see it, and P1 of M2 was
right about that in writing.

### P4a — Battle action layout (GDD 13 §6.1, §6.2)

Sequenced beside P4 because both touch `BattleScreen` and both are verified by the same device drill.

- Settle the two design questions from §3.5 **first**: what an empty skill slot shows at Levels 1–3,
  and what GDD 10's script says in place of *"tap Skill to use it"*.
- Amend GDD 13 §6.1 and §6.2, and GDD 10 §6 if the script line changes.
- Rebuild `ActionMenu.tsx` to the mockup. Attack centred; four fixed skill slots; Items and Flee
  beneath. Items still opens a list — it is a variable-length inventory, not a fixed loadout.
- Uses-remaining and the chevron both move onto the slot itself, from the submenu row that carried them.
- The slot above the player's Vigor bar shows the player's name, not the round number (M2 drill
  note 1.5); the round indicator finds another home.
- Decide whether GDD 13 §6.4's shared tooltip component survives this layout — DECISIONS 2026-08-20
  assigned it here, and the slots now carry the hints the submenu rows did. Amend §6.4 to the answer.
- ↯ Minimum touch target is 48dp and the circle overlaps the grid. This is the constraint that decides
  the geometry, not the sketch's proportions.

**What does not change:** `chevronFor`, `calloutOf`, `usesFor`, the event queue and the store. This is
a layout packet — if logic below `ActionMenu` moves, something has gone wrong.

**Tests:** a locked slot explains itself rather than vanishing (§6.1's reason for keeping disabled
actions in place still applies to a slot). A slot with no skill is not tappable and is not mistaken for
a spent one. Long-press still frames the match as *"[Move Type] vs. [Enemy Type]"* — the tooltip was a
P8 defect once already and has no submenu to live in now. Layout itself is P9's, since RNTL cannot see it.

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
- The Settings debug-encounter card is deleted. M2 shipped it intending exactly this removal
  (`traverser-m2-plan.md` §3.3), and this packet builds its replacement.

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
10. Every equipped skill is reachable in one tap, and a locked or empty slot says why.
11. M2's eight criteria still pass, with drills 1 and 2 rewritten for the new layout.

---

## 6. Cross-spec flags

- **The drop-payload conflict (§3.1) is the one item that cannot be deferred again.** It is stopped,
  not resolved, and M3 triples the number of drop sources.
- **`hr_session` is still empty server-side**, and step 8's session-bonus roll is the first thing that
  needs it. README's M1 section says sessions upload at M2; they did not, because nothing read them.
  Confirm at P5 rather than assuming.
- **GDD 9 §4.1 leaves the Road's axis to the art phase**, and the design pass chose a vertical climb.
  §3.6 builds against that choice; if the art phase revisits it, only layout moves.
- **The overactivity warning (GDD 1 §5, GDD 11 §8)** fires at sync time and is M4's, but it reads the
  same Tier 1+ minutes step 8's session bonus does. Build the minute accounting once.
- **The GDD balance pass has three open flags and no owner:** storm reachability (DECISIONS
  2026-08-15), fixtures §10.9's one-shot finding, and the ×4.5 effect triple (DECISIONS 2026-08-16).
  M2's drills were the first playtest and recorded no balance verdict. Every flag is pinned by a test
  or an exemption, so nothing regresses silently — but the decision needs an owner, and M3's
  encounter volume is the evidence it has been waiting for. Take the verdict at this milestone's
  close-out or assign it a milestone in writing.

---

## 7. Packets, as delivered

| Plan packet | Commit(s) | Date | Contents |
|---|---|---|---|
| **P4a (mockup)** | `adde7b1` | 08-22 | The action-layout packet and its mockup, written **before** P1 — see §7.1. |
| **P1** | `72eac63` | 08-22 | Vigor recovery (regen, daily reset, Rest Day), the anchor on the wire. |
| **P2** | `d26f5ee` | 08-22 | The drop payload resolves to a piece, closing §3.1's two-spec conflict. |
| **P3** | `c1eb4a7` | 08-22 | Reveal Card, the local grant, the satchel reconcile. |
| **P4** | `7ba5171` | 08-22 | Sync reliability and battle pacing (`usePacedLines`, 450ms). |
| **P4a** | `d9bdf4e` | 08-22 | Attack centred, four slots always visible. GDD 13 §6.1 amended to match. |
| **P5** | `38dbbc1` | 08-22 | Gate evaluation, encounter checkpoints, T2 §4 steps 7 and 8. |
| **P6** | `98ab2e5` | 08-22 | `GET /players/me/map`. |
| **P7** | `4b1ffa8` | 08-22 | The Road screen, derived on the device (DECISIONS 2026-08-22). |
| **P8** | `385c3c3` | 08-22 | Explore, the rosters beyond Olympion, the debug card deleted. |
| **P9** | `3a364f9`, `f0e1203`, `5adca47`, `99e0420` | 08-24 → 09-01 | Device build and ten drills. **Five defects found on hardware and fixed**, plus the balance pass the drills forced. All eleven exit criteria pass. |
| **P10** | *this packet* | 09-01 | Close-out review, ten items. Nine passed; item 1 found an owed amendment and it was fixed here — see §7.2. |
| **P11** | *this packet* | 09-01 | Wrap-up: this section, GDD 9 §4.2 amended, `traverser-m4-plan.md`. |

### 7.1 Where the delivery diverged from the intent

- **The drills stopped being a verification pass and became a design pass.** M1 and M2's drills each found a shipped defect; M3's found five, and then found something no checklist anticipated — *the game was not fun*. Notes 8 and 10 measured it rather than asserting it: enemies gained ~5.5–5.75 stat points per level against the player's allocated 3, so a single wild fight cost ~75% of the daily Vigor bar where the 5/day cap (GDD 9 §5) implies ~20%, and mid-bosses at L30+ modelled at over 200% — unwinnable. **This put two locked GDD sections in direct conflict**, and it was reachable only by playing, not by reading. *Lesson: a milestone that ships a system for the first time needs a packet for playing it, not only for verifying it.*

- **The balance pass was sanctioned in advance and nobody noticed for three milestones.** GDD 2 §147 flagged the Vigor rates as a first pass "worth playtesting now that encounter frequency is fixed" — the exact playtest drill 5 became. The flag sat unread from M0 through M3. *Lesson: a spec's own open questions need a milestone that owns them, or they are invisible until something forces them.*

- **The fix was content, not code.** Not one line of `damage.ts`, `state.ts` or any endpoint changed: enemy scaling lives in `enemy_stat_scaling` rows, so twelve rosters were retuned through the seed, a migration of 74 `UpdateData` calls, and a regenerated bundle. What the pass added permanently is **GDD 2 §7's fight-cost invariants** and `balance.test.ts`, which executes them against the shipped bundle — the property the original rosters violated for three milestones with 650 green tests.

- **Two Road defects were found that no unit test had a fixture for**, both from the same root: a derived field piggybacking on another field's meaning. Making `locked` mean "threshold ahead **or** zone shut" silently broke the League counter, which had been reading distance off gate state. *Lesson: neither change looks wrong on its own, which is exactly why the pair is invisible to review.*

- **A drill step asserted a control that cannot exist at that point in the sheet.** 10.18 sent the player to Settings for a restore that `isProfileReplaceable` correctly hides once the tutorial completes. This is M2's drill-3 failure in a new costume — the row was written against the plan, not the build, in a sheet whose own ↯ warns against exactly that. *Lesson: the warning at the top of a document does not enforce itself.*

- **The one profile that can still test the dual gate is a drill artifact.** 10.16a needed a device with no Valheon row, and `player_zone_progress` reconciles additively (`ON CONFLICT DO NOTHING`) — so no server-side rollback can return a device to that state. The fresh profile created at drill 10 (`01a05f5a-6b35-7820-b876-5bf7e776498e`) is now **the only Valheon-locked profile in existence** and is worth keeping for future gate work. Recorded here because nothing else documents why it must not be cleaned up.

- **Drill 9 came back clean for the first time.** M1 and M2 each had a shipped defect surface in the hand reconciliation. M3's ten claims all reconciled, and the day's XP landed exactly — `floor(8351/20) + 69×3 + 6×51 = 930`. The one claim that could not be tested was the tutorial-Salve provenance, because those rows had been spent; it was recovered at 10.17 on the fresh profile.

- **A test shipped that `tsc` rejects.** `balance.test.ts` went in at `f0e1203` with two unchecked index reads; Jest passed because the transform strips types, and the gap surfaced only when an unrelated change prompted a type check. *Lesson: a green Jest run is not a type check, and item 6 exists because of exactly this.*

### 7.2 Close-out review (P10) result

Ten items, M1's eight plus M2's two. **Nine passed. One failed and was fixed in this packet**, which is the outcome the checklist is designed to produce.

| # | Item | Result |
|---|---|---|
| 1 | Every spec amendment has code behind it | **FAILED, fixed here.** GDD 9 §4.2 was never amended, though DECISIONS 2026-08-24 recorded that it should be and the code shipped on both tiers. Amended at P11, covering the zone condition and §4.4's counter. |
| 2 | Tests assert against fixtures | PASS — `enemyStats`, `harpy` and the seed tests all read fixtures §6 and §10; the retune regenerated the fixtures first and the code second. |
| 3 | In-scope T2 §4 steps built, out-of-scope ones have a milestone | PASS — steps 7 and 8 shipped at P5; §2.2 names a milestone for 9, 10 and 11. |
| 4 | Obligations discharged, not merely built | PASS — the identity export and the restore path were both **exercised for real** at drill 10, not asserted. |
| 5 | Nothing deferred silently | PASS — every deferral has a DECISIONS line or a §2.2 row; the seventeen drill notes carry into `traverser-m4-plan.md`. |
| 6 | `dotnet test`, `tsc --noEmit`, jest green, tree clean | PASS — 226 API, 656 client, `tsc` exit 0. |
| 7 | `⟨verify⟩` markers resolved | PASS — M3 introduced none; the open ones in T4 and T6 predate it and are unrelated. |
| 8 | The visual style has a named owner | PASS — unchanged since M1's deferral; carried into M4's plan rather than left implicit. |
| 9 | The review takes no new work | PASS — item 1's fix is an owed amendment, not new scope. Everything else found went to the M4 plan. |
| 10 | One row of real production data reconciled | PASS — drill 9, ten claims, 2026-08-31. Clean for the first time in three milestones. |
