# Traverser M4 build plan — "The Payoff"

**Milestone:** M4. **Predecessor:** `traverser-m3-plan.md` (complete, 2026-09-01).
**Theme:** the loop rewards you, and explains itself.

M3 closed the loop: walking starts fights, fights drop loot, the Road gates the world. Its drills
then found the loop is not yet a *game*. Two findings shape this milestone, and both came from
playing rather than from reading:

- **Every drop after the tutorial is dead loot.** Gear drops, is stored, arrives in the profile
  document with an `equipped_slot` column — and can never be equipped, because the write path was
  never built (drills note 11). M3 shipped a reward system with no payoff.
- **The game never explains itself.** Nothing says what a stat does, which stat a move uses, what
  Vigor is outside a battle, or that the restore door is about to close. A player can build a
  character that cannot fight and never be told (notes 3, 9, 12, 14, 17).

M4 pays off the first and starts on the second, then builds the boss encounters the Road has been
drawing since M3.

---

## 1. The ordering constraint that shapes this milestone

**Gear equipping comes first, and it is not a preference.** M3's balance pass (GDD 2 §7) tuned all
twelve rosters against an **ungeared** reference build, with gear as the intended margin on top. So
long as nothing can be equipped, the difficulty every player experiences is the floor the invariants
guarantee, and nobody — including this project — can judge whether the margin is right. Every other
balance question in M4 is unanswerable until equipping ships.

The rest of the order is looser. The comprehension packets are independent of each other and of the
boss work. The boss encounters come last because they are the largest, and because P1's outcome may
change what a boss fight should cost.

---

## 2. Scope

### 2.1 In

| Item | Source | Note |
|---|---|---|
| Equip and unequip owned gear, three slots | GDD 8 §2 | The write path only. Tightly scoped — see §3.1. |
| A Vigor readout on Character | GDD 2 §6, drills note 12 | Completes M3's Rest Day fix, which is still invisible. |
| Move type and category on the skill slot | GDD 13 §6.2, drills notes 3 and 14 | The chevron already renders; what is missing is what it is attached to. |
| Stat guidance at the point of allocation | GDD 1 §5, drills note 9 | Guidance, not a respec — see §3.3. |
| Boss encounters (mid-boss and final) | GDD 9 §4.2, GDD 5–7 | The Road draws these nodes and tapping one does nothing (note 6). |
| T2 §4 step 9 — streak and grace | GDD 11 | Carried from M3 §2.2. |
| Device drills, close-out review, wrap-up | — | The M3 form, unchanged. |

### 2.2 Out, and where it lands

| Item | Milestone | Why |
|---|---|---|
| Trinkets and gear-granted moves | M5 | GDD 10 §9's constraint: not until the first Heroic Trinket. P1 deliberately stops short of the fourth slot — §3.1. |
| A respec | undecided | A design question, not a gap. §3.3 records why guidance is tried first. |
| The restore door's silence (note 17) | M5 | Rare, has a workaround, and its fix is an onboarding-flow choice rather than a bug fix. |
| In-game codex / help screen | M5+ | Carried from M3 §2.2; still needs a GDD 13 amendment first. |
| Layered gear sprites, tier colours | Art phase | GDD 8's visual half. P1 ships slots and stats, not pictures. |
| Battle sprites, animation choreography | Art phase | T5 §13, carried from M3. |
| T2 §4 steps 10 and 11 | M5 | Deterministic rewards, overactivity. Carried from M3 §2.2. |
| Zone visual identity, Road art | Art phase | GDD 9 §6, GDD 13 §10. Carried from M3. |
| The visual style's owner | undecided | Open since M1 (DECISIONS 2026-08-06). Carried explicitly rather than implicitly — it has now survived three milestones unowned. |

---

## 3. Decisions taken at plan time

### 3.1 Equipping is the write path and nothing else

Most of this feature already exists. `player_gear.equipped_slot` is in the schema, `readEquippedGear`
reads it, `effectiveStats` applies the bonuses to every stat that consumes them, and `equipped_slot`
already arrives on the wire in the profile document (`dto.ts:435`). The **down** direction is
complete and has been since M2.

What is missing is the **up** direction: an `OutboxKind`, a server handler, and a control. That is the
whole packet. It deliberately does **not** include the Trinket slot (GDD 8 §4 — gear-granted moves are
M5's), tier colours, or sprites.

↯ **The stat change must not be able to strand an open battle.** A battle reads its stat block once
when it is built (`session.ts`), which is the same frozen-copy shape that made the mid-fight Rest Day
defect (M3 drills note 13). Equipping mid-fight has to resolve the same way: refuse while a battle is
open, matching the precedent set in `ui/RestDay.tsx`, with `battle_snapshot` as the signal.

### 3.2 The comprehension packets are separate, and small

Notes 3, 9, 12 and 14 look like one problem and are not one packet. Note 3 is **not a defect** — the
chevron renders correctly (`ActionMenu.tsx:276`) and unlocks after one prior encounter
(`session.ts:215`); it is invisible on Physical moves *by design*, because a physical move never
takes a type multiplier and a "×1.0" hint would teach the wrong rule. What makes that indistinguishable
from a bug is note 14: nothing on the slot says whether a move is Physical or Divine.

So notes 3 and 14 collapse into one fix — put the type and category on the slot — and note 3 needs no
code of its own. Note 12 is unrelated and smaller. They ship as separate packets because they touch
different screens and neither should wait on the other.

### 3.3 Guidance before a respec

Note 9's finding is real: a Level 16 profile with 30 of 45 points in Vigor could not win a fight, the
mistake was permanent, and nothing on the allocation screen distinguished the stat that decides
survival from the ones that decide a fight. `StatPanel.tsx:15` correctly records that there is no
respec.

Two fixes are available and only one is cheap. **Guidance ships first** — one line per stat at the
point of spending, naming what it does and which moves use it — because it also serves every future
player, while a respec only serves players who already made the mistake. Whether a respec is needed
**on top** of guidance is a design question this plan does not answer; it is listed in §2.2 as
undecided rather than deferred, because deferring implies it was chosen.

### 3.4 Bosses come last, and the balance question rides with them

The Road has drawn boss nodes since M3/P7 and tapping one does nothing (note 6) — copy that promises
an action the build cannot deliver. M4 builds the encounter. But GDD 2 §7's invariants give a mid-boss
up to 75% of the bar and a zone boss up to 85%, and those numbers were derived, never played. The
boss packet is therefore the first real test of the balance pass at the top of its range, and its
drills should be written to measure that rather than assume it.

### 3.5 Note 4 is measured before it is triaged

A ~25-second Explore round trip was recorded at M3's drill 2.3 and never explained. It may be the
tap, the sync pass, or the tunnel. One measurement decides which, and it is cheap enough that
guessing is the expensive option. It is not a packet; it is the first thing done inside P1's build.

---

## 4. Packets

The commit subject names the packet number from this plan or no number at all. M2 learned this and
broke it once by lending a number to work that had no packet; M3 held it for eleven commits. Work
with no packet needs no number.

### P1 — Gear equipping (GDD 8 §2)

The write path, and the first packet because §1 says nothing else can be judged without it.

- `OutboxKind` gains `equip`; payload names the `player_gear.id` and the target slot, or null to
  unequip. The id is the device's, minted at drop (T5 §10.3's precedent).
- Server handler sets `equipped_slot`, enforcing one piece per slot and rejecting a slot the piece's
  `gear_def` does not fit.
- A control on Character listing owned gear per slot, with the stat delta visible before committing.
- ↯ Refused while a battle is open, per §3.1, with `battle_snapshot` as the signal.
- **Measure note 4's Explore round trip before building** (§3.5) and record the number.

**Tests:** the outbox round trip; one piece per slot; a rejected slot mismatch; `effectiveStats`
moving with an equip and back with an unequip; the open-battle refusal.

### P2 — Vigor on Character (GDD 2 §6, drills note 12)

The smallest packet, and it finishes work M3 already shipped: the Rest Day refusal now says *why* it
is refused, but a player still cannot watch the restore happen.

- A Vigor readout on Character — current and max, the player's own numbers per GDD 13 §6.1's rule
  that the player's pool is meaningful precisely and the enemy's is not.
- ↯ It must read from the mirror on focus, not from a timer. Nothing about Vigor ticks
  (`progression/vigor.ts`); it is derived from `vigor_anchor_at` when something reads it.

**Tests:** the readout reflects a recovered value after a simulated gap; it never displays above max.

### P3 — The move's type and category on the slot (GDD 13 §6.2, notes 3 and 14)

Per §3.2, this is what makes note 3's correct behaviour legible.

- Each filled slot shows the move's category, and its type where it has one.
- ↯ **Physical must read as a positive statement, not as an absence.** A blank where an icon would go
  is what made a correctly-hidden chevron look broken.
- `SkillOption` gains the two fields; `skillOptions` already has both to hand.

**Tests:** a Physical slot renders its category rather than nothing; a typed Divine slot renders both;
the existing chevron cases still pass unchanged.

### P4 — Stat guidance at allocation (GDD 1 §5, note 9)

Guidance only, per §3.3.

- One line per stat at the point of spending: what it does, and which moves it drives.
- ↯ Vigor must be visibly distinguishable from the stats that decide a fight. The drill build put 30
  of 45 points into Vigor and could not win; nothing on screen suggested that was a choice with a cost.

**Tests:** every stat in the content ladder has guidance text — a new stat cannot ship without one.

### P5 — Streak and grace (T2 §4 step 9, GDD 11)

Carried from M3 §2.2, unchanged in scope.

- ↯ **Nothing here is punitive** (CLAUDE.md, GDD 11 §11): no loss notifications, quiet reset copy,
  grace rules per §11. A streak system is the easiest place in this project to accidentally ship
  something that scolds.

**Tests:** the grace window; the rolling-30-day cap; a reset writes no notification.

### P6 — Boss encounters (GDD 9 §4.2, GDD 5–7)

The largest packet, last per §3.4.

- Tapping an `available` gate node starts the fight. Non-fleeable (GDD 2 §5).
- Defeat writes `player_bestiary`, which is what the dual gate already reads.
- ↯ The mid-boss/final-boss distinction is mechanical and already built server-side; what is missing
  is the encounter. Do not rebuild the gate rule — it shipped at M3/P5 and is verified on hardware.
- Note 5's iconography (a boss node not reading as a boss) is **art-phase**, not this packet. Note 6's
  copy problem resolves itself once the tap does something.

**Tests:** a boss encounter cannot be fled; a defeat opens the gated zone; the drop table differs from
the wild table per GDD 5–7.

### P7 — Device build, drills

The M3 form: a sheet with a result column and a notes table.

- ↯ **Write the drills against the build, not against the spec.** M3's 10.18 asserted a Settings
  control that `isProfileReplaceable` correctly hides — the same failure as M2's drill 3, in a sheet
  that carried a warning against it at the top.
- ↯ **Reconcile one real row by hand.** Three milestones running; M3's was the first to come back clean.
- **The boss drills measure the balance pass at the top of its range** (§3.4). GDD 2 §7 allows a
  mid-boss 75% of the bar and a zone boss 85%; those are derived numbers that have never been felt.
- ↯ The fresh profile `01a05f5a-6b35-7820-b876-5bf7e776498e` is **the only Valheon-locked profile in
  existence** (M3 §7.1) and is the only way to re-test the dual gate. Do not clean it up.

### P8 — Close-out review

M3's ten-item checklist unchanged. It found a real failure at M3 (an owed GDD amendment) and stayed a
gate; do not widen it.

### P9 — Wrap-up

- README, `DECISIONS.md`, tech specs amended in place.
- This plan's §7 delivery table and §7.1 divergences.
- `traverser-m5-plan.md`.

---

## 5. Exit criteria

Verified at P7, before the wrap-up. M4 is done when, on the Pixel:

1. A dropped piece of gear can be equipped, and the stat change is visible on Character.
2. Unequipping returns the stat, and one slot never holds two pieces.
3. Equipping is refused while a battle is open, and says why.
4. Vigor is readable on Character, and a Rest Day's restore is visible there when it is tagged.
5. Every filled skill slot states its category, and Physical reads as a statement rather than a blank.
6. Allocating a stat point shows what that stat does before it is spent.
7. A streak survives a rest day and resets quietly, with nothing punitive anywhere in the flow.
8. Tapping an available boss gate starts the fight, and it cannot be fled.
9. Defeating a final boss opens the next zone from the device, not only from a seeded row.
10. A geared player's wild fight costs measurably less of the bar than the ungeared invariant floor.
11. M3's eleven criteria still pass.

---

## 6. Cross-spec flags

- **GDD 2 §7's boss invariants have never been played.** The wild half was measured on hardware at
  M3; the mid-boss and zone-boss ceilings (75% and 85%) are model output. P6 and P7 are the first
  contact, and criterion 10 exists to make gear's contribution measurable rather than assumed.
- **The visual style still has no owner**, open since M1 (DECISIONS 2026-08-06) and now carried by a
  fourth plan. §2.2 lists it as undecided. Four milestones of screens have been built against an
  invented `theme.ts`; a fifth would be a choice, not an oversight.
- **GDD 8's loot tables assume a Trinket slot this milestone does not build.** P1 stops at three
  slots (§3.1) and M5 owns the fourth. Any GDD 8 reading during M4 should expect that gap.
- **Note 2 (encounters never expire) remains spec-correct and unaddressed.** GDD 9 §5 caps the rate,
  not the pile, and M3's drill 9 relied on a banked grant being legitimate. If a week away banking 35
  fights ever feels wrong, that is a GDD change and not a bug.
