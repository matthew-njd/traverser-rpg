# Traverser GDD — Section 2: Type Chart & Combat Mechanics

## 1. Overview

Combat is a lightweight, turn-based system triggered by random encounters while walking. Every move a Traverser can use falls into one of two categories — **Physical** (untyped, mortal strength) or **Divine** (typed, godly-domain power) — governed respectively by the Might/Resolve and Favor/Aegis stat pairs established in Section 1. Six elemental **godly-domain types** span all three current pantheons (Greek, Norse, Roman) and are architected to extend cleanly to a fourth (Egyptian) without restructuring.

Battles are designed to be short (roughly 2–5 turns), low-friction, and low-stakes: XP is never at risk (Section 1), and losing costs nothing but the loot and item drop chance — never a hard wall.

---

## 2. The Six Godly-Domain Types

| Type           | Domain                          | Greek    | Norse | Roman   |
| -------------- | ------------------------------- | -------- | ----- | ------- |
| **Storm**      | Sky, thunder, lightning         | Zeus     | Thor  | Jupiter |
| **Sea**        | Water, tides, the deep          | Poseidon | Njörð | Neptune |
| **Underworld** | Death, decay, the afterlife     | Hades    | Hel   | Pluto   |
| **War**        | Battle, conquest, martial might | Ares     | Týr   | Mars    |
| **Wisdom**     | Strategy, foresight, knowledge  | Athena   | Odin  | Minerva |
| **Trickery**   | Cunning, misdirection, speed    | Hermes   | Loki  | Mercury |

This set covers the four domains already named in the planning doc (Storm, Sea, Underworld, War) plus two additions — **Wisdom** and **Trickery** — chosen because both have a clean, recognizable deity in all three pantheons and round the chart out to a balanced six.

**Physical moves are untyped** — they represent raw mortal Might and are never subject to the type chart (always ×1.0). Only **Divine** moves carry a type and interact with the chart below.

**Extensibility note:** the six-type structure is a closed hexagon (Section 3). A future Egyptian zone does not need a 7th type — it should be designed to slot its deities into these same six domains (e.g., a Set or Sobek figure into War or Sea), keeping the type chart stable as new zones are added. This matches the planning doc's requirement that new realms be a content addition, not a structural rework.

---

## 3. Type Effectiveness Chart

Six types arranged in a fixed hexagon cycle: **Storm → War → Trickery → Underworld → Sea → Wisdom → (back to Storm)**.

Each type is **Super Effective** against the next two types clockwise, **Resisted** by the two types counter-clockwise (i.e., weak against them), and **Neutral** against the type directly opposite plus itself.

| Attacking ↓ / Defending → | Storm  | War    | Trickery | Underworld | Sea    | Wisdom |
| ------------------------- | ------ | ------ | -------- | ---------- | ------ | ------ |
| **Storm**                 | 1x     | **2x** | **2x**   | 1x         | 0.5x   | 0.5x   |
| **War**                   | 0.5x   | 1x     | **2x**   | **2x**     | 1x     | 0.5x   |
| **Trickery**              | 0.5x   | 0.5x   | 1x       | **2x**     | **2x** | 1x     |
| **Underworld**            | 1x     | 0.5x   | 0.5x     | 1x         | **2x** | **2x** |
| **Sea**                   | **2x** | 1x     | 0.5x     | 0.5x       | 1x     | **2x** |
| **Wisdom**                | **2x** | **2x** | 1x       | 0.5x       | 0.5x   | 1x     |

- **Super Effective:** 2.0x damage
- **Neutral:** 1.0x damage
- **Resisted:** 0.5x damage
- **No immunities (0x)** — every type can always deal some damage to every other type, per the chosen design (nothing is ever a hard wall in combat, echoing the "never punish effort" philosophy from Section 1).

Every type has exactly **2 strong, 2 resisted, and 2 neutral matchups** (one of the neutral matchups is always itself). This symmetry keeps balance simple: no type is objectively best or worst.

**Flavor logic** (for lore/move-design reference in Section 3):

- **Storm** overpowers War (lightning breaks battle lines) and Trickery (thunder drowns out cunning); it's tempered by Sea (water conducts/absorbs it) and outmatched by Wisdom (foresight channels it).
- **War** overpowers Trickery (force beats deception) and Underworld (heroic might conquers death); it's undone by Storm (weather disrupts battle) and Wisdom (strategy beats brawn).
- **Trickery** overpowers Underworld (cunning heroes cheat death) and Sea (clever sailors outwit the deep); it's beaten by War (force ignores tricks) and Storm (chaos can't be gamed).
- **Underworld** overpowers Sea (drowning leads to death) and Wisdom (death is the great equalizer); it's beaten by Trickery (heroes escape it) and War (heroes conquer it).
- **Sea** overpowers Wisdom (the deep exceeds mortal understanding) and Storm (the ocean swallows storms); it's beaten by Underworld (the sea drowns) and Trickery (sailors outwit it).
- **Wisdom** overpowers Storm (foresight tames chaos) and War (strategy beats brute force); it's beaten by Sea (some mysteries are unknowable) and Underworld (death eludes even the wise).

---

## 4. Move Categories

| Category             | Stats Used                    | Typed?                     | Availability                                       |
| -------------------- | ------------------------------ | --------------------------- | --------------------------------------------------- |
| **Basic Attack**     | Might (atk) vs. Resolve (def) | No — always ×1.0           | Always available, unlimited uses, fixed low power  |
| **Skill — Physical** | Might (atk) vs. Resolve (def) | No                         | Unlocked by level only; limited uses per battle |
| **Skill — Divine**   | Favor (atk) vs. Aegis (def)   | Yes — one of the 6 domains | Unlocked by level or gear; limited uses per battle |

- **Basic Attack Power: 40 (fixed)** — the same value at every level; its damage output scales purely through the attacker's growing Might vs. the defender's Resolve, never through a level term of its own.
- **Loadout:** a Traverser can have **up to 4 Skills equipped** at once (from however many are unlocked), plus the always-available Basic Attack — a familiar, quickly scannable choice set that keeps to the "simple, lightweight" combat directive. Equipped Skills can be freely swapped outside of battle.
- **Uses per battle:** each Skill has a fixed use limit per battle (typical range 3–5, exact values set per-move in Section 3). Uses fully replenish at the start of every new battle — there is no cross-battle resource to manage, keeping the loop friction-free.
- **Accuracy:** all moves hit 100% of the time. No miss chance — keeps battles short and predictable rather than adding RNG-driven frustration on top of an already-lightweight system.
- **Items:** the third action type (see Section 4 of the planned GDD — Battle Items) — not specified here.

---

## 5. Turn Structure & Battle Flow

1. **Turn order** is determined by **Stride** — higher Stride acts first each round. Exact ties are broken randomly (50/50).
2. Each round, the Traverser chooses one action: **Attack**, **Skill**, or **Item**. The enemy AI selects its action simultaneously (enemy move selection logic is defined per-roster in Sections 5–7).
3. The faster combatant's action resolves first. If it reduces the other's Vigor to 0, the battle ends immediately — the slower combatant does not get to act that round.
4. Repeat until one side's Vigor reaches 0.
5. **Win:** Battle XP is awarded (Section 1) and a loot roll occurs (Section 8, TBD).
6. **Loss:** No XP or permanent penalty. See Vigor recovery rules below for what happens next.
7. **Flee (wild encounters only):** the player may retreat from a non-boss encounter at any time with no penalty beyond forfeiting that encounter's loot chance. Boss encounters cannot be fled once engaged, to preserve their status as meaningful, committed events. _(This is a reasonable-default assumption, not explicitly specified in the planning doc — flagged in Open Questions for confirmation.)_

---

## 6. Vigor (HP) Persistence & Recovery

Per the planning doc's health/safety framing — "rest days allow the Traverser to recover HP" — Vigor is **not** a per-battle resource that auto-refills before every fight. It behaves as a persistent pool that depletes with battle damage and recovers over time, tying combat stakes directly into the game's rest/recovery narrative:

- **Persistence:** current Vigor carries over between encounters within the same day. Taking damage in one battle leaves the Traverser weaker going into the next until it recovers.
- **Passive regen:** a slow trickle — **1% of max Vigor per 10 minutes** of real time — reflecting ordinary rest between activity sessions.
- **Daily reset:** Vigor restores to 100% at the start of each new calendar day, so players never carry a rough day's battles as a lingering handicap.
- **Rest Day bonus:** a day explicitly marked (or detected) as a Rest Day restores Vigor to 100% immediately and reinforces the positive rest framing from the planning doc.
- **On defeat (Vigor hits 0):** the battle ends as a Loss, and Vigor is immediately restored to **25% of max** — enough for an instant, meaningful retry without a hard lockout, satisfying the planning doc's "easy, immediate retry on a loss" requirement, while still making back-to-back losses feel like something (not a free do-over).

---

## 7. Damage Formula

```
Damage = floor( ( (Power × AttackStat) / (DefenseStat × 8) ) × TypeMultiplier × CritMultiplier × RandomFactor )
```

- **Power:** base power value defined per move (Section 3 will assign exact values; provisional working range 40–100).
- **AttackStat:** Might (Physical moves) or Favor (Divine moves).
- **DefenseStat:** Resolve (Physical moves) or Aegis (Divine moves).
- **TypeMultiplier:** 2.0 / 1.0 / 0.5 per the chart above. Always 1.0 for Physical moves.
- **CritMultiplier:** **1.5x** on a critical hit, else 1.0. Flat **6.25% (1/16) crit chance** on every move, no stat or gear interaction for now (gear-granted crit bonuses can be layered in later via Section 8 without changing this base formula).
- **RandomFactor:** uniform random value between **0.90 and 1.10**, rerolled on every hit — keeps outcomes from feeling robotic without swinging wildly.

### Worked examples

**Physical Basic Attack, Level 1 baseline** — base stats (Might 10, Resolve 10), Power 40:
`floor((40 × 10) / (10 × 8)) = 5` → **5 damage** vs. a base Vigor pool of 20 — a fresh Level 1 Traverser survives **~4 basic hits**, not 1.

**Physical Basic Attack** — Level 10 Traverser, Might 25, Power 40, vs. enemy Resolve 20:
`floor((40 × 25) / (20 × 8)) = 6` → **6 damage** (×1.0 type, no crit, avg roll)

**Divine Skill, super-effective hit** — "Thunderer's Wrath" (Storm), Power 65, Favor 30, vs. a Sea-aligned enemy (Aegis 18, ×2.0 vs Storm):
`floor((65 × 30) / (18 × 8)) = 13` → `13 × 2.0 = 26` **base**, ranging roughly **23–29** with random variance, up to **~39** on a crit — a heavy, meaningful hit, but not an automatic KO even against a modest Vigor pool.

**Balance check (why ÷8, not ÷2):** an earlier pass of this formula used a ÷2 divisor, which produced a Basic Attack dealing exactly 20 damage against a base Level 1 Vigor pool of 20 — a guaranteed one-hit KO before the player had allocated a single stat point, and the ratio barely improved by Level 10 even with stats invested. That undercut both the "2–5 turn battles" pacing goal and the point of the type chart, since a fight decided on the first hit leaves no room for weakness/resistance play to matter. The ÷8 divisor above was chosen to put a Level 1 mirror-match at roughly 4 hits to KO, which should be revisited once Section 3 assigns real move Power values.

---

## 8. Cross-Section Flags

- **Section 3 (Move & Ability Design):** needs to assign exact Power values, per-move use-limits (3–5 range suggested here), and type/category per move within the 4-Skill-loadout structure defined above.
- **Section 4 (Battle Items):** Item is a confirmed third battle action alongside Attack/Skill — item roster and effects (including any Vigor-restoring items, which should be designed carefully alongside the passive/daily Vigor regen rules above so they don't undermine the rest-day pacing) are out of scope here.
- **Sections 5–7 (Enemy/Boss Rosters): FULFILLED.** All three zones (Olympion, Valheon, Imperion) are now complete. Every enemy has Might/Resolve/Favor/Aegis/Stride stats plus a type assignment consistent with this chart, and boss encounters were built non-fleeable per Section 5's assumption above — confirmed as correct across all three zones with no objection or revision needed.
- **Section 1 (already completed):** starting stat baselines there were flagged as provisional pending this section's damage formula — the formula above should be used to sanity-check/rebalance those baselines if early-game battles feel too fast or too slow once move Power values exist.
- **Section 9 (Overworld Map):** wild encounter flee behavior (Section 5 above) assumes overworld encounters are always fleeable; confirm this doesn't conflict with any zone-specific encounter design.

---

## 9. Open Questions

- **Flee mechanic:** ~~assumed available for wild encounters, disabled for bosses — not explicitly specified in the planning doc; confirm this matches intent.~~ **CLOSED — confirmed by consistent use across Sections 5, 6, and 7.** All wild encounters (Harpy, Satyr, Draugr, Valkyrie, Strix, Lemures) are fleeable; all six bosses across all three zones are non-fleeable, with no exceptions or objections raised. This is now the final rule, not an assumption.
- **4-Skill loadout cap:** ~~a reasonable, familiar default, but not sourced from the planning doc — confirm before Section 3 locks in move design around it.~~ **CLOSED — confirmed as final by Section 3.**
- **Crit chance/multiplier (6.25% / 1.5x)** and the **damage formula's ÷8 divisor**: ~~first-pass values with no real movepool to test against yet; expect a rebalance pass once Section 3's move list exists.~~ **CLOSED — validated, no rebalance needed.** Sections 5–7 ran extensive Python-verified balance modeling (turn-count simulations, full fight-arc simulations for every boss) against the real Section 3 movepool and real enemy stats across all three zones. The ÷8 divisor and crit values held up under every scenario tested — neutral fights consistently land in the intended "wrong tool" range (7–19+ turns), SE fights consistently land in the 2–8 turn target window, and no one-shot or unwinnable-fight cases turned up. No formula change is needed going into Section 8 or beyond.
- **Daily encounter cap:** ~~isn't assigned to a specific section — worth deciding whether it belongs here, in Onboarding (Section 10), or Overworld Map (Section 9).~~ **CLOSED — housed and resolved in Section 9 §5.** Hard cap of 5 wild encounters per calendar day, reset at local midnight, fed by passive forward-travel checkpoints, workout-session bonus rolls, and manual Explore.
- **Vigor recovery rates** (1%/10min passive regen, 25% floor on defeat) are a first design pass aimed at satisfying the "rest days matter, losses aren't punishing" brief — worth playtesting now that encounter frequency is fixed (daily cap of 5, Section 9 §5).
