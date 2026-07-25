# Traverser GDD — Section 6: Enemy & Boss Roster — Valheon

## 1. Overview

This section defines the complete enemy roster for **Valheon**, the Norse mythology zone and the second zone the Traverser enters. The roster consists of **four entries** — two wild encounter types and two boss encounters — each with its own stat scaling formula, move set, and drop table.

Valheon's roster builds on what Olympion taught and immediately tests whether the player retained it, then introduces new pressure:

- **Draugr** (Underworld) opens with a direct payoff test — both War and Trickery SE options acquired in Olympion are immediately effective, rewarding players who built into type play.
- **Valkyrie** (Storm) closes that door. No level-unlock SE option exists at Valheon entry levels; only Physical damage works, and the Valkyrie hits hard and always acts first. The lesson: even deep in the type system, raw Physical competence still matters.
- **Fenrir** (War, mid-boss) reinforces type necessity at boss scale. Storm (Thunderer's Wrath, L6) is the clearly accessible SE option, but Fenrir's Stride means the player absorbs hits first every round — healing items are mandatory, not optional.
- **Jörmungandr** (Sea, final boss) is Valheon's hardest mechanical challenge. Trickery (Shadowstep, L16) is SE, but at the lowest Power in the Divine pool. Underworld (Pale Sentence, L30) opens a second SE option right at the expected encounter level, transforming the fight for players who push to that level before attempting the gate. Wisdom (Sage's Verdict, L44), counterintuitively, is **resisted** by Sea — a trap for players who assume their highest-level move is the answer.

---

## 2. Enemy Level Scaling

Enemy level equals the Traverser's current level at the time of the encounter, identical to the policy established in Section 5. All stat values are computed dynamically using the player's authenticated server level as the input variable L. The Battle XP formula `15 + (player level × 2)` applies unchanged.

---

## 3. Enemy Roster

### 3.1 Draugr — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Underworld |
| **Role** | Tanky undead warrior. High Might and Resolve make Physical damage slow; type advantage is clearly the faster path. Valheon's most common wild encounter. |
| **Effective vs.** | Sea, Wisdom (Draugr's Underworld moves deal 2× against those enemy types) |
| **Vulnerable to** | War (2×, unlocked L10), Trickery (2×, unlocked L16) |
| **Resists** | Sea attacks (0.5×), Wisdom attacks (0.5×) |

**Stat Scaling Formulas** (all values apply `floor()`):

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `8 + 2.5L` | 20 | 33 | 45 | 58 | 83 |
| Might | `8 + 0.75L` | 11 | 15 | 19 | 23 | 30 |
| Resolve | `7 + 0.6L` | 10 | 13 | 16 | 19 | 25 |
| Favor | `5 + 0.5L` | 7 | 10 | 12 | 15 | 20 |
| Aegis | `6 + 0.5L` | 8 | 11 | 13 | 16 | 21 |
| Stride | `5 + 0.5L` | 7 | 10 | 12 | 15 | 20 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Grave Swing** | — | Physical (Might vs. Resolve) | 50 | 60% |
| **Soul Drain** | Underworld | Divine (Favor vs. Aegis) | 40 | 40% |

**AI Behaviour (MVP):** Weighted random selection each turn. No conditional logic.

**Combat Design Notes:**

The Draugr is slower than most players (Stride `5 + 0.5L` vs. a balanced player's approximately `10 + 0.5L` at the same level), so the Traverser almost always acts first. Despite that advantage, neutral Physical combat is punishing: at Level 15, Iron Advance (P60) deals approximately 7 damage against Draugr's Resolve 16, taking 6–7 turns to finish a 45 HP Vigor pool — while the Draugr's Grave Swing deals roughly 8 damage per hit, KO'ing a typical player in 4–5 turns. Neutral play is not viable; the player dies before the fight ends.

With War SE (Warlord's Advance, P65 ×2): approximately 30 damage per hit at Level 15. Two hits kills the Draugr cleanly, with the player taking only a single hit back. The gap between neutral and SE is wider here than anywhere in Olympion — this is deliberate. The first wild encounter in Valheon exists to immediately confirm that Olympion's lessons about type play still apply and are now mandatory rather than optional.

Trickery SE (Shadowstep, P55 ×2) produces nearly identical results at Level 15: approximately 25 damage per hit, still a clean 2-turn kill. Both SE options are available to a player entering Valheon at Level 15+, and both are equally efficient here.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Pale Ash (Underworld Surge Charm) |

Pale Ash is thematically matched to Draugr's Underworld typing and useful for the player's own Underworld moves later. Traveler's Salve provides steady healing replenishment for a zone where wild encounters hit harder than Olympion.

---

### 3.2 Valkyrie — Wild Encounter

| Field | Value |
|---|---|
| **Type** | Storm |
| **Role** | Fast, high-Favor divine attacker. Always acts before the player. No SE option exists at Valheon entry levels, making Physical the only viable path — but the Valkyrie's low Resolve means Physical hits hard when it lands. |
| **Effective vs.** | War, Trickery (Valkyrie's Storm moves deal 2× against those enemy types) |
| **Vulnerable to** | Sea (2×, unlocked L36), Wisdom (2×, unlocked L44) |
| **Resists** | War attacks (0.5×), Trickery attacks (0.5×) |

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `6 + 2L` | 16 | 26 | 36 | 46 | 66 |
| Might | `5 + 0.3L` | 6 | 8 | 9 | 11 | 14 |
| Resolve | `5 + 0.3L` | 6 | 8 | 9 | 11 | 14 |
| Favor | `9 + 0.9L` | 13 | 18 | 22 | 27 | 36 |
| Aegis | `6 + 0.5L` | 8 | 11 | 13 | 16 | 21 |
| Stride | `11 + L` | 16 | 21 | 26 | 31 | 41 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Storm Lance** | Storm | Divine (Favor vs. Aegis) | 50 | 80% |
| **Shield Bash** | — | Physical (Might vs. Resolve) | 20 | 20% |

**AI Behaviour (MVP):** Weighted random selection each turn. Storm Lance is the dominant move.

**Combat Design Notes:**

The Valkyrie's Stride formula (`11 + L`) guarantees it acts before the Traverser at every level — there is no build or investment that outpaces it. This is intentional: the fight's pressure comes from absorbing a hit before acting, and the player must close the fight quickly or the sustained damage becomes overwhelming.

The design tension the Valkyrie creates: its Favor and Storm Lance damage are high (22 Favor at Level 15, Storm Lance P50 dealing approximately 9 damage to a balanced player per hit), but its Resolve is very low (9 at Level 15). Iron Advance (P60) at Level 15 deals approximately 13 damage per hit against that Resolve — enough to kill the Valkyrie in 3 turns. The player takes roughly 9 damage each turn from Storm Lance, putting them at approximately 1 HP at the end of round 3. A Might-invested player finishes in 2 turns and takes only a single hit back; a Favor-heavy player finishes in 3–4 turns and risks KO without a healing item.

No typed move is SE against the Valkyrie at Level 15–30: the natural SE options (Sea, Wisdom) unlock at Level 36 and 44. Players who equip Shadowbind (Trickery Breach) from the zone entry reward can force Shadowstep to deal 2× against the Valkyrie — the only way to achieve SE at Valheon entry levels, at the cost of an inventory slot. Thunderer's Wrath (Storm) and Warlord's Advance (War) are both resisted (0.5×) against a Storm-type enemy and should not be used here regardless of inventory.

The Valkyrie teaches a lesson that runs counter to Olympion's experience: sometimes the type chart offers no shortcut, and winning efficiently requires raw Physical output. A Favor-specialized player who neglected Might and Iron Advance will find the Valkyrie uncomfortable even at appropriate levels.

When Sea (Level 36) and Wisdom (Level 44) later unlock, Valkyrie encounters become trivially fast for high-level players revisiting Valheon — a satisfying demonstration of how the type chart's later unlocks pay off retroactively.

**Drop Table:**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Standard wild encounter | 35% | 1 item | Common only: Traveler's Salve, Stormveil (Storm Surge Charm) |

Stormveil is both thematically matched and tactically useful: a Storm Surge Charm boosting Thunderer's Wrath to 1.5× is relevant against any neutral or SE target elsewhere in the zone.

---

### 3.3 Fenrir — Mid-Boss

| Field | Value |
|---|---|
| **Type** | War |
| **Role** | Aggressive wolf bruiser with a Stride that races the player's. Hits consistently hard from both move types. The zone's mid-boss: a fixed encounter at the Valheon distance midpoint milestone. |
| **Encounter trigger** | Fixed — appears when the player reaches the Valheon mid-zone distance gate (defined in Section 9). Cannot be a wild encounter. |
| **Fleeable?** | No — boss encounters cannot be fled (Section 2). |
| **Vulnerable to** | Storm (2×, unlocked L6), Wisdom (2×, unlocked L44) |
| **Resists** | Trickery attacks (0.5×), Underworld attacks (0.5×) |

**Important note on Trickery:** Trickery resists War at 0.5×. Shadowstep deals half normal damage against Fenrir and should not be equipped for this fight. This is a common misread of the type chart — the hexagonal cycle moves clockwise, and War's resistances (Trickery and Underworld) are the two types immediately counter-clockwise from it.

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `22 + 4L` | 42 | 62 | 82 | 102 | 142 |
| Might | `10 + 0.8L` | 14 | 18 | 22 | 26 | 34 |
| Resolve | `8 + 0.6L` | 11 | 14 | 17 | 20 | 26 |
| Favor | `9 + 0.6L` | 12 | 15 | 18 | 21 | 27 |
| Aegis | `7 + 0.5L` | 9 | 12 | 14 | 17 | 22 |
| Stride | `8 + 0.6L` | 11 | 14 | 17 | 20 | 26 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Savage Bite** | — | Physical (Might vs. Resolve) | 40 | 50% |
| **War Howl** | War | Divine (Favor vs. Aegis) | 50 | 50% |

**AI Behaviour (MVP):** Weighted random selection each turn. Both moves deal nearly identical damage at all levels, creating consistent pressure regardless of which fires.

**Combat Design Notes:**

Fenrir's Stride (`8 + 0.6L`) closely races the player's at the expected mid-gate level range. At Level 22, Fenrir's Stride is 21 against a Favor-focused player's approximately 18 — Fenrir acts first in most encounters. Unlike the Cyclops, which was always sluggish and let the player attack freely each round, Fenrir demands immediate response: the player absorbs a hit before acting on every turn.

At Level 22, both Savage Bite and War Howl deal approximately 8 damage, consistent regardless of the Traverser's Resolve or Aegis investment. Fenrir's Vigor at Level 22 is 110. Thunderer's Wrath (Storm SE, P65 ×2) at Level 22 deals approximately 28 damage per hit — four uses exactly clearing Fenrir's HP pool (4 × 28 = 112 > 110). The math is clean: **four Storm hits defeat Fenrir, no neutral cleanup needed.** This makes the fight's demand unambiguous: bring Storm, and bring enough healing to survive while landing those four hits.

The heal requirement at Level 22: with Fenrir acting first for 8 damage per turn, the Traverser's ~32 HP is exhausted in 4 turns without healing. The correct play is to use a Herald's Draft (40% restore ≈ 12 HP) on a turn when dropping low rather than attacking, buying 1–2 more Storm turns. A Traveler's Salve (+20% ≈ 6 HP) is not sufficient by itself for the critical healing window — Fenrir's per-hit damage exceeds what a Salve restores.

**Expected fight arc at Level 22 (representative level for first Fenrir attempt):**

```
Player Vigor: 32  |  Fenrir Vigor: 110  |  Fenrir acts first each round
Storm SE (Thunderer's Wrath ×2): 28 damage per hit (4 uses)

Round 1: Fenrir 8 → Player 24  |  Player Storm 28 → Fenrir 82
Round 2: Fenrir 8 → Player 16  |  Player Storm 28 → Fenrir 54
Round 3: Fenrir 8 → Player 8   |  Player Herald's Draft (+12 → Player 20)  ← heal turn
Round 4: Fenrir 8 → Player 12  |  Player Storm 28 → Fenrir 26
Round 5: Fenrir 8 → Player 4   |  Player Salve (+6 → Player 10)            ← heal turn
Round 6: Fenrir 8 → Player 2   |  Player Storm 28 → Fenrir dead
→ WIN with 2 HP remaining. Items used: 1 Herald's Draft + 1 Traveler's Salve
```

Winning requires exactly one Herald's Draft timed at the low point in Round 3, plus a Salve in Round 5. Players who enter the fight with only Salves (no Herald's Drafts) will find Round 3 healing insufficient — the 6 HP gained won't cover the 8 damage landed in Round 4, leaving the player on 0 going into Round 5 before using the 4th Storm. Herald's Draft is the minimum item tier needed for a mid-boss in Valheon; the fight teaches this directly.

Warhex (War Breach Charm), if the player carries one, makes a Warlord's Advance hit Fenrir for forced 2× — effectively another SE option when Storm uses run out. This is the intended role for Warhex in the Valheon item economy.

**Drop Table (first kill):**

| Condition | Drop chance | Quantity | Item pool |
|---|---|---|---|
| Mid-boss (first kill) | 75% | 1–2 items | Common + Uncommon pool |

Specific drop pool: **Stormveil** (Storm Surge Charm — Common), **Battlebrand** (War Surge Charm — Common), **Ironhide Tincture** (Fortify buff — Uncommon), **Warhex** (War Breach Charm — Uncommon). The pool is weighted toward the tools that matter most for both this fight and Jörmungandr's preparation.

**Drop Table (repeat kills):** 75% chance, 1–2 items, Common and Uncommon only from the same pool above. No Rares on repeat kills per the repeat boss policy established in Section 5.

---

### 3.4 Jörmungandr — Zone Final Boss

| Field | Value |
|---|---|
| **Type** | Sea |
| **Role** | The World Serpent. Enormous Vigor, three-move pool, low Resolve. The only natural SE option at typical encounter levels is Trickery (Shadowstep, P55) — the weakest Divine skill. Unlocking Pale Sentence (Underworld, L30) opens a second SE path that transforms the fight. |
| **Encounter trigger** | Fixed — appears at the Valheon final boss gate (defined in Section 9). Requires Fenrir to be defeated first. |
| **Fleeable?** | No. |
| **Vulnerable to** | Trickery (2×, unlocked L16), Underworld (2×, unlocked L30) |
| **Resists** | Storm attacks (0.5×), Wisdom attacks (0.5×) |

**Critical type chart note — Wisdom is resisted, not effective:** Sage's Verdict (Wisdom, L44, P75) deals only 0.5× against Jörmungandr's Sea typing — **less damage than Iron Advance** at the same Favor and Might investment. Equipping Sage's Verdict for this fight is a trap. Iron Advance and Titan's Reach outperform it against Jörmungandr's low Resolve. The type chart is non-obvious here: Wisdom beats Storm and War, but Sea is one of the two types that resists Wisdom. This is one of the more counterintuitive results in the hexagon and is worth learning through experience.

**Stat Scaling Formulas:**

| Stat | Formula | L5 | L10 | L15 | L20 | L30 |
|---|---|---|---|---|---|---|
| Vigor | `18 + 4L` | 38 | 58 | 78 | 98 | 138 |
| Might | `8 + 0.6L` | 11 | 14 | 17 | 20 | 26 |
| Resolve | `5 + 0.3L` | 6 | 8 | 9 | 11 | 14 |
| Favor | `10 + 0.8L` | 14 | 18 | 22 | 26 | 34 |
| Aegis | `8 + 0.6L` | 11 | 14 | 17 | 20 | 26 |
| Stride | `5 + 0.25L` | 6 | 7 | 8 | 10 | 12 |

**Move Set:**

| Move | Type | Category | Power | AI Weight |
|---|---|---|---|---|
| **Crushing Coil** | — | Physical (Might vs. Resolve) | 55 | 30% |
| **Venom Tide** | Sea | Divine (Favor vs. Aegis) | 65 | 45% |
| **World Tremor** | — | Physical (Might vs. Resolve) | 40 | 25% |

**AI Behaviour (MVP):** Weighted random selection each turn. Venom Tide is the signature and most dangerous move at 45% weight, but the mix of three moves creates variance that makes the fight unpredictable — the player can never be certain whether the next hit will be Tide (the worst case) or Tremor (manageable).

**Combat Design Notes:**

Jörmungandr always acts second — its Stride (`5 + 0.25L`) never threatens the player's, meaning the Traverser gets a free first action every round. This is the key survivability lever: unlike Fenrir, where absorbing a hit first was mandatory, every round here starts with the player dealing damage or healing before Jörmungandr responds.

The Serpent's defining stat profile is inverted from what its scale implies: **extremely low Resolve** (`5 + 0.3L`, just 14 at Level 30) and high Vigor. This is intentional — Iron Advance and Titan's Reach deal disproportionate damage against that Resolve, making Physical moves viable cleanup tools once SE uses are exhausted. At Level 28, Iron Advance (P60) deals approximately 12 damage against Resolve 13 — comparable to a neutral typed move. Don't dismiss Physical skills in this fight.

**Damage output at Level 28:**

- Crushing Coil (P55, Might 24 vs. player Resolve ~18): approximately 9 damage
- Venom Tide (P65, Favor 32 vs. player Aegis ~18): approximately 14 damage
- World Tremor (P40, Might 24 vs. player Resolve ~18): approximately 6 damage
- Weighted average: approximately **10–11 damage per turn**

Player Vigor at Level 28 (Favor-focused build): approximately 36. Without healing, the Traverser survives 3–4 turns. The fight lasts significantly longer than that, which makes Venom Tide the primary threat — a Tide landing after the player is already low can KO them before they can act.

**The Pale Sentence inflection point:**

At Level 28 with only Shadowstep as SE: 5 uses × approximately 21 damage = 105 SE damage. Jörmungandr has 130 HP at Level 28. The remaining 25 HP requires neutral moves to clean up, extending the fight. With Jörmungandr dealing 10–11 per turn and player Vigor at 36, the sustained damage across 9–11 total turns exceeds what available healing items can fully absorb. First-attempt wins at Level 25–28 relying solely on Trickery are uncommon — multiple attempts with adapted item timing are expected.

At Level 30, Pale Sentence (Underworld, P75) unlocks. Underworld is **super-effective against Sea (2×)**. At Level 30:
- 3 Pale Sentence hits × approximately 28 SE damage = 84 damage
- 5 Shadowstep hits × approximately 20 SE damage = 100 damage
- Combined SE pool: **184 damage against a 138 HP target**, ending the fight in 8 SE attacks with substantial healing budget between them

Pale Sentence at Level 30 is the designed solution. The expected Valheon final-gate level is 28–32, putting most players within striking distance of this unlock when they first face the Serpent. Players who persist through the Trickery-only window will succeed; players who push to Level 30 first will find the fight far more tractable.

**Expected fight arc at Level 28 (Trickery-only, representative first attempt):**

```
Player Vigor: 36  |  Jörmungandr Vigor: 130  |  Player acts first each round
Shadowstep SE (×2 Trickery): ~21 damage per hit (5 uses)
Venom Tide: ~14 damage  |  Crushing Coil: ~9 damage  |  World Tremor: ~6 damage
Avg incoming: ~10–11 per turn

Round 1: Player Shadowstep 21 → J 109  |  J Venom Tide 14 → Player 22
Round 2: Player Shadowstep 21 → J 88   |  J Crushing Coil 9 → Player 13     ← danger
Round 3: Player Herald's Draft (+14 → 27)  |  J World Tremor 6 → Player 21   ← heal
Round 4: Player Shadowstep 21 → J 67   |  J Venom Tide 14 → Player 7         ← critical
Round 5: Player Herald's Draft (+14 → 21)  |  J Crushing Coil 9 → Player 12  ← heal
Round 6: Player Shadowstep 21 → J 46   |  J Venom Tide 14 → Player -2
→ Player KO'd Round 6 despite 2 Herald's Drafts used
```

The arc shows the characteristic failure mode: back-to-back Venom Tide hits overtake the player's ability to heal. The 25% Vigor floor on defeat enables an immediate retry. A second attempt armed with the Tide timing knowledge — healing preemptively before the turn the player expects Tide rather than reactively — buys the extra actions needed to finish the fight.

**Notes on winning the Trickery-only fight:** The clearest path to success before Level 30 is carrying the maximum Herald's Draft stack (3), supplemented by Ironhide Tincture (Fortify, halving a Tide hit) and Sunder Oil (Weaken, halving Jörmungandr's next outgoing attack). Players who time item use around Venom Tide's 45% weight — acting to mitigate or recover from it rather than ignoring it — can survive the full 9-turn fight. It requires near-optimal play and a full item inventory. Most players will see 2–3 attempts.

**Drop Table (first kill — guaranteed):**

| Item | Rarity | Notes |
|---|---|---|
| **Ambrosia Shard** | Rare | Full Vigor restore (100%). The headline reward for defeating the World Serpent. |
| **Shadowbind** | Uncommon | Trickery Breach Charm — forces 2× on next Trickery hit vs. any enemy. Useful for Jörmungandr revisits and Trickery-resistant enemies in Imperion. |
| **Brinestone** | Common | Sea Surge Charm — boosts next Sea-typed move by 1.5×. Useful for Jörmungandr revisits with Tidecaller's Grasp (L36) or gear-granted Sea moves. |

The Ambrosia Shard is always included on the first kill. The remaining 1–2 items draw from the pool above.

**Drop Table (repeat kills — reduced):** 75% drop chance, 1–2 items, Common and Uncommon only. Pool: Brinestone, Shadowbind, Undertow (Sea Breach Charm), Traveler's Salve. Rares do not drop on repeat Jörmungandr kills.

---

## 4. Type Coverage Arc Through Valheon

The four enemies form a deliberate learning sequence that builds on Olympion while introducing new complexity:

| Stage | Enemy | Type | Available SE counter | Lesson |
|---|---|---|---|---|
| Zone entry | Draugr | Underworld | War (L10), Trickery (L16) — both available | Olympion's type investment pays immediately; neutral Physical is too slow |
| Mid-zone | Valkyrie | Storm | None until L36 (Sea) or L44 (Wisdom) | The type chart doesn't always help; Physical competence is not optional |
| Mid-zone gate | Fenrir | War | Storm (L6), Wisdom (L44) — note: Trickery resists War | Storm is the clear choice (universally available); Herald's Draft is now the required item tier |
| Final gate | Jörmungandr | Sea | Trickery (L16), Underworld (L30) — Wisdom resists Sea | Trickery is the early SE path; Pale Sentence (L30) is the designed unlock; Sage's Verdict is a trap |

Two specific non-obvious type chart results that Valheon teaches through play: Trickery is resisted by Fenrir (War), and Wisdom is resisted by Jörmungandr (Sea). Both are counterintuitive for players who may have assumed their most recently unlocked move would be strongest. Working through the hexagon manually — rather than assuming higher-level moves are always better — is the deeper skill Valheon rewards.

---

## 5. Zone Entry Reward

Per the milestone reward structure established in Section 4, the first time a player enters Valheon from Olympion they receive a guaranteed grant of three items. These are chosen to arm the player against Valheon's two wild encounter types immediately:

| Item | Rarity | Why this item |
|---|---|---|
| **Herald's Draft** | Uncommon | Upgraded healing for a zone where Salves are insufficient for sustained pressure |
| **Thundercrack** (Storm Breach) | Uncommon | Forces any Storm-typed move to deal 2× vs. any enemy — including Draugr (Storm normally hits Underworld for 1×, Thundercrack makes it 2×) |
| **Shadowbind** (Trickery Breach) | Uncommon | Forces any Trickery-typed move to deal 2× vs. any enemy — the only way to achieve SE against Valkyrie at Valheon entry levels, where natural SE doesn't exist |

The Shadowbind is particularly significant: it gives Favor-focused players a one-use SE option against the Valkyrie (Shadowstep + Shadowbind = forced 2× against Storm, which normally resists Trickery at 0.5×), bridging the gap until Sea or Wisdom unlock at Level 36 and 44.

The **zone entry reward for first entering Imperion from Valheon** followed the same underlying principle — arm the player against the zone's genuine remaining gaps — but not the identical literal structure. Section 7 found Imperion's two wild encounters were already fully covered by long-unlocked SE options, so its reward (Herald's Draft + Undertow, Sea Breach + Blindveil, Wisdom Breach) targets the Griffin and Cacus boss fights instead. See Section 7 for the full reward and rationale.

---

## 6. Cross-Section Flags

- **Section 5 (Olympion) — zone entry reward finalized:** Section 5 flagged that Section 6 must specify which Breach Charms are most useful for Valheon's enemy types. This is now resolved: Thundercrack (Storm Breach) and Shadowbind (Trickery Breach). These are the items delivered when the player first enters Valheon.
- **Section 2 (Combat) — Swift cancellation rule: RESOLVED.** Section 7 (Imperion) confirmed no enemy across any of the three launch zones uses Swift. The Swift cancellation rule in Section 2 is inert for the base game and can be dropped in a revision pass.
- **Section 2 (Combat) — type chart non-obvious results confirmed:** Two counterintuitive matchups verified via Python against the Section 2 chart: (1) Trickery attacks War at 0.5× — confirmed resisted. (2) Wisdom attacks Sea at 0.5× — confirmed resisted. Sage's Verdict at Level 44 deals less damage against Jörmungandr than Iron Advance. Both results should inform Section 10 (Onboarding) and Section 13 (UI Architecture): a type matchup indicator on the battle screen is worth including to surface these non-obvious results without requiring players to memorize the full hexagon.
- **Section 3 (Move Design) — Pale Sentence is the Jörmungandr unlock:** Pale Sentence (Underworld, P75, 3 uses, L30) is confirmed as the second SE move against Jörmungandr. Section 3's design note that Pale Sentence "arrives at Level 30, when the player's Favor investment is high enough to make 75 Power feel appropriately powerful" is borne out here — the math confirms Pale Sentence at Level 30 shifts the Jörmungandr fight from near-impossible to manageable. This validates the Level 30 placement.
- **Section 4 (Battle Items) — repeat boss policy confirmed:** Fenrir and Jörmungandr both drop at 75% / Common + Uncommon on repeat kills, matching the policy established in Section 5. Rares are first-kill only.
- **Section 7 (Imperion Roster): RESOLVED, with a deliberate deviation.** Section 7 supplied the Imperion enemy type roster (Strix/Trickery, Lemures/Underworld, Griffin/Wisdom, Cacus/Storm) but found that Strix and Lemures — unlike Valheon's Draugr and Valkyrie — were both already fully covered by SE options unlocked well before Imperion, leaving no genuine wild-encounter gap to arm against. Section 7's zone entry reward (Undertow, Sea Breach + Blindveil, Wisdom Breach) instead targets the real remaining tension points: the Griffin and Cacus boss fights. This is the same underlying principle applied correctly to a different situation, not a departure from it.
- **Section 8 (Gear & Loot Tables):** Each Valheon enemy should appear in Section 8's gear drop table — gear drops and item drops resolve independently from the same encounter. Section 8 needs to assign gear drop chances and tier pools for Draugr, Valkyrie, Fenrir, and Jörmungandr. A Trickery-typed gear move at Power above 55 (Shadowstep's base) would directly help players against Jörmungandr; Section 8 should consider this when assigning gear-granted move types for Valheon gear.
- **Section 9 (Overworld Map):** The Fenrir mid-boss gate and Jörmungandr final boss gate require specific distance thresholds. Section 9 should cross-check those against the level curve from Section 1 to ensure a typical player hitting the Fenrir gate is approximately Level 16–22 and hitting the Jörmungandr gate is approximately Level 25–32 — consistent with the balance calibration above. The Pale Sentence unlock at Level 30 is the key inflection point; the Jörmungandr gate distance should not push players to the gate significantly before Level 28.
- **Section 13 (UI Architecture): FULFILLED.** A visible type-effectiveness indicator is delivered in Section 13 §6.2 — pre-selection chevrons (gated to an enemy's second encounter onward) plus post-hit "Super Effective!" / "Resisted…" callouts, with attacker/defender direction always disambiguated.

---

## 7. Open Questions

- **Jörmungandr difficulty before Level 30:** The fight at Level 25–28 with Trickery as the sole SE option is intentionally hard — but the margin of survival with a full healing stack is thin enough that it may feel punishing rather than challenging. If playtesting reveals players abandon Valheon rather than retry Jörmungandr, the first adjustment should be reducing Venom Tide's Power from 65 to 60, not altering the Vigor pool or adding new SE options.
- **Valkyrie Stride at high levels:** At Level 40, Valkyrie Stride = 51, making it comprehensively faster than any realistic player build (capped Stride investment would reach approximately 50–55). A returning Level 40+ player with Sea or Wisdom SE can end the fight in 2 turns before taking meaningful damage. This is acceptable — returning to Zone 2 at high level should feel easy — but worth noting if the game ever introduces Stride-reducing mechanics.
- **Fenrir Stride tie at low levels:** At Level 18, Fenrir Stride = 18.8 (floored to 18) and a Stride-focused player could match or exceed it. The fight arc above assumes Fenrir acts first, which is typical for a Favor-focused build. A Stride-heavy build that consistently outpaces Fenrir has a meaningfully easier fight — the player never absorbs a hit before their first attack. This is a valid build reward rather than a balance problem, but worth flagging for playtesting.
- **Gear-granted Trickery moves (Section 8 dependency):** ~~The Jörmungandr fight's difficulty curve is partially a function of whether Trickery-typed gear grants exist at higher Power than Shadowstep's P55... Section 8 should make this decision deliberately.~~ **CLOSED — decided deliberately in Section 8 §4.2.** A P80 Trickery move exists (Gatekeeper's Ruse, Cerberus's Mythic Trinket) but comes only from fully clearing the *previous* zone — earned relief for thorough players, while Jörmungandr's first-attempt difficulty stays intact for anyone beelining the gates. Nothing droppable within Valheon itself softens the fight.
