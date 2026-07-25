# Traverser — Test Fixtures (Verified Expected Values)

Machine-verified expected values compiled from the locked GDD, for use as unit/integration test cases during implementation. Every table here was generated programmatically from the GDD's own formulas during the full-GDD audit — if code output disagrees with a value below, the code is wrong.

**Usage:** T5's battle-engine test suite and T1's progression logic should assert against these directly. Claude Code sessions: treat this file as the canonical test oracle; do not re-derive expected values from the GDD prose.


## 1. Type Effectiveness Matrix (Section 2)

Cycle: Storm → War → Trickery → Underworld → Sea → Wisdom → Storm. Each type deals 2× to the next two clockwise, 0.5× to the previous two (counter-clockwise), 1× to its opposite and itself. Rows = attacker, columns = defender.

| Attacker \ Defender | Storm | War | Trickery | Underworld | Sea | Wisdom |
|---|---|---|---|---|---|---|
| **Storm** | 1.0 | 2.0 | 2.0 | 1.0 | 0.5 | 0.5 |
| **War** | 0.5 | 1.0 | 2.0 | 2.0 | 1.0 | 0.5 |
| **Trickery** | 0.5 | 0.5 | 1.0 | 2.0 | 2.0 | 1.0 |
| **Underworld** | 1.0 | 0.5 | 0.5 | 1.0 | 2.0 | 2.0 |
| **Sea** | 2.0 | 1.0 | 0.5 | 0.5 | 1.0 | 2.0 |
| **Wisdom** | 2.0 | 2.0 | 1.0 | 0.5 | 0.5 | 1.0 |

Player-side only: enemy Divine moves NEVER apply a TypeMultiplier against the Traverser (the player has no type). Physical moves never apply a TypeMultiplier in either direction.

## 2. Damage Formula Worked Examples (Section 2)

`Damage = floor(((Power × AttackStat) / (DefenseStat × 8)) × TypeMult × CritMult × RandomFactor)` — crit chance 6.25%, crit ×1.5, random 0.90–1.10.

| Case | Inputs | Expected |
|---|---|---|
| Basic Attack, L1 baseline | P40, Atk 10, Def 10, ×1.0 type, no crit, roll 1.0 | floor(400/80) = **5** |
| Basic Attack, mid-game | P40, Atk 25, Def 20, ×1.0, no crit, roll 1.0 | floor(1000/160) = **6** |
| Typed skill, SE | P65, Atk 30, Def 18, ×2.0, no crit, roll 1.0 | floor(13 × 2.0) = **26** (base 13; ~23–29 with variance; ~39 on crit) |
| Floor check | Any computed value < 1 after floor | Minimum damage handling per Section 2 (floor result; verify ≥ intended minimum in engine) |

## 3. Tutorial Battle Script (Section 10 §6.3) — fully deterministic

Random factor and crit roll are BYPASSED in this battle only (both fixed to 1.0 / no-crit). Player: L1, Vigor 20/20, Might 10 (+1 Traveler's Blade = 11), Aegis 10. Waystone Wisp: Vigor 15, Resolve 8, Favor 12; no type.

| Check | Expected |
|---|---|
| Player Basic Attack vs. Wisp | floor((40 × 11)/(8 × 8)) = **6 damage, every hit** |
| Wisp Chilling Gust (P30) vs. player | floor((30 × 12)/(10 × 8)) = **4 damage, every hit** |
| Traveler's Salve heal at 20 max Vigor | 20% of 20 = **+4** |
| Round-by-round Wisp Vigor | 15 → 9 → 3 → 0 |
| Round-by-round player Vigor | 20 → 16 → 12 → 16 (Salve) → 12 |
| Battle end state | Player wins at **12/20 Vigor**, 4 rounds |
| Victory XP | 15 + (1 × 2) = **17 XP** |
| Drops | **None** (Wisp is in no drop table) |

## 4. XP Curve (Section 1) — `XP_to_next(L) = round(100 × L^1.05)`, cap 60

| Level | XP to next | Cumulative XP to reach |
|---|---|---|
| 1 | 100 | 0 |
| 2 | 207 | 100 |
| 3 | 317 | 307 |
| 4 | 429 | 624 |
| 5 | 542 | 1,053 |
| 6 | 656 | 1,595 |
| 7 | 772 | 2,251 |
| 8 | 888 | 3,023 |
| 9 | 1005 | 3,911 |
| 10 | 1122 | 4,916 |
| 15 | 1717 | 11,712 |
| 20 | 2323 | 21,507 |
| 25 | 2937 | 34,346 |
| 30 | 3556 | 50,267 |
| 35 | 4181 | 69,295 |
| 40 | 4810 | 91,456 |
| 45 | 5443 | 116,772 |
| 50 | 6080 | 145,262 |
| 55 | 6720 | 176,942 |
| 59 | 7234 | 204,594 |
| 60 | — | 211,828 |

Battle XP: `15 + (player_level × 2)` → L1 = 17, L10 = 35, L30 = 75, L60 = 135. Step XP: 1 per 20 steps (uncapped). HR XP: Moderate 3/min, Vigorous 5/min, Peak 7/min (Peak capped at 20 min/day, then drops to Vigorous rate). At Level 60: XP accrual stops entirely, no banking (Section 1 §4).

## 5. Gear Bonus Values (Section 8)

Mortal `round(0.05L)+1` · Heroic `round(0.10L)+2` · Mythic `round(0.17L)+3` · Divine `round(0.25L)+4`. Trinket splits its tier value: `round(0.6 × tier_bonus)` to Favor **and** the same to Aegis (audit-verified: Divine at L60 → bonus 19 → 11 Favor + 11 Aegis). Stride receives NO gear bonuses, ever.

| Level | Mortal | Heroic | Mythic | Divine |
|---|---|---|---|---|
| 1 | 1 | 2 | 3 | 4 |
| 10 | 1 | 3 | 5 | 6 |
| 15 | 2 | 4 | 6 | 8 |
| 22 | 2 | 4 | 7 | 10 |
| 30 | 3 | 5 | 8 | 12 |
| 42 | 3 | 6 | 10 | 14 |
| 52 | 4 | 7 | 12 | 17 |
| 60 | 4 | 8 | 13 | 19 |

## 6. Enemy Stats at Reference Levels (Sections 5–7)

Enemy level always equals player level at encounter time. All stats: `floor(base + rate × L)`.

| Enemy | Type | Level | Vigor | Might | Resolve | Favor | Aegis | Stride |
|---|---|---|---|---|---|---|---|---|
| Harpy | Storm | 5 | 23 | 6 | 6 | 10 | 7 | 15 |
| Harpy | Storm | 15 | 53 | 8 | 8 | 18 | 12 | 25 |
| Harpy | Storm | 30 | 98 | 12 | 12 | 29 | 20 | 40 |
| Satyr | Trickery | 5 | 20 | 8 | 8 | 10 | 8 | 11 |
| Satyr | Trickery | 15 | 45 | 13 | 13 | 18 | 13 | 19 |
| Satyr | Trickery | 30 | 83 | 21 | 21 | 29 | 21 | 30 |
| Cyclops | War | 10 | 60 | 20 | 15 | 12 | 12 | 7 |
| Cyclops | War | 15 | 82 | 25 | 19 | 14 | 14 | 8 |
| Cyclops | War | 30 | 150 | 40 | 30 | 22 | 22 | 12 |
| Cerberus | Underworld | 15 | 102 | 20 | 14 | 19 | 15 | 8 |
| Cerberus | Underworld | 20 | 130 | 24 | 17 | 23 | 18 | 10 |
| Cerberus | Underworld | 30 | 185 | 31 | 22 | 30 | 23 | 12 |
| Draugr | Underworld | 15 | 45 | 19 | 16 | 12 | 13 | 12 |
| Draugr | Underworld | 25 | 70 | 26 | 22 | 17 | 18 | 17 |
| Draugr | Underworld | 35 | 95 | 34 | 28 | 22 | 23 | 22 |
| Valkyrie | Storm | 15 | 36 | 9 | 9 | 22 | 13 | 26 |
| Valkyrie | Storm | 25 | 56 | 12 | 12 | 31 | 18 | 36 |
| Valkyrie | Storm | 35 | 76 | 15 | 15 | 40 | 23 | 46 |
| Fenrir | War | 20 | 102 | 26 | 20 | 21 | 17 | 20 |
| Fenrir | War | 25 | 122 | 30 | 23 | 24 | 19 | 23 |
| Fenrir | War | 35 | 162 | 38 | 29 | 30 | 24 | 29 |
| Jörmungandr | Sea | 28 | 130 | 24 | 13 | 32 | 24 | 12 |
| Jörmungandr | Sea | 31 | 142 | 26 | 14 | 34 | 26 | 12 |
| Jörmungandr | Sea | 40 | 178 | 32 | 17 | 42 | 32 | 15 |
| Strix | Trickery | 33 | 95 | 22 | 22 | 37 | 22 | 35 |
| Strix | Trickery | 45 | 127 | 28 | 28 | 48 | 28 | 45 |
| Strix | Trickery | 60 | 166 | 36 | 36 | 62 | 36 | 57 |
| Lemures | Underworld | 33 | 99 | 37 | 31 | 25 | 26 | 24 |
| Lemures | Underworld | 45 | 131 | 47 | 39 | 33 | 34 | 30 |
| Lemures | Underworld | 60 | 172 | 60 | 50 | 42 | 43 | 39 |
| Griffin | Wisdom | 44 | 130 | 47 | 39 | 44 | 37 | 40 |
| Griffin | Wisdom | 50 | 145 | 52 | 44 | 48 | 41 | 45 |
| Griffin | Wisdom | 60 | 170 | 61 | 51 | 56 | 48 | 52 |
| Cacus | Storm | 54 | 140 | 59 | 37 | 64 | 41 | 24 |
| Cacus | Storm | 57 | 147 | 62 | 39 | 67 | 43 | 25 |
| Cacus | Storm | 60 | 154 | 65 | 41 | 70 | 45 | 26 |

## 7. Streak Milestone Ladder (Section 11 §5)

| Day | Grant | Valid-transition check |
|---|---|---|
| 3 | Armor → Mortal | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 7 | Accessory → Mortal | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 14 | Weapon → Heroic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 25 | Armor → Heroic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 40 | Accessory → Heroic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 60 | Weapon → Mythic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 90 | Armor → Mythic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |
| 120 | Accessory → Mythic | No tier skipped (Weapon starts Mortal from onboarding; Armor/Accessory start empty) |

Overlap rule: if the slot is already at or above the milestone tier, auto-skip to next available tier for that slot; if all three slots ≥ milestone tier, one-time overflow fallback = 2× Herald's Draft. Never grants Trinket or Divine. Pacing anchors (corrected in audit): L15 ≈ day 28 avg / day 16 active; L25 ≈ day 81 avg / day 47 active.

## 8. Zone Gate Thresholds (Section 9)

1 League = 1,000 lifetime steps. Both conditions (distance AND prior boss) required.

| Gate | Leagues | ~Day (avg 7k/day) | ~Day (active 10k/day) |
|---|---|---|---|
| Cyclops | 90 | 13 | 9 |
| Cerberus | 220 | 31 | 22 |
| Fenrir | 380 | 54 | 38 |
| Jörmungandr | 900 | 129 | 90 |
| Griffin | 1850 | 264 | 185 |
| Cacus | 2900 | 414 | 290 |

## 9. Key Constants Quick Sheet

- Crit: 6.25% chance, ×1.5. Random factor: uniform 0.90–1.10. Damage divisor: DefenseStat × **8**.
- Basic Attack P40 (Might vs. Resolve), unlimited. Max 4 skills equipped. 100% accuracy on everything.
- Stat points: +3/level, manual allocation; 177 total allocated at L60. Start: Vigor 20, others 10.
- Vigor: 1%/10 min passive regen; 100% daily reset; 25% floor on defeat; Rest Day tag = immediate 100%.
- Wild encounter cap: 5/day, local-midnight reset. Sources: 25% roll per 1,000 new steps; 1 guaranteed per 15 min Tier 1+ HR (max 2/session); manual Explore (same pool/cap).
- Drops — items: wild 35% (Common), mini-boss 75% (C/U), zone boss 100% (first kill ≥1 Rare; repeats 75% C/U only). Gear: wild 20% Mortal, mini-boss 60% Heroic, zone boss 100% (Divine first kill / Mythic repeat). Daily step goal: 1 Common item + 25% Mortal gear roll.
- Inventory: 20 item slots (one item per slot), 12 gear slots (4 equipped + 8 reserve).
- Step goal: default 7,000, configurable, hard floor 3,000. Streak grace: unlimited manual Rest Days; auto sync-grace 48h lookback, max 3 per rolling 30 days.
- Overactivity warning: 90 continuous min at Tier 1+ HR; fires at sync time only; in-app only.
- Effects: Weaken ×0.5 out / Fortify ×0.5 in / Swift acts-first / Rend ×1.5 next-hit-taken. Ceilings: Rend+SE ×3.0; Surge(×1.5)+SE ×3.0; Breach forces ×2.0.
