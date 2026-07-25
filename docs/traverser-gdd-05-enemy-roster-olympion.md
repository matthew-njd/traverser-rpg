# Traverser GDD — Section 5: Enemy & Boss Roster — Olympion

## 1. Overview

This section defines the complete enemy roster for **Olympion**, the Greek mythology zone and the first zone the Traverser enters. The roster consists of **four entries** — two wild encounter types and two boss encounters — each with its own sprite, stat scaling formula, move set, and drop table.

Olympion's enemies are deliberately chosen to introduce the game's core combat concepts in sequence:
- **Harpy** (Storm) teaches Physical combat — no early Super Effective option forces the player to rely on Iron Advance and learn the damage flow.
- **Satyr** (Trickery) teaches type exploitation — Storm (unlocked at Level 6) and War (Level 10) both hit for 2×, giving players an immediate, satisfying payoff for using typed moves.
- **Cyclops** (War, mid-boss) reinforces type necessity — the boss's Vigor pool makes neutral Physical combat unfeasible without items; Storm advantage is the intended path.
- **Cerberus** (Underworld, final boss) demands preparation — both War and Trickery hit for 2×, and the fight requires active item use regardless of type play.

---

## 2. Enemy Level Scaling

**Enemy level equals the Traverser's current level at the time of the encounter.** All enemy stats are computed dynamically from the formulas in Section 3 using the player's current level as the input variable L. There are no fixed-level enemies in Olympion; a Level 8 player fights Level 8 versions of every creature, and a Level 25 player returning to the zone fights Level 25 versions.

This keeps encounters relevant at any point in the game and ensures Battle XP (`15 + player level × 2`) stays proportional to progression rather than tapering to irrelevance as the player outlevels a zone.

**Enemy "level" for Battle XP purposes:** the formula uses the Traverser's current level directly, since that is always the encounter level. At Level 10, defeating any Olympion enemy awards `15 + 10 × 2 = 35 XP`. At Level 20, `15 + 20 × 2 = 55 XP`. This represents approximately 6–14% of a typical daily XP budget depending on level — small enough to keep real-world activity as the dominant driver, meaningful enough to make winning feel rewarding.

**Implementation note:** the server computes enemy stats at encounter-start using the player's authenticated level. Player level is the only server-authoritative input. No cached or client-supplied enemy stats are accepted.

---

## 3. Enemy Roster

### 3.1 Harpy — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Storm |
| **Role** | Fast, fragile Divine attacker. Olympion's most common encounter type. |
| **Effective vs.** | War, Trickery (Harpy's Storm moves deal 2× against those enemy types) |
| **Vulnerable to** | Sea (2×, unlocked L36), Wisdom (2×, unlocked L44) |
| **Resisted by** | Trickery attacks (0.5× vs. Harpy), War attacks (0.5× vs. Harpy) |

**Stat Scaling Formulas** (all values apply `floor()`):

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `8 + 3L` | 23 | 38 | 53 | 68 | 98 |
| Might | `5 + 0.25L` | 6 | 7 | 8 | 10 | 12 |
| Resolve | `5 + 0.25L` | 6 | 7 | 8 | 10 | 12 |
| Favor | `7 + 0.75L` | 10 | 14 | 18 | 22 | 29 |
| Aegis | `5 + 0.5L` | 7 | 10 | 12 | 15 | 20 |
| Stride | `10 + L` | 15 | 20 | 25 | 30 | 40 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Gust Strike** | Storm | Divine (Favor vs. Aegis) | 40 | 70% |
| **Buffet** | — | Physical (Might vs. Resolve) | 25 | 30% |

Enemy Divine moves do not apply a TypeMultiplier against the Traverser (the player has no type). Both moves resolve against the player's Aegis (Divine) or Resolve (Physical) at ×1.0.

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

The Harpy acts first in every encounter — its Stride formula ensures it always exceeds a balanced player's Stride at all levels (Harpy Stride = `10 + L` vs. a balanced player's approximately `10 + 0.3L`). Despite acting first, Harpy damage output is low (~3–5 HP per turn vs. a player pool of 23–40), so the player always survives the encounter comfortably. This is intentional: the first enemy the Traverser regularly fights should feel threatening without being dangerous, teaching the combat loop rather than punishing inexperience.

The player has no Super Effective options against Harpy until Sea unlocks at Level 36 and Wisdom at Level 44 — well past Olympion's intended level range. Iron Advance (Physical, P60) is the correct answer. Against a Level 10 Harpy with Iron Advance: 2–3 turns to KO. Against a Level 15 Harpy: 3 turns. Fast, satisfying encounters that reward skill use over Basic Attack.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Stormveil |

---

### 3.2 Satyr — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Trickery |
| **Role** | Cunning, balanced attacker. Olympion's second wild encounter type. Introduced slightly later in the zone than Harpy. |
| **Effective vs.** | Underworld, Sea (Satyr's Trickery moves deal 2× against those enemy types) |
| **Vulnerable to** | Storm (2×, unlocked L6), War (2×, unlocked L10) |
| **Resists** | Underworld attacks (0.5×), Sea attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `8 + 2.5L` | 20 | 33 | 45 | 58 | 83 |
| Might | `6 + 0.5L` | 8 | 11 | 13 | 16 | 21 |
| Resolve | `6 + 0.5L` | 8 | 11 | 13 | 16 | 21 |
| Favor | `7 + 0.75L` | 10 | 14 | 18 | 22 | 29 |
| Aegis | `6 + 0.5L` | 8 | 11 | 13 | 16 | 21 |
| Stride | `8 + 0.75L` | 11 | 15 | 19 | 23 | 30 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Shadow Lunge** | Trickery | Divine (Favor vs. Aegis) | 45 | 60% |
| **Quick Jab** | — | Physical (Might vs. Resolve) | 30 | 40% |

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

The Satyr acts first at most levels (Stride slightly above player average), but unlike the Harpy its damage output is marginally higher. The key design purpose is introducing the type system's payoff.

Against a Level 10 Satyr using Thunderer's Wrath (Storm, P65, ×2): the fight resolves in 2 turns instead of 3, and the player takes one fewer hit — a 33% reduction in damage sustained just from correct type choice. This is the moment the type chart clicks. The reward is immediate and tangible at Level 6 (first typed move unlock), which is exactly when Satyrs start appearing as the player moves deeper into Olympion.

Neutral combat (Iron Advance only): 3–5 turns. SE combat (Storm or War): 2–4 turns. Player survives comfortably in both cases at the appropriate levels.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Shadowblur, Battlebrand |

Satyr drops Shadowblur (Trickery Surge Charm) and Battlebrand (War Surge Charm) as thematically matched common charms — Shadowblur fits the Trickery identity, Battlebrand is what beats it.

---

### 3.3 Cyclops — Mid-Boss

| Field | Value |
|---|---|
| **Type** | War |
| **Role** | Slow, high-Vigor physical bruiser. The zone's mid-boss: a fixed encounter at the Olympion distance midpoint milestone, not a repeating wild encounter. |
| **Encounter trigger** | Fixed — appears when the player reaches the Olympion mid-zone distance gate (defined in Section 9). Cannot be a wild encounter. |
| **Fleeable?** | No — boss encounters cannot be fled (Section 2). |
| **Vulnerable to** | Storm (2×, unlocked L6), Wisdom (2×, unlocked L44) |
| **Resists** | Trickery attacks (0.5×), Underworld attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `15 + 4.5L` | 37 | 60 | 82 | 105 | 150 |
| Might | `10 + L` | 15 | 20 | 25 | 30 | 40 |
| Resolve | `8 + 0.75L` | 11 | 15 | 19 | 23 | 30 |
| Favor | `7 + 0.5L` | 9 | 12 | 14 | 17 | 22 |
| Aegis | `7 + 0.5L` | 9 | 12 | 14 | 17 | 22 |
| Stride | `5 + 0.25L` | 6 | 7 | 8 | 10 | 12 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Boulder Hurl** | — | Physical (Might vs. Resolve) | 40 | 60% |
| **War Shout** | War | Divine (Favor vs. Aegis) | 55 | 40% |

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

The Cyclops is a deliberate wall. Its Stride (`5 + 0.25L`) is the lowest in the zone — the player acts first every round. Despite that advantage, neutral combat with Iron Advance is not viable: it takes 7–11 player attacks to KO a Level 10–15 Cyclops, while the Cyclops kills the player in 4–5 hits. The player runs out of HP long before the Cyclops does without type advantage.

With Thunderer's Wrath (Storm, P65, ×2): the fight resolves in 3–5 turns at Level 10–15, which the player can survive — just barely. At Level 10, a player using Storm SE across all 4 of Thunderer's Wrath's uses plus a finishing Iron Advance or Basic Attack will defeat the Cyclops with 1–3 HP remaining, assuming no healing. Carrying a Traveler's Salve or Ironhide Tincture is strongly advisable.

This is the correct mid-boss experience: the Cyclops teaches that preparation matters, that the type chart isn't optional for bosses, and that items are a real resource to manage.

Boulder Hurl's physical damage (`floor((40 × Might) / (player Resolve × 8))`) averages ~6–8 damage per turn at Levels 6–15. War Shout's Divine damage averages ~5–7. The Cyclops does roughly equal damage regardless of which move it rolls — there's no one move to fear specifically, only the cumulative pressure of a sustained fight.

**Drop Table (first kill):**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Mid-boss (first kill) | 75% | 1–2 items | Common + Uncommon pool |

Specific drop pool: **Stormveil** (Storm Surge Charm — Common), **Battlebrand** (War Surge Charm — Common), **Warhex** (War Breach Charm — Uncommon), **Ironhide Tincture** (Uncommon). Thematic logic: dropping Storm and War items from a War-type boss reinforces that these are the relevant types for this encounter, nudging players toward the right tools for Olympion and early Valheon.

**Drop Table (repeat kills):** per the repeat boss policy established in this section (see Section 5 below), 75% chance, 1–2 items, Common and Uncommon only from the same pool above.

---

### 3.4 Cerberus — Zone Final Boss

| Field | Value |
|---|---|
| **Type** | Underworld |
| **Role** | High-Vigor multi-move guardian. Olympion's final boss — the gate encounter required to unlock Valheon (alongside the cumulative distance threshold). |
| **Encounter trigger** | Fixed — appears at the Olympion final boss gate (defined in Section 9). Requires Cyclops to be defeated first. |
| **Fleeable?** | No. |
| **Vulnerable to** | War (2×, unlocked L10), Trickery (2×, unlocked L16) |
| **Resists** | Wisdom attacks (0.5×), Sea attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `20 + 5.5L` | 47 | 75 | 102 | 130 | 185 |
| Might | `9 + 0.75L` | 12 | 16 | 20 | 24 | 31 |
| Resolve | `7 + 0.5L` | 9 | 12 | 14 | 17 | 22 |
| Favor | `8 + 0.75L` | 11 | 15 | 19 | 23 | 30 |
| Aegis | `8 + 0.5L` | 10 | 13 | 15 | 18 | 23 |
| Stride | `5 + 0.25L` | 6 | 7 | 8 | 10 | 12 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Three-Fanged Strike** | — | Physical (Might vs. Resolve) | 50 | 35% |
| **Death Breath** | Underworld | Divine (Favor vs. Aegis) | 60 | 45% |
| **Savage Bite** | — | Physical (Might vs. Resolve) | 40 | 20% |

**AI Behaviour (MVP):** Weighted random selection each turn. The three-move pool gives Cerberus meaningful variance without requiring conditional logic — the player never quite knows which threat is coming. Death Breath (highest weight) is the signature attack.

**Combat Design Notes:**

Cerberus is a genuine boss encounter. Unlike the Cyclops — which is hard because of its HP pool — Cerberus is hard because it deals meaningful damage across a multi-move set while maintaining a high Vigor pool. Key numbers at Level 10 (the earliest a player might plausibly reach the final gate):

- Cerberus Vigor: 75
- Average Cerberus damage per turn: ~7–9 (mix of Three-Fanged Strike, Death Breath, Savage Bite)
- Player Vigor (balanced build): ~26
- Player survives approximately 3–4 Cerberus hits without healing

With Warlord's Advance (War SE, P65, ×2, available L10): the player deals ~17 damage per SE hit. Defeating a Level 10 Cerberus requires 5 War SE hits. With only 3–4 survivable hits before KO, the player cannot win without using at least one healing item mid-fight. This is intentional — the final boss of the first zone should require the Traverser to actually use the item systems introduced in Section 4.

Tactical notes:
- **War (L10, P65)** is the strongest SE option and should be the primary damage tool.
- **Trickery (L16, Shadowstep P55)** is also SE, but weaker (P55 vs. P65) and unavailable until Level 16 — it's a secondary option for higher-level players, not the intended primary.
- **Physical (Iron Advance P60)** deals neutral damage and makes the fight approximately 7 turns minimum — feasible only at higher levels with substantial Might investment and strong healing.
- The player acts first every round (Cerberus Stride ≈ 7–10 vs. player ~11–16), which means every turn the player can set up damage before absorbing the counter. Timing a Traveler's Salve on a turn when the player drops low (rather than using it preemptively) is the correct play.

**Expected fight arc at Level 12 (representative level for first Cerberus attempt):**

```
Player Vigor: ~27  |  Cerberus Vigor: ~86  |  Player acts first each round

Round 1:  Player — Warlord's Advance (×2)  →  Cerberus takes ~17 dmg  [86 → 69]
           Cerberus — Death Breath          →  Player takes ~8 dmg     [27 → 19]
Round 2:  Player — Warlord's Advance        →  Cerberus [69 → 52]
           Cerberus — Three-Fanged Strike   →  Player [19 → 10]
Round 3:  Player — Traveler's Salve         →  Player restored ~5 HP   [10 → 15]
           Cerberus — Death Breath          →  Player [15 → 7]
Round 4:  Player — Warlord's Advance        →  Cerberus [52 → 35]
           Cerberus — Savage Bite           →  Player [7 → 1]  ← critical
Round 5:  Player — Warlord's Advance        →  Cerberus [35 → 18]
           Cerberus — (if player still up)  →  Fight over: player KO'd or barely standing
...
```

The fight is tight. Players who bring Herald's Draft instead of Salves, or who use Sunder Oil to halve a high-damage round, will have significantly more breathing room. Winning on a first attempt at Level 10–12 is intentionally difficult — the 25% Vigor floor on defeat (Section 2) enables immediate retries, and second or third attempts with adapted strategy should succeed.

**Drop Table (first kill — guaranteed):**

| Item | Rarity | Notes |
|---|---|---|
| **Fleet Omen** | Rare | Swift buff item — acts first next round. Useful vs. faster Valheon enemies. |
| **Gravemark** | Uncommon | Underworld Breach Charm — forces 2× on an Underworld enemy's next hit received. Useful for revisiting Cerberus or Underworld-type enemies in later zones. |
| **Pale Ash** | Common | Underworld Surge Charm — boosts next Underworld-type move. |

The Fleet Omen (Rare) is the headline reward and is always included in the first-kill drop. The zone unlock reward (Herald's Draft + zone-appropriate Breach Charms) is delivered separately when the player first enters Valheon — see Section 6.

**Drop Table (repeat kills — reduced):**

Per the repeat boss policy established in this section: 75% drop chance, 1–2 items, Common and Uncommon only. Rares do not drop on repeat Cerberus kills. Pool: Pale Ash, Gravemark, Traveler's Salve, Warhex, Shadowblur.

---

## 4. Type Coverage Arc Through Olympion

The four enemies together form a deliberate learning sequence:

| Stage | Enemy | Type | Best SE counter | Lesson |
|---|---|---|---|---|
| Wild encounters begin | Harpy | Storm | None available (Sea L36, Wisdom L44) | Physical combat; Iron Advance is the answer |
| Level 6 | Satyr encountered | Trickery | Thunderer's Wrath ×2 (Storm, L6) | Type system payoff — first clear "this move matters" moment |
| Level 10 | Satyr + Warlord's unlock | Trickery | Warlord's Advance ×2 (War, L10) also works | Second SE option; loadout decision emerges |
| Mid-zone gate | Cyclops | War | Thunderer's Wrath ×2 (Storm, L6) | Boss forces type prep; neutral is not viable |
| Final gate | Cerberus | Underworld | Warlord's Advance ×2 (War, L10) | Items are necessary; wins require strategy, not just type knowledge |

A player who reaches Cerberus without ever equipping Thunderer's Wrath or Warlord's Advance will almost certainly lose. A player who reads the type system through the Satyr encounters and prepares accordingly will win with effort. This is the intended experience.

---

## 5. Repeat Boss Policy (resolved here)

**Decision:** Both Cyclops and Cerberus can be re-fought after their initial defeat. Repeat kills use the following rules:

- **Drop chance:** 75% (mini-boss rate per Section 4)
- **Item quantity:** 1–2 items
- **Item tier:** Common and Uncommon only — no Rares on repeat kills
- **Drop pool:** same as the boss's standard drop pool (excluding the first-kill exclusive Rare)

This closes the open question flagged in Section 4. The rationale: repeat boss encounters should feel like a meaningful use of Vigor and items, and should reward the player proportionally to that cost. Gating Rares to first kills preserves their significance as progression milestones while still making revisits worthwhile for Common/Uncommon farming.

---

## 6. Cross-Section Flags

- **Section 2 (Combat) — enemy level definition resolved:** enemy level = Traverser's current level at encounter time. The Battle XP formula `15 + (enemy level × 2)` should be read as `15 + (player level × 2)`, since the two are always equal. This closes the open question flagged in Sections 1 and 2.
- **Section 4 (Battle Items) — repeat boss policy resolved:** Cyclops and Cerberus both drop at 75%/Common+Uncommon on repeat kills. Rares are first-kill only. Closes the open question flagged in Section 4.
- **Section 4 (Battle Items) — Cerberus first-kill drops assigned:** Fleet Omen (Rare), Gravemark (Uncommon), Pale Ash (Common). Section 4's boss drop structure (`100%, 2–3 items, ≥1 Rare on first kill`) is satisfied.
- **Section 6 (Valheon Roster): FULFILLED.** Section 6 specified Thundercrack (Storm Breach) and Shadowbind (Trickery Breach) as the zone unlock reward — matched to Draugr and Valkyrie, Valheon's two wild encounter types.
- **Section 8 (Gear & Loot Tables):** each Olympion enemy should appear in Section 8's gear drop table — gear drops and item drops resolve independently per the same encounter result. Section 8 needs to assign gear drop chances and tier pools for Harpy, Satyr, Cyclops, and Cerberus encounters.
- **Section 9 (Overworld Map):** the Cyclops mid-boss gate and Cerberus final boss gate require specific distance thresholds to be defined. Section 9 should cross-check those thresholds against the level curve from Section 1 to ensure a typical player hitting the Cyclops gate is approximately Level 8–12 and hitting the Cerberus gate is approximately Level 12–18 — consistent with the balance calibration above.
- **Section 2 (Combat) — Swift cancellation rule: RESOLVED across all three zones.** Olympion enemies have no Swift move (confirmed here). Valheon and Imperion were subsequently confirmed the same in Sections 6 and 7 — no enemy or boss in the base game grants Swift. The Swift cancellation rule (Section 3, Section 4.3) is inert for the base game and can be dropped in a future Section 2 revision.
- **Section 13 (UI Architecture): FULFILLED.** The battle screen shows **no enemy level indicator** — enemy level always equals player level, so surfacing it would be redundant noise. The enemy panel displays sprite, name, type icon, and a percentage-based Vigor bar only (Section 13 §6.1).

---

## 7. Open Questions

- **Cyclops Resolve high end:** at Level 30+, a returning player's Iron Advance neutral damage against Cyclops (Resolve = 30) drops to ~8 HP per hit against a 150-HP Vigor pool — effectively 19 turns. This is by design (use Storm; Iron Advance isn't supposed to be viable neutral vs. bosses), but the numbers are stark. If playtesting reveals that players routinely forget to bring Storm moves and find boss revisits frustrating rather than challenging, Cyclops Resolve growth (`0.75L`) could be reduced to `0.5L` without changing early-game balance.
- **Cerberus Death Breath power at high levels:** at Level 30, Death Breath (P60) from Cerberus Favor 30 against player Aegis ~21 deals `floor((60 × 30) / (21 × 8)) = 10` — modest. By Level 40, it's `floor((60 × 38) / (24 × 8)) = 11`. Cerberus damage output scales slowly at high levels due to the formula ceiling effect. This is acceptable for a revisited zone boss but may make repeat Cerberus fights feel too easy for high-level returners. If so, a simple fix is increasing Death Breath to P70 in a post-launch patch — flagged for playtesting.
- **Harpy Stride at high levels:** at Level 40, Harpy Stride = 50. A player who invests Stride heavily (10 + 1.2×39 = ~57) would still act first. A player who ignores Stride (10 + 0.1×39 = ~14) faces a wildly faster Harpy. Stride investment being so binary against Harpy is a minor design asymmetry — not a problem for MVP, but worth watching if Stride-building becomes a popular build path.
