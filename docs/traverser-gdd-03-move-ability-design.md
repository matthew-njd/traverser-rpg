# Traverser GDD — Section 3: Move & Ability Design

## 1. Overview

This section defines every move and ability the Traverser can use in battle: the full pool of **level-unlocked skills**, the **gear-granted move system**, **naming conventions**, and the vocabulary of **secondary effects** available on high-rarity gear moves.

The move system builds directly on Section 2's framework: a Basic Attack (always available, untyped Physical, Power 40) plus a loadout of **up to 4 Skills** chosen from however many the player has unlocked. Skills are either **Physical** (untyped, Might vs. Resolve) or **Divine** (typed, one of the six godly domains, Favor vs. Aegis). All moves hit 100% of the time. Uses replenish fully at the start of every new battle.

The design follows two guiding constraints:

- **Clarity:** the player should understand what any move does at a glance. No stacking modifiers, multi-step effects, or hidden state.
- **Type play as the power lever:** neutral matchups produce steady, moderate damage; super-effective hits produce the decisive spikes that keep fights in the 2–5 turn target window. The move list is designed so that good type matchup always matters more than raw Power.

---

## 2. Level-Unlocked Move Pool

### 2.1 Design Principles

The level-unlocked pool contains **9 skills total**: 3 Physical Skills and 6 Divine Skills — one Divine per godly-domain type. This means:

- Every type is eventually represented in the level-unlock pool, so a player reaching the level cap has native coverage of all six types if they want it.
- The 4-skill loadout limit (Section 2) means a max-level player always benches 5 of their 9 skills — a meaningful, permanent strategic choice with no obviously correct answer.
- Physical Skills are the reliable fallback: no type dependency, competitive raw Power, and useful regardless of enemy type. A Might-heavy build makes them the primary damage source; a Favor-heavy build treats them as the insurance plan.
- Divine Skills are the spike damage layer: weaker against resistant enemies, dramatically stronger against vulnerable ones. Knowing the type chart, or scouting enemy types from early battles, is the rewarded behavior.

Learn levels are spread across the full 1–60 curve. The earliest skills are the simplest, with type complexity introduced gradually:

| Milestone | Level | What changes |
|---|---|---|
| First skill | 4 | One Physical option beyond Basic Attack |
| First Divine | 6 | Type system becomes live for the player |
| Full 4-skill loadout | 16 | All four slots can be filled for the first time |
| First tradeoff required | 22 | Five skills unlocked, only four slots — benching begins |
| Full type coverage | 44 | All six types represented in the pool |
| Final skill | 56 | Peak Physical move, 4 levels before cap |

### 2.2 Full Move List

| # | Name | Category | Type | Power | Uses/battle | Learn Level |
|---|------|----------|------|-------|-------------|-------------|
| 1 | **Iron Advance** | Physical Skill | — | 60 | 5 | 4 |
| 2 | **Thunderer's Wrath** | Divine Skill | Storm | 65 | 4 | 6 |
| 3 | **Warlord's Advance** | Divine Skill | War | 65 | 4 | 10 |
| 4 | **Shadowstep** | Divine Skill | Trickery | 55 | 5 | 16 |
| 5 | **Titan's Reach** | Physical Skill | — | 80 | 4 | 22 |
| 6 | **Pale Sentence** | Divine Skill | Underworld | 75 | 3 | 30 |
| 7 | **Tidecaller's Grasp** | Divine Skill | Sea | 65 | 4 | 36 |
| 8 | **Sage's Verdict** | Divine Skill | Wisdom | 75 | 3 | 44 |
| 9 | **Champion's Surge** | Physical Skill | — | 100 | 3 | 56 |

### 2.3 Individual Move Specifications

Each move entry includes: mechanical values, the in-battle flavor line shown to the player (brief, atmospheric, no longer than one sentence), and design notes for balancing reference.

---

#### Iron Advance *(Level 4 — Physical Skill)*
- **Power:** 60 | **Uses:** 5/battle | **Stats:** Might vs. Resolve
- **Flavor:** *"Drive forward — iron will, mortal strength."*
- **Design note:** The player's first real skill. Five uses mean it's free to spam — it should feel reliable rather than precious. Power 60 over Basic Attack's 40 is a clean 1.5× improvement at identical stats. No type dependency makes this the always-safe choice against unknown enemies, which is appropriate for the game's earliest fights. Named to echo the core movement motif (advance = forward movement) while keeping the mythology-neutral tone of Physical moves.

---

#### Thunderer's Wrath *(Level 6 — Divine Skill, Storm)*
- **Power:** 65 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** Storm (2× vs. War, Trickery — 0.5× vs. Sea, Wisdom)
- **Flavor:** *"The sky splits. Something vast and furious answers."*
- **Design note:** The first typed move, and the introduction to the type chart. Storm is a strong opening type — it covers War and Trickery, two of the more common early-zone enemy flavors in Olympion and Valheon. Players will see SE results quickly, reinforcing that the type system rewards attention. Power 65 at neutral is a modest improvement over Iron Advance; the value is the 2× SE ceiling. Named after the sky-god epithet shared across all three pantheons (Thunderer = Thor, but the title applies equally to Zeus and Jupiter without naming them).

---

#### Warlord's Advance *(Level 10 — Divine Skill, War)*
- **Power:** 65 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** War (2× vs. Trickery, Underworld — 0.5× vs. Storm, Wisdom)
- **Flavor:** *"A conqueror's momentum — no retreat, no hesitation."*
- **Design note:** Same Power and uses as Thunderer's Wrath, different type coverage. War's strength against Underworld enemies will matter more as the player enters mid-game zones. The name deliberately echoes Iron Advance — both are "advance" moves — but the Physical one is mortal discipline and the War one is divine martial force. This naming parallel is intentional: it ties the two playstyle identities (raw fighter vs. type strategist) together tonally.

---

#### Shadowstep *(Level 16 — Divine Skill, Trickery)*
- **Power:** 55 | **Uses:** 5/battle | **Stats:** Favor vs. Aegis | **Type:** Trickery (2× vs. Underworld, Sea — 0.5× vs. War, Storm)
- **Flavor:** *"Gone before they can strike back. That's the trick."*
- **Design note:** Deliberately the weakest individual hit in the Divine pool (Power 55 vs. 65 standard). This is intentional Trickery theming — cunning operates through volume and exploitation, not brute force. Five uses instead of four compensates for lower per-hit power when type advantage is in play (5 × 19 SE = 95 potential damage per battle vs. Thunderer's Wrath's 4 × 21 = 84). Against neutral or resistant targets, Shadowstep is the worst skill the player owns — which encourages understanding when *not* to use it. The name is pure action, no title or epithet, matching the quick/informal register of Trickery.

---

#### Titan's Reach *(Level 22 — Physical Skill)*
- **Power:** 80 | **Uses:** 4/battle | **Stats:** Might vs. Resolve
- **Flavor:** *"Older than gods. Heavier than mountains."*
- **Design note:** The mid-game Physical upgrade. Power 80 makes this the go-to Physical hit when Iron Advance starts to feel routine (around the time the player has 5 skills and must make real loadout choices). Four uses instead of five adds a mild cost to the increased power — the player shouldn't spam this over Iron Advance without thinking. "Titan" is pre-Olympian, pre-Asgardian, pre-anything — a deliberate choice to keep the Physical move line outside any specific pantheon's identity.

---

#### Pale Sentence *(Level 30 — Divine Skill, Underworld)*
- **Power:** 75 | **Uses:** 3/battle | **Stats:** Favor vs. Aegis | **Type:** Underworld (2× vs. Sea, Wisdom — 0.5× vs. Trickery, War)
- **Flavor:** *"From the cold dark below, a verdict with no appeal."*
- **Design note:** First of the "heavyweight" Divine moves (Power 75, 3 uses). Three uses adds tension — it's not a move you throw away on neutral matchups, which fits the Underworld's thematic weight (death should feel meaningful, not casual). Arrives at Level 30, which is mid-game for an average user (~125 days in), when the player's Favor investment is high enough to make 75 Power feel appropriately powerful. "Pale Sentence" evokes the finality and cold formality common to death-deity iconography across all three pantheons.

---

#### Tidecaller's Grasp *(Level 36 — Divine Skill, Sea)*
- **Power:** 65 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** Sea (2× vs. Wisdom, Storm — 0.5× vs. Underworld, Trickery)
- **Flavor:** *"The tide goes where it wills. So does this."*
- **Design note:** Standard-tier Divine (Power 65, 4 uses), matching Thunderer's Wrath and Warlord's Advance in profile. Sea covers Wisdom and Storm — the latter being the first type the player ever learned (Thunderer's Wrath). There's a satisfying circularity here: a late-unlocked skill threatening something the player thought was a reliable old move. Sea unlocking at Level 36 means Wisdom and Storm enemies are meaningfully harder to handle until mid-game, which creates genuine progression tension. "Tidecaller's Grasp" — "Tidecaller" is an epithet-style title (evokes Poseidon/Njörð/Neptune without naming them), "Grasp" captures the drowning/pulling imagery of the sea.

---

#### Sage's Verdict *(Level 44 — Divine Skill, Wisdom)*
- **Power:** 75 | **Uses:** 3/battle | **Stats:** Favor vs. Aegis | **Type:** Wisdom (2× vs. Storm, War — 0.5× vs. Sea, Underworld)
- **Flavor:** *"Not reckless force. The precise strike that ends things."*
- **Design note:** The final type the player unlocks, completing full type coverage at Level 44. Wisdom covering Storm and War means the player can now, for the first time, threaten every enemy type using only level-unlocked moves. That's the payoff for investing to Level 44. Power 75, 3 uses mirrors Pale Sentence — the two "heavyweight" Divine moves bookend the mid-game Divine unlock sequence. Wisdom is deliberately the last type and the most strategically satisfying: the type most associated with patience, long experience, and deferred payoff.

---

#### Champion's Surge *(Level 56 — Physical Skill)*
- **Power:** 100 | **Uses:** 3/battle | **Stats:** Might vs. Resolve
- **Flavor:** *"Everything the Traverser is, in a single strike."*
- **Design note:** The highest-Power move in the game, Physical type, unlocking four levels before the cap. At a Might-focused Level 56 build, this is decisively stronger than any neutral Divine hit — the definitive argument for a Physical specialist build at endgame. Three uses makes it precious: the player won't fire this casually, which keeps it feeling like an event when it lands. Unlocking at Level 56 (~440 days for an average user) means it's genuinely a late-game reward, not a mid-game staple. The name steps outside the epithet convention used by all other moves — no "Something's Something" construction — because at the cap, the Traverser *is* the legend. The move belongs to them, not to a god.

---

### 2.4 Loadout Snapshot by Level Range

The table below summarizes what's available and what buildcraft looks like at key stages:

| Level range | Skills available | Loadout state | Type coverage |
|---|---|---|---|
| 1–3 | 0 | Basic Attack only | None |
| 4–5 | 1 (Iron Advance) | 1 of 4 slots fillable | Physical only |
| 6–9 | 2 | 2 of 4 slots fillable | Storm |
| 10–15 | 3 | 3 of 4 slots fillable | Storm, War |
| 16–21 | 4 | **Full loadout for first time** | Storm, War, Trickery |
| 22–29 | 5 | **First skill benched** | Storm, War, Trickery |
| 30–35 | 6 | 2 skills benched | Storm, War, Trickery, Underworld |
| 36–43 | 7 | 3 skills benched | Storm, War, Trickery, Underworld, Sea |
| 44–55 | 8 | 4 skills benched | **All 6 types** |
| 56–60 | 9 | **5 skills benched** | All 6 types |

---

## 3. Naming Conventions

### 3.1 Standard: deity-flavoured

Move names evoke the gods' domains and ancient titles without using any deity's proper name. The goal is a name that could belong to any of the three pantheons — or the fourth, eventually — without locking to one.

Three structural patterns are used across the level-unlock pool:

**[Title/Epithet]'s [Action or Noun]** — godly authority implied through a title rather than a name:
- *Thunderer's Wrath* — "Thunderer" is shared by Thor, Zeus, and Jupiter without belonging to any one
- *Tidecaller's Grasp* — a domain title, not a deity name
- *Sage's Verdict* — "Sage" as the wisdom-deity archetype

**[Mythological concept] + [Action/Impact word]** — tonal over referential:
- *Pale Sentence* — Underworld imagery (pale = death, sentence = final judgment)
- *Iron Advance* — Physical martial imagery, no deity implied
- *Shadowstep* — Trickery as action, not character

**Standalone names with a single image** — short, punchy, self-contained:
- *Champion's Surge* — the Traverser's own identity, no external reference
- *Titan's Reach* — "Titan" as pre-divine archetype rather than named character

### 3.2 Rules to follow

- **No proper deity names** in any move name: no Zeus, Odin, Mercury, Athena, Thor, etc. This keeps names from accidentally favoring one pantheon and leaves them clean for the Egyptian expansion.
- **Each type has a tonal register** to maintain consistency across gear-granted moves designed later in Section 8:
  - **Storm:** grandeur, power, the uncountable (sky, lightning, splitting)
  - **War:** forward motion, conquest, precision (advance, strike, edict)
  - **Trickery:** speed, disappearance, informality (step, slip, cut, gone)
  - **Underworld:** cold, finality, weight (pale, sentence, knell, cold)
  - **Sea:** inevitability, depth, indifference (tide, grasp, fathom, pull)
  - **Wisdom:** deliberateness, clarity, consequence (verdict, gaze, word, reckoning)
- **Physical moves** have no type tonal register — they draw from general mythology (Titan, Champion, Iron) and are the only move names that can directly reference the Traverser's own identity.
- Move names should be speakable aloud — avoid tongue-twisters or constructions that look good in text but feel awkward when a player reads them in a battle.

### 3.3 Gear-granted move naming additions

Gear-granted moves (Section 4 below) follow the same deity-flavoured convention, with one additional layer: **Trinket moves carry zone-specific pantheon flavor** without naming gods:

- **Olympion Trinkets:** classical imagery — "Skyfather's Judgment," "Labyrinthine Strike," "Titan's Echo," "Golden Rage"
- **Valheon Trinkets:** Norse-evocative — "Allfather's Gaze," "World-Serpent's Coil," "Rune-Carved Strike," "Frostbitten Edge"
- **Imperion Trinkets:** Roman-martial — "Imperial Edict," "Legion's Fury," "Civic Reckoning," "Eternal March"

This means trinket move names implicitly tell the player where a trinket came from — flavor reinforcement rather than a gameplay mechanic.

---

## 4. Gear-Granted Move System

### 4.1 Core Mechanic

Gear pieces of Mythic or Divine rarity grant the Traverser access to an additional battle skill while that piece is equipped. **Unequipping the gear removes access to its move.** The move does not become permanently unlocked — it travels with the item.

**All gear-granted moves are Divine-typed** (one of the six godly-domain types). Gear never grants Physical (untyped) skills. Physical skills are exclusively level-unlocked — the Traverser's mortal strength grows through experience, not equipment. This keeps the design separation clean: leveling grows raw physical power, gear expands type coverage and tactical options. If a future item needs to feel physically impactful, it should do so through stat bonuses rather than a Physical skill grant. This policy can be revisited in Section 8 if a specific item concept requires it, but the default is typed-only.

This makes gear choice a loadout decision, not just a stat decision. Equipping a Divine relic because it's statistically optimal might mean displacing a level-unlocked skill you prefer — or it might open up type coverage you're otherwise missing. Both outcomes are desirable from a design standpoint.

Gear-granted moves use the same 4-skill slots established in Section 2. There are no bonus slots. The maximum number of gear-granted moves available at any time equals the number of Mythic/Divine pieces currently equipped, up to all four gear slots (Weapon, Armor, Accessory, Trinket). The player's available pool — level-unlocked skills plus gear-granted moves — is what they pick their active 4 from.

**Summary:** At max level with four Mythic or Divine gear pieces equipped, the player has up to 13 skills to pick 4 from (9 level-unlocked + 4 gear-granted). This is the maximum achievable loadout depth.

### 4.2 Rarity Thresholds and Move Grades

| Gear Rarity | Stat bonuses | Move granted? | Move type |
|---|---|---|---|
| **Mortal** | Yes | No | — |
| **Heroic** | Yes | No | — |
| **Mythic** | Yes | Yes — Damage only | Damage move, Power 65–80 |
| **Divine** | Yes | Yes — Damage + Effect | Damage move with secondary effect, Power 65–75 |

**Mythic gear grants damage-only moves** in the Power 65–80 range — solid, useful additions that expand the loadout without outclassing endgame level-unlocked skills. They are broadly comparable to mid-tier level skills like Thunderer's Wrath or Titan's Reach.

**Divine gear grants damage + secondary effect moves** with slightly lower raw Power (65–75) to keep the secondary effect from being purely additive on top of a stronger hit. The effect is what makes the move feel special, not the Power number.

Neither gear-granted move type exceeds Power 100. Champion's Surge remains the highest raw-damage hit in the game, available only from leveling — a deliberate reward for progression that gear cannot replicate.

### 4.3 Secondary Effect Vocabulary

All secondary effects are:
- **Single-trigger** — they fire once and are gone; no duration to track
- **Non-stacking** — applying the same effect twice has no additional impact
- **Resolved at the moment of the next relevant action** — no persistent state beyond one immediate event

Four effects are available for Divine gear moves. Section 8 (Gear & Loot Tables) assigns specific effects to specific items:

| Effect | Trigger timing | What it does |
|---|---|---|
| **Weaken** | Applied on hit, resolved on target's next attack | Target's next outgoing attack deals 50% of its normal damage |
| **Fortify** | Applied on hit, resolved on next hit received by the Traverser | The Traverser takes 50% of normal damage from the next hit they receive (multiplier: 0.5×) |
| **Swift** | Applied on hit, resolved at the top of the following round | The Traverser acts first next round, regardless of Stride comparison (ties included) |
| **Rend** | Applied on hit, resolved when target receives their next hit | Target takes 150% of normal damage from the next hit they receive — a 50% amplification (multiplier: 1.5×) |

**Interaction rules:**
- Weaken and Fortify operate on opposite ends of the same hit — Weaken affects the attacker's outgoing damage, Fortify affects the defender's incoming damage. Both can be in effect simultaneously without conflict.
- Swift's "act first" overrides the Stride calculation for one round only. If both the Traverser and the enemy apply Swift in the same round, the effect cancels and the normal Stride order applies.
- Rend stacks with the type multiplier — a Rend-tagged enemy hit by a super-effective move receives 2.0× (TypeMult) × 1.5× (Rend) = 3.0× damage on that next hit. This is intentional: it makes Rend a meaningful setup tool for big type-advantage turns without requiring any additional mechanical tracking. See Open Questions for the ceiling check against real enemy HP values.

### 4.4 Gear-Granted Move Uses Per Battle

- **Mythic gear moves (damage only):** 4 uses/battle
- **Divine gear moves (damage + effect):** 3 uses/battle

This mirrors the pattern in the level-unlock pool — heavyweight or effect-bearing moves cost fewer uses. The secondary effect's value comes partly from it being a resource to spend, not a free bonus on every hit.

### 4.5 Assignment to Section 8

The specific move granted by each gear item — its Power, type, effect (if Divine), and name — is specified in Section 8 (Gear & Loot Tables) as part of the full item definitions. This section establishes only the structural rules and the vocabulary of what's possible.

---

## 5. Balance Notes

### 5.1 Why neutral matchups feel slow

At any given level, a Traverser dealing neutral damage will take approximately 5–9 hits to KO an even-level enemy depending on stat investment. This is intentional. The combat loop is designed around type play being the fast path:

- **Neutral matchup:** 5–9 hits to KO — fights run long, encouraging the player to retreat or reconsider loadout
- **Super-effective matchup:** 2–4 hits to KO — sits cleanly in the 2–5 turn target window
- **Resisted matchup:** 10+ hits — a signal to the player that this is the wrong tool

A player who ignores the type chart will have functional but slow fights. A player who reads it will have fast, decisive ones. This is the core behavioral reward for understanding the system, not a difficulty spike.

### 5.2 Physical vs. Divine calibration

At a given level, a Might-focused build makes Physical Skills more efficient than a neutral Divine hit (same stat invested, but Might affects Physical damage while Favor affects Divine). The crossover where Divine outperforms Physical is specifically when type advantage applies — that's the intended design:

- Physical is the floor: reliable, type-independent, always at least competitive
- Divine is the ceiling: situationally dominant when SE, weaker when neutral or resisted

A player who builds into both Might and Favor sacrifices total stat investment in both directions; a player who commits to one creates a clearer identity. The stat allocation system from Section 1 (3 points per level, manual allocation) is what makes this a real choice rather than a solved equation.

### 5.3 Calibration dependency on enemy stats

The Power values above are balanced internally against each other and against the damage formula from Section 2. Their **absolute** calibration — specifically whether fights run 2–5 turns in practice — depends on enemy Vigor and defense stat values, which are defined in Sections 5–7 (enemy/boss rosters). The enemy HP proxy used in balance modeling above should be treated as directional, not final. A rebalance pass on move Power values may be warranted after Sections 5–7 are locked in.

---

## 6. Cross-Section Flags

- **Section 2 (Combat) — 4-skill loadout cap resolved:** Section 2 flagged the 4-skill cap as an open question requiring confirmation before Section 3 locked in move design around it. That confirmation is made here — the 4-skill cap is final. Section 2's open question on this point is closed.
- **Section 2 (Combat) — worked example superseded: RESOLVED.** Section 2's damage formula worked example has been updated to use the real Storm move — "Thunderer's Wrath" at Power 65 — in place of the original "Thunderclap" placeholder. The formula itself was always unchanged; only the example values needed correcting, and that correction is now reflected in Section 2's text directly.
- **Section 2 (Combat) — Physical skill unlock policy correction: RESOLVED.** Section 2's move category table now correctly reads "Unlocked by level only" for Physical Skills, matching this section's stricter policy (gear grants Divine-typed skills exclusively). The "or gear" clause has been removed from Section 2's table.
- **Section 2 (Stat baselines): VALIDATED as of Section 7.** The `Power / (defStat × 8)` formula was stress-tested against real builds with heavy stat specialization across all three enemy roster sections (5–7), including full Level 60 Might-maximizer and Favor-maximizer scenarios. No one-shot cases turned up against any enemy in any zone, even at the highest realistic stat investment. The ÷8 divisor and Power cap need no revision.
- **Sections 5–7 (Enemy/Boss Rosters): FULFILLED.** All three zones are complete and locked. Move Power values were verified against real enemy Vigor and defense stats via Python simulation throughout — 2–5 turn SE pacing holds across all three zones, with neutral fights deliberately running longer (7–19+ turns) as designed. The Swift cancellation rule question is also resolved: no enemy or boss move across any of the three zones grants Swift, confirming the rule inert for the base game (see Open Questions below).
- **Section 8 (Gear & Loot Tables):** each Mythic and Divine item needs a move assigned using the structure defined in Section 4 above — Power range, type (must be one of the six Divine types; no Physical gear moves), and effect (Divine only). The secondary effect vocabulary is fixed here; Section 8 chooses from it per item. Zone trinket naming conventions (Section 3.3 above) should be followed when naming those moves.
- **Section 10 (Onboarding):** the tutorial battle should introduce Basic Attack on turn 1, then teach Skills (Iron Advance, once learned at Level 4) in an early post-tutorial encounter. The type system introduction (Thunderer's Wrath, Level 6) should be framed explicitly in-game — a tooltip or brief tutorial moment explaining typed damage is warranted at that moment. Secondary effects (Weaken/Fortify/Swift/Rend) introduced via Divine gear should also be explained in-UI when first encountered — Section 13 (UI Architecture) owns that prompt (delivered: Section 13 §6.4's secondary-effect tooltip).

---

## 7. Open Questions

- **Rend + type advantage interaction (3× total):** ~~the combined ceiling of Rend + super-effective is deliberately allowed — but should be confirmed acceptable once enemy HP values are known. If it produces consistent one-shots at any realistic level, Rend's bonus should be reduced from +50% to +25%.~~ **CLOSED — confirmed safe.** Section 4's parallel Surge+Breach ×3.0 ceiling (the same mathematical ceiling via a different mechanism) was explicitly validated against all three zones' final enemy Vigor values in Section 7 and never approaches a one-shot, even against the squishiest wild encounters. The same conclusion applies directly to Rend+SE. No change needed.
- **Swift cancellation rule (both sides apply in the same round):** ~~cancellation is the cleanest resolution, but it means two Swift effects in the same round cancel each other to no effect, which could feel odd. An alternative (e.g., first-applier wins) is worth considering, but adds complexity to track. Marked for playtesting. Moot if Sections 5–7 establish that enemies never use Swift.~~ **CLOSED — confirmed moot.** No enemy or boss across Olympion, Valheon, or Imperion uses Swift (confirmed in Section 7, the final roster section). The cancellation rule is inert for the entire base game. It can be dropped in a future Section 2 revision pass, or kept dormant purely as forward-compatibility in case a future Egyptian-zone enemy introduces a Swift-granting move.
- **Power 65–80 range for Mythic gear moves vs. Level-unlock pool:** ~~overlaps with everything between Thunderer's Wrath (65) and Titan's Reach (80)... if certain gear-granted moves end up statistically dominant, Section 8 should narrow the Mythic range downward.~~ **CLOSED — resolved in Section 8.** The overlap is intentional and load-bearing: all three Mythic Trinket moves sit at the P80 ceiling by design, each typed to ease the *next* zone's hardest fight (Section 8 §4.2), and the §6.2 stacking check there confirmed no dominance problem. No narrowing needed.
- **Move count at cap (pick 4 of 9):** this choice was made for a lean pool that forces meaningful decisions. If playtesting reveals the endgame pool feels too small (always obvious which 4 to pick), adding 1–2 more level-unlocked skills in the Level 45–58 range would be the lowest-friction fix — the structure supports it without redesigning anything.
