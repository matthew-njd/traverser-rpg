# Traverser GDD — Section 1: XP Formula & Leveling Curve

## 1. Overview

Traverser's leveling system converts real-world movement and effort into experience points (XP) through three sources: **Step XP** (passive, primary driver), **Heart Rate Tier Bonus XP** (rewards workout intensity, tiered for safety), and **Battle XP** (a small bonus for winning encounters). XP is never lost or put at risk — it always represents real effort already spent.

Leveling uses a **fixed hard cap of Level 60**, with **flat stat point allocation** of 3 points per level, chosen manually by the player. The cap is intentionally set below what a fully "complete" endgame might eventually need, leaving headroom for a future expansion (e.g. levels 61–80 unlocked alongside the planned Egyptian zone) without reworking the curve — see Section 6.

---

## 2. XP Sources

### 2.1 Step XP (primary driver)
- **Rate:** 1 XP per 20 steps
- Uncapped — every step counts, no diminishing returns. This keeps the core promise that real effort is always rewarded, per the project's core design principle.
- Example: 8,000 steps/day → 400 XP from steps alone.

### 2.2 Heart Rate Tier Bonus XP (workout intensity)
Bonus XP is earned per minute spent in an elevated heart rate zone during a tracked activity session, **in addition to** any Step XP earned during that time. Zones are defined as a percentage of estimated max heart rate (HRmax, standard age-based estimate: 220 − age, refined by wearable data where available).

| Tier | HR Zone (% HRmax) | Bonus XP / min | Duration Cap |
|---|---|---|---|
| **Tier 1 — Moderate** | 50–69% | 3 XP/min | None — the sustainable daily sweet spot, rewarded generously and without limit |
| **Tier 2 — Vigorous** | 70–84% | 5 XP/min | None — hard workouts are always rewarded well |
| **Tier 3 — Peak** | 85%+ | 7 XP/min | First 20 cumulative min/day only. Beyond 20 min at Peak, rate drops to the Tier 2 rate (5 XP/min) — reward stops escalating, but never drops below what a hard-but-safer workout would earn |

**Design intent:** This tiering directly implements the health guardrail from the planning doc — moderate effort is the generously rewarded default, vigorous effort is rewarded just as well, and only the *escalating* reward for sustained peak exertion is capped. A player is never penalized for a long, hard workout; the formula simply stops giving *extra* incentive to push further into the peak zone once the cap is hit.

**Example (highly active day):** 45 min Vigorous (5 × 45 = 225 XP) + 10,000 steps (500 XP) = 725 XP, close to the "highly active user" baseline used in the pacing model below.

### 2.3 Battle XP
- **Win:** `15 + (player level × 2)` XP — enemy level equals the Traverser's current level at encounter time (established in Section 5), making the formula effectively level-relative.
- **Loss:** 0 XP — no penalty. Consistent with the planning doc's principle that XP is never at risk in battle; only loot/retry stakes are on the line.
- At low levels this remains a modest bonus (17 XP at L1, 35 XP at L10). The contribution grows with the player — a Level 60 win awards 135 XP, equivalent to ~2,700 steps. Real-world activity stays the dominant XP source throughout, but battle XP is no longer negligible at the level cap. See the scaling note in Section 3 below.

---

## 3. Daily XP Baselines (for pacing reference only — not hard caps)

These are modeling assumptions used to calibrate the level curve below, not caps enforced in code:

| Profile | Steps/day | Exercise | Battles | ≈ Total XP/day |
|---|---|---|---|---|
| **Average active user** | ~7,000 (350 XP) | ~3× per week, 30 min Moderate, amortized (~39 XP/day) | ~1 win/day (~35 XP at L10) | **~425 XP/day at L10** |
| **Highly active user** | ~10,000 (500 XP) | ~5× per week, 45 min Vigorous, amortized (~161 XP/day) | ~2 wins/day (~70 XP at L10) | **~730 XP/day at L10** |

**Battle XP scaling note (updated in Section 5):** Battle XP scales with player level because enemy level equals the Traverser's current level at encounter time. The Battles column above uses Level 10 as a representative early-game baseline. At Level 60, a single win awards 135 XP (~2,700 steps equivalent); a highly active player doing 2 battles/day adds ~270 XP on top of their step and HR totals. **The pacing table below retains 400/700 XP/day as its calibration baselines** (valid for early-to-mid-game, when most level gains occur); time-to-cap for consistently active combat players will be modestly shorter than projected — roughly 10–15% faster at high levels.

---

## 4. Level Curve

**Formula** — XP required to advance from level *L* to *L+1*:

```
XP_to_next(L) = round(100 × L^1.05)
```

**Level cap: 60** (fixed hard ceiling for the initial content release — see Section 6 for expansion notes).

**At the cap:** once Level 60 is reached, XP accrual simply stops — the XP bar reads MAX and no overflow XP is banked toward future levels. Banking would let capped veterans skip a large slice of the Level 61–80 curve on the day the Egyptian expansion launches, undermining that content's pacing before it ships. Real-world effort at the cap remains fully rewarded through every other system: steps still earn Leagues (Section 9), daily-goal items (Section 4), gear drops (Section 8), and streak credit (Section 11) — nothing about the "effort is never wasted" principle changes; only the XP bar retires.

This is a gentler exponent than a typical long-tail RPG curve, chosen deliberately: with a lower, more achievable cap, the goal is for leveling to feel like a satisfying companion to real progress rather than a grind to be endured. Early levels come almost daily, and even the cap itself is realistically reachable within about a year for a highly active player — an actual finish line, not a decorative number nobody hits.

### Pacing table (computed from the formula above)

| Level | XP to next level | Cumulative XP to reach | Days (avg. user, 400 XP/d) | Days (highly active, 700 XP/d) |
|---|---|---|---|---|
| 1 | 100 | 0 | 0.0 | 0.0 |
| 2 | 207 | 100 | 0.2 | 0.1 |
| 3 | 317 | 307 | 0.8 | 0.4 |
| 4 | 429 | 624 | 1.6 | 0.9 |
| 5 | 542 | 1,053 | 2.6 | 1.5 |
| 6 | 656 | 1,595 | 4.0 | 2.3 |
| 7 | 772 | 2,251 | 5.6 | 3.2 |
| 8 | 888 | 3,023 | 7.6 | 4.3 |
| 9 | 1,005 | 3,911 | 9.8 | 5.6 |
| 10 | 1,122 | 4,916 | 12.3 | 7.0 |
| 15 | 1,717 | 11,712 | 29.3 | 16.7 |
| 20 | 2,323 | 21,507 | 53.8 | 30.7 |
| 25 | 2,937 | 34,346 | 85.9 | 49.1 |
| 30 | 3,556 | 50,267 | 125.7 | 71.8 |
| 35 | 4,181 | 69,295 | 173.2 | 99.0 |
| 40 | 4,810 | 91,456 | 228.6 | 130.7 |
| 45 | 5,443 | 116,772 | 291.9 | 166.8 |
| 50 | 6,080 | 145,262 | 363.2 | 207.5 |
| 55 | 6,720 | 176,942 | 442.4 | 252.8 |
| 60 | — | 211,828 | 529.6 (~1.45 yrs) | 302.6 (~0.83 yrs) |

**Read on pacing:**
- **Levels 1–5:** essentially daily for the average user, same-day for the highly active user — strong early hook, matches tutorial/first-week onboarding energy.
- **Levels 5–10:** every 1–3 days — still frequent, keeps early retention strong.
- **Levels 10–30:** roughly weekly to every 2 weeks — matches the natural pace of unlocking Olympion → Valheon → Imperion over the first several months.
- **Levels 30–60:** slows to 2–4 weeks per level, but the marginal cost never exceeds ~18 days (avg. user) even at the very top of the curve — a meaningful commitment, not a wall. A highly active player can realistically hit Level 60 in under a year; an average player in under a year and a half.

---

## 5. Stat Points Per Level

- **3 stat points awarded per level**, every level, flat (no scaling or milestone bonuses).
- Player manually allocates points among the six stats (Vigor, Might, Resolve, Favor, Aegis, Stride) at the moment of leveling up.
- **Total lifetime points available at Level 60: 177** across the six stats — enough for meaningful specialization (e.g., a Might/Aegis-focused build) while still requiring real trade-offs, since evenly spreading them yields only ~30 points/stat by the cap. If a future expansion raises the cap (see Section 6), this total grows accordingly at the same flat 3/level rate.

### Starting stats (Level 1 baseline)
| Stat | Base Value |
|---|---|
| Vigor (HP) | 20 |
| Might | 10 |
| Resolve | 10 |
| Favor | 10 |
| Aegis | 10 |
| Stride | 10 |

Vigor starts higher since it functions as the HP pool and needs enough headroom to make early battles survivable before points are invested. These base values are provisional and should be revisited once damage formulas are finalized in Section 2 (Type Chart & Combat Mechanics).

---

## 6. Cross-Section Flags

These decisions affect other GDD sections and should be carried forward:

- **Section 2 (Combat):** Starting stat baselines (Section 5 above) are provisional pending the damage formula — may need rebalancing once move power values exist.
- **Section 9 (Overworld Map): FULFILLED.** Zone unlock distance thresholds are fully defined in Section 9 §3, cross-checked against this level curve — Valheon unlock lands the average user at Level 15, inside the mid-teens target flagged here.
- **Overactivity warning (90-min threshold): FULFILLED.** The trigger logic now lives in Section 11 §8 (fires at sync time only, per the no-passive-sync architecture) and the visual component in Section 13 §6.5. The 90-minute threshold defined here was confirmed unchanged.
- **Section 4 (Battle Items) → resolved in Section 5:** Battle XP formula is `15 + (player level × 2)` — enemy level equals the Traverser's current level at encounter time. At Level 60, a win awards 135 XP. See Battle XP scaling note in Section 3 above for full implications.
- **Future expansion (Egyptian zone, post-MVP):** The level cap of 60 is deliberately not the ceiling of the formula itself — `XP_to_next(L) = round(100 × L^1.05)` extends cleanly past 60 with no discontinuity. Raising the cap later (e.g. to 80) is a config change, not a redesign: no new formula, no rebalancing of levels 1–60, just unlocking further levels. Worth keeping in mind when Section 9 (Overworld Map) designs the Egyptian zone's distance-unlock gate, so the new zone and the new level range stay roughly in sync the same way Olympion/Valheon/Imperion should.

---

## 7. Open Questions

- **Battle XP scaling at high player levels — resolved in Section 5:** Enemy level = player level, so battle XP scales from 17 XP at L1 to 135 XP at L60. At the level cap with 1 win/day, battle XP contributes ~135 XP against ~389 XP from steps and HR (~35% on top) — larger than the "minor bonus" framing originally anticipated. This is accepted: step XP remains dominant, battles stay optional, and higher battle XP at the cap rewards endgame engagement without undermining the core loop.
- **Overactivity warning threshold (90 min):** ~~set here provisionally per the planning doc's suggested value — confirm during onboarding/notification design.~~ **CLOSED — confirmed.** Section 11 §8 adopted the 90-minute Tier 1+ threshold unchanged as the final trigger condition.
- **Starting stat baselines:** ~~a first pass, may shift once the damage formula in Section 2 is built out.~~ **CLOSED — validated.** The Section 2 damage formula (÷8 divisor) was stress-tested against these baselines across all three enemy roster sections and the tutorial battle script (Section 10 §6.3); no rebalance was needed.
