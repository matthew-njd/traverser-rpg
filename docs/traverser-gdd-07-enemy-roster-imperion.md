# Traverser GDD — Section 7: Enemy & Boss Roster — Imperion

## 1. Overview

This section defines the complete enemy roster for **Imperion**, the Roman mythology zone and the third and final launch zone. The roster consists of **four entries** — two wild encounter types and two boss encounters — each with its own stat scaling formula, move set, and drop table.

Imperion is the endgame zone. Its expected level range (roughly Level 33 at zone entry through the level cap of 60) places it after all six Divine types have been unlocked (Wisdom, the last, arrives at Level 44) and within reach of Champion's Surge (Level 56), the strongest move in the game. Where Olympion taught the type system and Valheon tested whether it had been learned under pressure, Imperion's role is different: **by the time a player reaches this zone, there is no more type-chart knowledge left to teach.** Every matchup a Traverser will ever need is already available. Imperion is therefore built around *execution* — raw preparation, resource management, and precision under a full toolkit — rather than discovery.

**Roster and type selection:**

| Role | Creature | Type | Rationale |
|---|---|---|---|
| Wild 1 | **Strix** | Trickery | Roman vampiric night-owl of ill-omen folklore. Revisits Trickery, mirroring Satyr's exact matchup profile as a late-game callback. |
| Wild 2 | **Lemures** | Underworld | Restless, malevolent household dead of Roman religion. Third Underworld enemy after Cerberus and Draugr — confirms mastery rather than teaching it. |
| Mid-boss | **Griffin** | Wisdom | Eagle-lion guardian tied to vigilance and the legion standard (aquila). First enemy of Wisdom type in the game — deliberate, since Wisdom is the last type players unlock. |
| Final boss | **Cacus** | Storm | Fire-breathing giant from genuine Roman legend (Aeneid/Livy). Chaotic elemental fury reads as Storm the same way Harpy's flight did in Olympion — an intentional flavor-stretch, not a literal weather deity. |

War does not appear as an enemy type in Imperion. It has already anchored two boss fights (Cyclops, Fenrir) and doesn't need a third; Warlord's Advance remains useful elsewhere without a dedicated target here.

---

## 2. Enemy Level Scaling

Enemy level equals the Traverser's current level at the time of the encounter, identical to the policy established in Sections 5 and 6. All stat values are computed dynamically using the player's authenticated server level as the input variable L. The Battle XP formula `15 + (player level × 2)` applies unchanged — at Level 55, a win awards 125 XP.

As established in Section 5: enemy Divine moves never apply a TypeMultiplier against the Traverser (the player has no type), so all enemy damage figures in this section — including Griffin's Vigilant Gaze and Cacus's Thunderous Roar/Ashen Gale — are computed at a flat ×1.0 regardless of the player's build. Only the player's own attacks are subject to the type chart.

---

## 3. Enemy Roster

### 3.1 Strix — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Trickery |
| **Role** | Fast, evasive night-omen. Imperion's most common encounter. Mechanically identical in matchup profile to Satyr (Olympion) — same type, higher stakes. |
| **Effective vs.** | Underworld, Sea |
| **Vulnerable to** | Storm (2×, unlocked L6), War (2×, unlocked L10) |
| **Resists** | Underworld attacks (0.5×), Sea attacks (0.5×) |

**Stat Scaling Formulas** (all values apply `floor()`):

| Stat | Formula | L20 | L30 | L40 | L50 | L60 |
|---|---|---|---|---|---|---|
| Vigor | `10 + 2.6L` | 62 | 88 | 114 | 140 | 166 |
| Might | `6 + 0.5L` | 16 | 21 | 26 | 31 | 36 |
| Resolve | `6 + 0.5L` | 16 | 21 | 26 | 31 | 36 |
| Favor | `8 + 0.9L` | 26 | 35 | 44 | 53 | 62 |
| Aegis | `6 + 0.5L` | 16 | 21 | 26 | 31 | 36 |
| Stride | `9 + 0.8L` | 25 | 33 | 41 | 49 | 57 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Nightcut** | Trickery | Divine (Favor vs. Aegis) | 45 | 60% |
| **Talon Rake** | — | Physical (Might vs. Resolve) | 30 | 40% |

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

Strix's vulnerabilities (Storm, War) were both unlocked in the first ten levels of the game — there is no unlock-timing tension here at all by the time a player reaches Imperion. This is intentional: Strix exists to confirm mastery, not build it. At Level 34 (typical zone entry), Thunderer's Wrath or Warlord's Advance (either, both P65) deal approximately 31 damage per hit against Strix's Aegis — a clean **4-turn kill**. A player relying on Iron Advance alone (neutral Physical) takes approximately **7 turns** — still survivable, but a clear signal the player has forgotten a decade of lessons. By Level 58, SE combat holds steady at 4–5 turns as both sides scale together.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Shadowblur (Trickery Surge), Battlebrand (War Surge) |

---

### 3.2 Lemures — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Underworld |
| **Role** | Restless household dead. Tankier than Strix, teaching the same lesson Draugr taught in Valheon: type advantage is not optional against this profile. |
| **Effective vs.** | Sea, Wisdom |
| **Vulnerable to** | War (2×, unlocked L10), Trickery (2×, unlocked L16) |
| **Resists** | Wisdom attacks (0.5×), Sea attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L20 | L30 | L40 | L50 | L60 |
|---|---|---|---|---|---|---|
| Vigor | `10 + 2.7L` | 64 | 91 | 118 | 145 | 172 |
| Might | `9 + 0.85L` | 26 | 34 | 43 | 51 | 60 |
| Resolve | `8 + 0.7L` | 22 | 29 | 36 | 43 | 50 |
| Favor | `6 + 0.6L` | 18 | 24 | 30 | 36 | 42 |
| Aegis | `7 + 0.6L` | 19 | 25 | 31 | 37 | 43 |
| Stride | `6 + 0.55L` | 17 | 22 | 28 | 33 | 39 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Restless Grasp** | — | Physical (Might vs. Resolve) | 50 | 60% |
| **Grave Knell** | Underworld | Divine (Favor vs. Aegis) | 40 | 40% |

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

Lemures is the tankiest wild encounter in the game and the third enemy sharing Underworld's exact vulnerability profile (War, Trickery — both unlocked well before Imperion). At Level 34, Warlord's Advance (War SE, P65) deals approximately 26 damage per hit — a **4-turn kill**. Neutral Iron Advance drags this out to **11 turns**, the longest neutral fight in the game — Lemures is a deliberate, blunt reminder that raw stat growth alone never closes the type-advantage gap, no matter how late in the game. By Level 58, SE combat lengthens slightly to 6–7 turns as Lemures' bulk continues to outpace the player's flat Power ceiling — still comfortably faster than the neutral alternative, and a fair signal that this enemy is meant to be fought with a plan, not steamrolled.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Pale Ash (Underworld Surge) |

---

### 3.3 Griffin — Mid-Boss

| Field | Value |
|---|---|
| **Type** | Wisdom |
| **Role** | Vigilant guardian, first Wisdom-type enemy in the game. The zone's mid-boss: a fixed encounter at the Imperion distance midpoint milestone. |
| **Encounter trigger** | Fixed — appears when the player reaches the Imperion mid-zone distance gate (defined in Section 9). Cannot be a wild encounter. |
| **Fleeable?** | No — boss encounters cannot be fled (Section 2). |
| **Vulnerable to** | Sea (2×, unlocked L36), Underworld (2×, unlocked L30) |
| **Resists** | Storm attacks (0.5×), War attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L20 | L30 | L40 | L50 | L60 |
|---|---|---|---|---|---|---|
| Vigor | `20 + 2.5L` | 70 | 95 | 120 | 145 | 170 |
| Might | `10 + 0.85L` | 27 | 35 | 44 | 52 | 61 |
| Resolve | `9 + 0.7L` | 23 | 30 | 37 | 44 | 51 |
| Favor | `11 + 0.75L` | 26 | 33 | 41 | 48 | 56 |
| Aegis | `9 + 0.65L` | 22 | 28 | 35 | 41 | 48 |
| Stride | `10 + 0.7L` | 24 | 31 | 38 | 45 | 52 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Wing Buffet** | — | Physical (Might vs. Resolve) | 50 | 50% |
| **Vigilant Gaze** | Wisdom | Divine (Favor vs. Aegis) | 55 | 50% |

**AI Behaviour (MVP):** Weighted random selection each turn. Both moves deal comparable damage, so the player faces steady pressure regardless of which fires.

**Combat Design Notes:**

Griffin's Stride (`10 + 0.7L`) exceeds a typical player's at every relevant level, so — like Fenrir before it — the Traverser absorbs a hit before acting each round. Both SE options against Griffin (Sea, Underworld) are already unlocked well before the expected mid-gate level (~38–45), so this fight is not about discovering the right tool; it's about pacing item use across a genuinely long encounter.

At Level 42, Griffin's Vigor (125) sits just under the combined SE damage pool: Pale Sentence (3 uses × 27 = 81) plus Tidecaller's Grasp (4 uses × 23 = 92) totals **173 damage — 138% of Griffin's Vigor**, confirming the fight is cleanly winnable within available Skill uses without requiring neutral cleanup. Neutral Physical play (Titan's Reach only) takes **10 turns** — this remains the wrong tool, same as every prior boss.

**Expected fight arc at Level 42 (representative level for first Griffin attempt):**

```
Player Vigor: 56  |  Griffin Vigor: 125  |  Griffin acts first each round
Pale Sentence (Underworld SE): 27 dmg (3 uses)  |  Tidecaller's Grasp (Sea SE): 23 dmg (4 uses)
Griffin: Wing Buffet 14 dmg / Vigilant Gaze 10 dmg (alternating)

Round 1: Griffin Wing Buffet    →  Player 42   |  Player Pale Sentence     →  Griffin 98
Round 2: Griffin Vigilant Gaze  →  Player 32   |  Player Pale Sentence     →  Griffin 71
Round 3: Griffin Wing Buffet    →  Player 18   |  Player Pale Sentence     →  Griffin 44
Round 4: Griffin Vigilant Gaze  →  Player 8    |  Player Herald's Draft    →  Player 30 (+22)
Round 5: Griffin Wing Buffet    →  Player 16   |  Player Tidecaller's Grasp →  Griffin 21
Round 6: Griffin Vigilant Gaze  →  Player 6    |  Player Herald's Draft    →  Player 28 (+22)
Round 7: Griffin Wing Buffet    →  Player 14   |  Player Tidecaller's Grasp →  Griffin 0
→ WIN with 14 HP remaining. Items used: 2 Herald's Draft
```

Two Herald's Drafts — well within a standard 3-max stack — carry the fight cleanly. This positions Griffin as a genuine step up from Fenrir (which needed 1 Herald's Draft + 1 Salve) without approaching the knife-edge tension reserved for the zone's final boss.

**Drop Table (first kill):**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Mid-boss (first kill) | 75% | 1–2 items | Common + Uncommon pool |

Specific drop pool: **Clearsight** (Wisdom Surge Charm — Common), **Undertow** (Sea Breach Charm — Uncommon), **Ironhide Tincture** (Fortify buff — Uncommon). Undertow in particular reinforces the exact SE tool used against Griffin itself, useful for repeat visits and for Cacus (also Sea-vulnerable) ahead.

**Drop Table (repeat kills):** 75% chance, 1–2 items, Common and Uncommon only, same pool as above — no Rares, per the repeat boss policy established in Section 5.

---

### 3.4 Cacus — Zone Final Boss

| Field | Value |
|---|---|
| **Type** | Storm |
| **Role** | Fire-giant of Roman legend, reimagined mechanically as a Storm-type — chaotic, overwhelming force rather than literal weather. Imperion's final boss and the hardest fight in the game. |
| **Encounter trigger** | Fixed — appears at the Imperion final boss gate (defined in Section 9). Requires Griffin to be defeated first. |
| **Fleeable?** | No. |
| **Vulnerable to** | Sea (2×, unlocked L36), Wisdom (2×, unlocked L44) |
| **Resists** | Trickery attacks (0.5×), War attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L20 | L30 | L40 | L50 | L60 |
|---|---|---|---|---|---|---|
| Vigor | `22 + 2.2L` | 66 | 88 | 110 | 132 | 154 |
| Might | `11 + 0.9L` | 29 | 38 | 47 | 56 | 65 |
| Resolve | `8 + 0.55L` | 19 | 24 | 30 | 35 | 41 |
| Favor | `13 + 0.95L` | 32 | 41 | 51 | 60 | 70 |
| Aegis | `9 + 0.6L` | 21 | 27 | 33 | 39 | 45 |
| Stride | `7 + 0.32L` | 13 | 16 | 19 | 23 | 26 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Thunderous Roar** | Storm | Divine (Favor vs. Aegis) | 70 | 40% |
| **Cinder Grip** | — | Physical (Might vs. Resolve) | 60 | 35% |
| **Ashen Gale** | Storm | Divine (Favor vs. Aegis) | 45 | 25% |

**AI Behaviour (MVP):** Weighted random selection each turn. Three moves with meaningful power variance (70/60/45) — the player can never be fully certain how hard the next hit lands, mirroring Cerberus and Jörmungandr's three-move final-boss pattern.

**Combat Design Notes:**

Cacus is deliberately the culmination of everything Imperion is about: unlike Griffin, whose SE tools were unlocked long before the fight, Cacus's second SE option (Sage's Verdict, Wisdom, L44) unlocks *close to* the expected final-gate level (~48–56) — meaning some players will still be racing to unlock it. This is the last echo of the "unlock timing matters" tension the game has used throughout, now compressed into the final encounter. **A player who reaches Cacus before Level 44 has only Tidecaller's Grasp (Sea) as an SE option** — the fight is winnable but notably harder, in the same spirit as pre-Level-30 Jörmungandr.

Cacus's Stride (`7 + 0.32L`) keeps it faster than a typical player throughout the relevant range, so — as with Griffin and Fenrir — the Traverser absorbs a hit before acting every round. At Level 52 (representative first-attempt level, both SE options available), Cacus's Vigor (136) sits well under the combined SE pool: Sage's Verdict (3 × 29 = 87) plus Tidecaller's Grasp (4 × 25 = 100) totals **187 — 137% of Vigor** — but Cacus's damage output (weighted average ~15 per turn, acting first) makes this the tightest fight in the game by total pressure, not by raw HP.

**Expected fight arc at Level 52 (representative level for first Cacus attempt, both SE options available):**

```
Player Vigor: 65  |  Cacus Vigor: 136  |  Cacus acts first each round
Sage's Verdict (Wisdom SE): 29 dmg (3 uses)  |  Tidecaller's Grasp (Sea SE): 25 dmg (4 uses)
Cacus: Thunderous Roar 16 / Cinder Grip 19 / Ashen Gale 10 (weighted mix)

Round 1: Cacus Thunderous Roar  →  Player 49   |  Player Sage's Verdict      →  Cacus 107
Round 2: Cacus Cinder Grip      →  Player 30   |  Player Sage's Verdict      →  Cacus 78
Round 3: Cacus Ashen Gale       →  Player 20   |  Player Sage's Verdict      →  Cacus 49
Round 4: Cacus Thunderous Roar  →  Player 4    |  Player Herald's Draft      →  Player 30 (+26)
Round 5: Cacus Cinder Grip      →  Player 11   |  Player Herald's Draft      →  Player 37 (+26)
Round 6: Cacus Thunderous Roar  →  Player 21   |  Player Tidecaller's Grasp  →  Cacus 24
Round 7: Cacus Ashen Gale       →  Player 11   |  Player Traveler's Salve    →  Player 24 (+13)
Round 8: Cacus Cinder Grip      →  Player 5    |  Player Tidecaller's Grasp  →  Cacus 0
→ WIN with 5 HP remaining. Items used: 2 Herald's Draft + 1 Traveler's Salve
```

This is a near-full healing budget (2 of 3 max-stack Herald's Drafts, plus a Salve) for a single-digit-HP victory — the tightest margin of any boss fight in the GDD, appropriately so for the final encounter of the final zone. Players who arrive under-leveled or under-prepared should expect the 25% Vigor floor on defeat (Section 2) to necessitate at least one retry, consistent with Cerberus and Jörmungandr precedent. Players who arrive at Level 56+ gain access to Champion's Surge, which — while still Physical and therefore neutral against Cacus — hits hard enough to meaningfully shorten the neutral-cleanup tail on subsequent visits.

**Drop Table (first kill — guaranteed):**

| Item | Rarity | Notes |
|---|---|---|
| **Ambrosia Shard** | Rare | Full Vigor restore (100%). The capstone reward for the hardest fight in the game. |
| **Thundercrack** | Uncommon | Storm Breach Charm — forces 2× on next Storm hit vs. any enemy. Matches Cacus's own type; useful for repeat visits and revisiting earlier Storm-vulnerable enemies (Cyclops, Fenrir) at high level. |
| **Stormveil** | Common | Storm Surge Charm — boosts next Storm-typed move by 1.5×. |

**Drop Table (repeat kills — reduced):** 75% drop chance, 1–2 items, Common and Uncommon only. Pool: Stormveil, Thundercrack, Traveler's Salve, Blindveil (Wisdom Breach). Rares do not drop on repeat Cacus kills.

---

## 4. Type Coverage Arc Through Imperion

| Stage | Enemy | Type | Available SE counter | Lesson |
|---|---|---|---|---|
| Zone entry | Strix | Trickery | Storm (L6), War (L10) — both long unlocked | Pure confirmation — no discovery left, only execution |
| Zone entry | Lemures | Underworld | War (L10), Trickery (L16) — both long unlocked | Same confirmation, higher stakes; neutral play punished hardest of any wild enemy in the game |
| Mid-zone gate | Griffin | Wisdom | Sea (L36), Underworld (L30) — both unlocked before the fight | First Wisdom-type target; a genuinely long, resource-management fight rather than a knowledge test |
| Final gate | Cacus | Storm | Sea (L36) guaranteed; Wisdom (L44) if reached in time | The last echo of unlock-timing tension, compressed into the final boss; otherwise a pure execution and resource-management test |

Where Olympion built the type system and Valheon stress-tested it, Imperion's arc is a controlled descent from "still teaching" (Cacus's Wisdom-unlock tension) into "purely testing" (everything else in the zone). This is a deliberate structural bookend: the last unlock-timing beat in the entire base game occurs in the final boss of the final zone, immediately before the player enters late-game/endgame territory with full type coverage and no more surprises.

---

## 5. Zone Entry Reward

Per the milestone reward structure established in Section 4, the first time a player enters Imperion from Valheon they receive a guaranteed grant of three items. **This section deliberately deviates from the literal reading of "matched to the zone's dominant wild encounter types"** (as flagged by Section 6): Strix and Lemures are both already fully covered by long-unlocked SE options (Storm/War and War/Trickery respectively), so a Breach charm targeting either would be redundant. Instead, the reward targets the zone's **actual point of remaining tension** — the Griffin and Cacus boss fights, whose SE requirements (Sea and Wisdom) are the most recently unlocked or not-yet-unlocked tools a player entering Imperion is likely to have:

| Item | Rarity | Why this item |
|---|---|---|
| **Herald's Draft** | Uncommon | Standard healing upgrade, consistent with prior zone entry rewards. |
| **Undertow** (Sea Breach) | Uncommon | Forces any Sea-typed move to deal 2× vs. any enemy — reinforces the SE option common to both Griffin and Cacus, useful the moment Sea unlocks at Level 36 (right around zone entry) or even slightly before. |
| **Blindveil** (Wisdom Breach) | Uncommon | Forces any Wisdom-typed move to deal 2× vs. any enemy — bridges the gap for players who reach Cacus before Level 44, mirroring exactly how Shadowbind bridged the Valkyrie gap in Valheon. |

This is the same underlying design principle as Valheon's zone entry reward (Section 6) — arm the player against the zone's genuine gaps — applied correctly to a zone where the gaps are in the boss fights rather than the wild encounters.

---

## 6. Cross-Section Flags

- **Section 6 (Valheon) — Imperion zone entry reward resolved:** Section 6 flagged that Imperion's zone entry reward needed the zone's dominant wild encounter types to be finalized first. This section resolves it with a deliberate deviation: rather than matching wild encounter types (which have no gap to fill), the reward matches the zone's actual SE gaps, found in the boss fights. See Section 5 above for full rationale.
- **Section 2 (Combat) — Swift cancellation rule: CLOSED.** No enemy across any of the three launch zones (Olympion, Valheon, Imperion) uses the Swift effect. Per the conditional flagged in Sections 3, 5, and 6, this closes the question: the Swift cancellation rule is confirmed inert for the base game and can be dropped in a Section 2 revision pass, or retained only as forward-compatibility for a future zone (e.g., the Egyptian expansion) that might introduce a Swift-using enemy.
- **Section 2 (Combat) — type chart non-obvious result confirmed a third time:** Wisdom resists Sea (0.5×) was already confirmed in Section 6 (Jörmungandr). This section's Griffin (Wisdom) is itself vulnerable to Sea at 2× — the *reverse* relationship — which is consistent and expected, but worth noting for Section 12's planned type-effectiveness UI indicator: the same two types (Sea/Wisdom) produce different outcomes depending on which side of the matchup the player is on, and the UI should make attacker/defender direction unambiguous.
- **Section 4 (Battle Items) — repeat boss policy confirmed a third time:** Griffin and Cacus both drop at 75% / Common + Uncommon on repeat kills, matching the policy established in Section 5 and reaffirmed in Section 6. Rares are first-kill only across all three zones without exception. **This closes Section 4's open question ("should repeat boss encounters drop items at all") for good** — the policy has now been applied consistently across all six bosses in the base game.
- **Section 4 (Battle Items) — Surge + Breach ceiling confirmed safe:** Section 4 flagged the ×3.0 Surge+Breach damage ceiling as needing confirmation once real enemy Vigor values existed. With all three zones' rosters now locked, the highest single-hit ceiling achievable (a Divine move at ~P75 with both a Surge and Breach charm active) lands well short of one-shotting even the squishiest wild encounter (Strix, Vigor 62–166), let alone any boss. The three-turn setup cost keeps this from being exploitable in practice. No further action needed; the open question is closed.
- **Section 8 (Gear & Loot Tables):** Each Imperion enemy should appear in Section 8's gear drop table. Section 6 flagged that a Trickery-typed gear move above Power 55 would materially help players against Jörmungandr. That consideration now has two more data points: a Storm- or War-typed gear move above the level-unlock ceiling would meaningfully help against Strix (Trickery-typed, vulnerable to both), and a Sea- or Wisdom-typed gear move would do the same for both Griffin and Cacus, since Sea is the one SE type shared by every boss in this zone. Section 8 should treat the Mythic Power range (65–80) as a real lever here, not just flavor — it directly affects how forgiving Imperion's fights are.
- **Section 9 (Overworld Map):** The Griffin mid-boss gate and Cacus final boss gate require specific distance thresholds. Section 9 should cross-check those against the level curve from Section 1 to ensure a typical player hitting the Griffin gate is approximately **Level 38–45** and hitting the Cacus gate is approximately **Level 48–56** — consistent with the balance calibration above. This pushes the Imperion endgame close to the Level 60 cap by design; Section 9 should not compress the zone's distance requirement so tightly that players reach Cacus dramatically before Level 44 (Wisdom unlock), as that recreates a harder version of the intentional pre-L44 tension window described in Section 3.4, but should also not push it so far past Level 56 that Champion's Surge trivializes the neutral fallback entirely on a first attempt.
- **Section 12 (Story & Lore): FULFILLED.** Cacus's type (Storm) is a deliberate mechanical stretch from its fire-giant mythology, matching the precedent set by Harpy in Olympion. Section 12 §7.2 delivers exactly the requested framing — smoke, ash, and roaring wind throughout Cacus's intro and defeat dialogue — so the mechanical type and the narrative presentation reinforce each other. (Harpy's own reinforcement lands in Section 12 §8.1.)
- **Section 13 (UI Architecture): FULFILLED** (Section 13 §6.2). As with Section 6's flag, a type-effectiveness indicator remains relevant here — Griffin (Wisdom, vulnerable to Sea/Underworld) and Cacus (Storm, vulnerable to Sea/Wisdom) both share Sea as an SE option, and a clear on-screen indicator would help players recognize Sea's unusual value across this entire zone.

---

## 7. Open Questions

- **Cacus pre-Level-44 difficulty:** the fight is designed to be genuinely harder (Tidecaller's Grasp-only, no Sage's Verdict) for players who reach the final gate before Wisdom unlocks. This mirrors Jörmungandr's pre-Level-30 design intentionally, but stacking two "arrive-too-early" hard-mode windows across the game's two final bosses risks feeling repetitive rather than escalating. If playtesting shows this lands as "more of the same" rather than "the last test," the simplest fix is narrowing the gap — e.g., nudging the Cacus gate's expected distance threshold (Section 9) later, so most players naturally arrive at or after Level 44.
- **Lemures neutral-fight length (11 turns at Level 34, rising toward the high teens by Level 58):** this is the longest neutral fight in the game, on the high end of "clearly the wrong tool" without tipping into "technically unwinnable." Worth confirming in playtesting that a player who wanders in without Warlord's Advance or Shadowstep equipped experiences this as a strong hint rather than a wall — the fight is always fleeable (wild encounter), so there is no hard failure state, but the design intent is a firm nudge, not a punishment.
- **Griffin/Cacus Stride formulas at very high levels (60+, post-cap farming):** both bosses remain faster than a typical player through Level 60, meaning even a maxed, well-built Traverser never out-paces them through Stride investment alone. This is consistent with Fenrir's established precedent (Section 6 Open Questions flagged the same pattern) and is being treated as an accepted design choice rather than an oversight — noted here only for completeness in case a future Stride-altering mechanic is introduced.
- **Cacus's fire-flavor/Storm-type mismatch:** the narrative task is complete — Section 12 §7.2's smoke/ash/roaring-wind framing delivers it. No mechanical change is anticipated, but if early playtesters find the type assignment counterintuitive despite strong flavor text, revisiting Cacus's type (e.g., to Underworld, given the giant's cave-dwelling, death-adjacent legend) remains a low-cost fallback since no other cross-section dependency currently relies on Cacus being Storm-typed specifically.
