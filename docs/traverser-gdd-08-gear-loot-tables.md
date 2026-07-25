# Traverser GDD — Section 8: Gear & Loot Tables

## 1. Overview

This section fully specifies the gear system outlined in the planning prompt: the four equipment slots, the Mortal → Heroic → Mythic → Divine rarity ladder, stat bonus values per tier, the gear-granted move system (building on Section 3's structure), and drop rates across battle encounters, daily step goals, and level milestones.

**Foundational decision confirmed this session:** the gear-granted move (Mythic = damage only, Divine = damage + effect, per Section 3) is carried by the **Trinket slot only**. Weapon, Armor, and Accessory are pure stat-bonus items at every tier. This is left open to extend to Weapon in a future revision if the endgame loadout ever feels too Trinket-dependent, but nothing in this section assumes that extension — it's additive, not required.

Two design principles carry over directly from the planning prompt:
- **Real-world effort is the primary acquisition path.** Mortal-tier gear (Weapon/Armor/Accessory) flows from everyday steps, not combat — this section defines that pipeline for the first time.
- **Art economy discipline.** Only Trinkets are zone-specific; Weapon, Armor, and Accessory are tier-differentiated but zone-agnostic, so their art can reuse one silhouette-per-slot across the whole game exactly as the planning prompt specifies. Trinkets — rarer, boss-exclusive at their top tiers — are where zone identity and unique art investment belong.

---

## 2. Equipment Slots & Rarity Tiers

### 2.1 Slots (from planning prompt, restated for reference)

| Slot | Zone-specific? | Grants gear move? |
|---|---|---|
| **Weapon** | No | No |
| **Armor** | No | No |
| **Accessory** | No | No |
| **Trinket** | Yes | Yes (Mythic/Divine only) |

### 2.2 Rarity Tiers (from planning prompt, restated for reference)

| Tier | Source | Sprite treatment |
|---|---|---|
| **Mortal** | Common, everyday step-based drops | Stat bonus only, no unique sprite |
| **Heroic** | Uncommon | Palette-swap on shared base silhouette |
| **Mythic** | Rare, mostly bosses/milestones | Genuinely unique sprite |
| **Divine** | Legendary, boss-exclusive or major milestones | Unique sprite + glow/particle flourish |

---

## 3. Stat Bonus Values

### 3.1 Which stat each slot governs

Five of the six core stats receive gear bonuses. **Stride is deliberately excluded from the gear system.** Sections 6 and 7 both calibrated boss fights (Fenrir, Griffin, Cacus) around the player racing the enemy's Stride with no mechanical way to close the gap — that tension is a deliberate, already-balanced design element. Introducing gear-based Stride bonuses would silently undercut it. This closes the open question both sections flagged ("worth flagging if the game ever introduces Stride-altering mechanics") — the answer is that it doesn't, by design.

| Slot | Stat governed | Rationale |
|---|---|---|
| **Weapon** | Might | Physical offense — pairs with the Might-focused build path from Section 3 |
| **Armor** | Resolve | Physical defense |
| **Accessory** | Vigor | Survivability; the most universally useful stat for a flexible slot |
| **Trinket** | Favor **and** Aegis (split) | "Divine" slot — Favor governs how hard typed moves hit, Aegis how well they're resisted (planning prompt's own framing of these two stats). Fitting that the one slot carrying a typed move also buffs both sides of typed combat. |

### 3.2 Bonus formulas

Gear stat bonuses scale with the **player's level at the time the item drops** (gear is generated at acquisition, not recalculated later — same principle as enemy stats scaling to encounter level in Sections 5–7). This creates natural gear churn: a piece is strongest right when you get it and gradually falls behind as you outlevel it, which is the intended incentive to keep engaging with the drop sources below rather than "solving" gear once.

| Tier | Formula (single-stat slots) | Formula (Trinket, per stat) |
|---|---|---|
| Mortal | `round(0.05 × L) + 1` | — (Trinket doesn't drop at Mortal tier; see §5) |
| Heroic | `round(0.10 × L) + 2` | `round(0.6 × Heroic formula)` |
| Mythic | `round(0.17 × L) + 3` | `round(0.6 × Mythic formula)` |
| Divine | `round(0.25 × L) + 4` | `round(0.6 × Divine formula)` |

The 0.6× dual-stat coefficient keeps a Trinket's *combined* stat value (two stats × 0.6 ≈ 1.2× a single-slot bonus) meaningfully more valuable than a single-stat slot at the same tier — appropriate for the slot that's also carrying a move — without doubling it outright.

### 3.3 Reference values at key encounter levels

| Encounter level | Mortal | Heroic | Mythic | Divine | Trinket Heroic (per stat) | Trinket Mythic (per stat) | Trinket Divine (per stat) |
|---|---|---|---|---|---|---|---|
| ~L10 (Cyclops gate) | +1 | +3 | +5 | +6 | +2 | +3 | +4 |
| ~L15 (Cerberus gate) | +2 | +4 | +6 | +8 | +2 | +4 | +5 |
| ~L22 (Fenrir gate) | +2 | +4 | +7 | +10 | +2 | +4 | +6 |
| ~L30 (Jörmungandr gate) | +3 | +5 | +8 | +12 | +3 | +5 | +7 |
| ~L42 (Griffin gate) | +3 | +6 | +10 | +14 | +4 | +6 | +8 |
| ~L52 (Cacus gate) | +4 | +7 | +12 | +17 | +4 | +7 | +10 |
| L60 (cap) | +4 | +8 | +13 | +19 | +5 | +8 | +11 |

**Balance read:** a full Divine loadout at L60 gives roughly +19 Might, +19 Resolve, +19 Vigor, +11 Favor, +11 Aegis — a meaningful but not dominant supplement (single-digit-to-low-teens percentage swing in damage output, per the `Power × AttackStat / (DefenseStat × 8)` formula from Section 2). Because gear can only ever *help* — there's no negative gear, no enemy gear-scaling — its ceiling effect is to make already-completed content more comfortable, never to trivialize a fight the player hasn't out-leveled. That property is specifically useful at the two fights flagged as tightest in Sections 6 and 7 (Jörmungandr pre-L30, Cacus at L52) — see §6.

---

## 4. Gear-Granted Moves (Trinket Only)

### 4.1 Structure (inherited from Section 3)

- **Mythic Trinket:** damage-only move, Power 65–80, 4 uses/battle
- **Divine Trinket:** damage + one secondary effect (Weaken/Fortify/Swift/Rend, per Section 3's vocabulary), Power 65–75, 3 uses/battle
- Both are Favor vs. Aegis (Divine-typed), 100% accuracy, uses replenish each battle — identical structural rules to every other Divine move in the game.

### 4.2 Type assignment strategy

Each zone's boss-exclusive Trinket is intentionally typed to matter for the **next** zone, not the one it's found in. This mirrors the precedent Section 4 already set with zone-entry Breach charms (Imperion's entry reward deliberately targeted Griffin/Cacus's actual SE gaps rather than Imperion's wild-encounter types). It also directly resolves three cross-section flags raised in Sections 6 and 7, which asked Section 8 to deliberately decide whether higher-Power gear moves of specific types should exist:

| Zone boss | Trinket type | Resolves |
|---|---|---|
| **Cerberus** (Olympion) | **Trickery** | Section 6's flag: a Trickery move above Shadowstep's P55 would meaningfully ease Jörmungandr, whose pre-Level-30 window was flagged as possibly too punishing. A player who fully clears Olympion arrives at Valheon already holding a P65–80 Trickery option — earned, not free. |
| **Jörmungandr** (Valheon) | **War** | Section 7's flag: a Storm- or War-typed gear move above the level-unlock ceiling would meaningfully help against Strix. War is chosen (already unlocked at Level 10, safe to strengthen). |
| **Cacus** (Imperion) | **Wisdom** | Section 7's flag: a Sea- or Wisdom-typed gear move would help both Griffin and Cacus. Wisdom is chosen since Sea is already well-covered by Tidecaller's Grasp and the Undertow Breach charm (Section 4's Imperion entry reward). This Trinket lands after Imperion's own bosses are already beaten — it's forward-flagged for the Egyptian zone expansion (Phase 2) rather than solving anything in the base game, which is the correct scope for a final-zone-final-boss reward. |

This resolves all three flags **without touching any locked number** in Sections 3, 6, or 7 — the fix lives entirely in itemization and acquisition sequencing, not in rebalancing existing formulas.

### 4.3 Full move specifications

---

#### Gatekeeper's Ruse *(Olympion — Cerberus, Mythic Trinket)*
- **Power:** 80 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** Trickery (2× vs. Underworld, Sea — 0.5× vs. War, Storm)
- **Flavor:** *"Slip past what should have stopped you. It worked once."*
- **Design note:** Repeat-kill reward from Cerberus (also the base type for the Divine version below). At P80 (Section 3's Mythic ceiling) this sits well above Shadowstep's P55 and gives a returning or thoroughly-prepared player real Trickery burst going into Valheon. All three Mythic Trinkets are set to the same P80 ceiling — the top-tier boss reward should sit at the top of its allowed range, not an arbitrary point below it.

---

#### Gatekeeper's Snare *(Olympion — Cerberus, Divine Trinket, first kill only)*
- **Power:** 75 | **Uses:** 3/battle | **Stats:** Favor vs. Aegis | **Type:** Trickery | **Effect:** Rend (target takes 150% damage on its next hit)
- **Flavor:** *"The guardian's own trick, turned outward. Something is left marked."*
- **Design note:** Rend fits the "mark for later" flavor of a gatekeeper's parting curse, and gives the Trinket a setup tool distinct from Cerberus's own kit. Stacks with type advantage per Section 3's existing Rend+SE ceiling (validated safe up to ×3.0 in Section 7).

---

#### Coilbreaker's Oath *(Valheon — Jörmungandr, Mythic Trinket)*
- **Power:** 80 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** War (2× vs. Trickery, Underworld — 0.5× vs. Storm, Wisdom)
- **Flavor:** *"You broke the coils that broke gods. Nothing mortal feels as dangerous again."*
- **Design note:** Well above Warlord's Advance's P65 ceiling, giving a player who's beaten Jörmungandr a genuine War upgrade heading into Imperion, where Strix is vulnerable to both Storm and War.

---

#### Coilbreaker's Wrath *(Valheon — Jörmungandr, Divine Trinket, first kill only)*
- **Power:** 75 | **Uses:** 3/battle | **Stats:** Favor vs. Aegis | **Type:** War | **Effect:** Weaken (target's next attack deals 50% damage)
- **Flavor:** *"It struck once, at everything. It won't get to again."*
- **Design note:** Weaken pairs naturally with a "the World-Serpent's fury is spent" narrative beat — the player has taken its power and blunted it.

---

#### Emberwise Ward *(Imperion — Cacus, Mythic Trinket)*
- **Power:** 80 | **Uses:** 4/battle | **Stats:** Favor vs. Aegis | **Type:** Wisdom (2× vs. Storm, War — 0.5× vs. Sea, Underworld)
- **Flavor:** *"What the fire-giant never understood, you now carry."*
- **Design note:** At P80 (Section 3's Mythic ceiling) this is the single strongest Wisdom option in the base game, genuinely above Sage's Verdict's P75. Forward-flagged for Egyptian-zone balancing in Phase 2 — see Open Questions.

---

#### Emberwise Verdict *(Imperion — Cacus, Divine Trinket, first kill only)*
- **Power:** 75 | **Uses:** 3/battle | **Stats:** Favor vs. Aegis | **Type:** Wisdom | **Effect:** Fortify (next hit the Traverser takes deals 50% damage)
- **Flavor:** *"The fire's lesson, finally learned: guard yourself before you strike."*
- **Design note:** P75 is Section 3's Divine ceiling, which happens to equal Sage's Verdict's own Power exactly — the only one of the six Trinket moves that doesn't out-damage its matching level-unlock skill. Fortify is the actual differentiator here, not raw Power; this is intentional and consistent with the Divine-tier design (damage + effect always trades some Power ceiling for the added effect, per Section 3). Fortify also closes out the three-effect spread across the Trinket set (Rend / Weaken / Fortify) — Swift is deliberately left unused here since it's already well-represented by Fleet Omen (Section 4) and no enemy in the base game grants or is vulnerable to Swift-timing plays. The "Verdict" naming echo with Sage's Verdict is deliberate, following the same same-type naming-parallel convention Section 3 established for Iron Advance/Warlord's Advance.

---

## 5. Drop Rates & Acquisition

### 5.1 Weapon / Armor / Accessory — Battle Drops

Resolves as an **independent roll**, separate from both the item drop roll (Section 4) and the Trinket roll (§5.2 below) — three independent dice per encounter, consistent with Section 4's suggested approach.

| Encounter type | Drop chance | Tier | Slot |
|---|---|---|---|
| Regular wild encounter | 20% | Mortal | Random (Weapon/Armor/Accessory, equal weight) |
| Mini-boss | 60% | Heroic | Random (Weapon/Armor/Accessory, equal weight) |
| Zone boss, repeat kill | 100% | Mythic | Random (Weapon/Armor/Accessory, equal weight) |
| Zone boss, first kill | 100% | Divine | Random (Weapon/Armor/Accessory, equal weight) |

### 5.2 Trinket — Boss-Exclusive Drops

Trinkets **never drop from wild encounters** — consistent with the planning prompt's framing of Trinkets as the zone-identity slot, and with §4.2's "boss reward, meant for the next zone" design. Only one Trinket exists per zone; repeat kills re-roll the same item (harmless — the player either already has it or receives it now).

| Encounter type | Drop | Tier | Move? |
|---|---|---|---|
| Mini-boss (Cyclops / Fenrir / Griffin) | 100% guaranteed | Heroic | No — stat bonus only |
| Zone boss, repeat kill | 100% guaranteed | Mythic | Yes — damage only (§4.3) |
| Zone boss, first kill | 100% guaranteed | Divine | Yes — damage + effect (§4.3) |

Mini-boss Heroic Trinkets are zone-flavored but carry no combat-relevant type (no move at this tier) — pure stat items with strong "Old Roads" branding:

| Zone | Mini-boss | Heroic Trinket name |
|---|---|---|
| Olympion | Cyclops | **Skyroad Sigil** |
| Valheon | Fenrir | **Frostroad Sigil** |
| Imperion | Griffin | **Sunroad Sigil** |

("Sigil," not "Charm" — Section 4 already uses "Charm" as a category name for battle items (Surge Charms, Breach Charms). Naming an equipped Trinket a "Charm" too would be confusing in the inventory UI, where the two are functionally unrelated: one's a consumable, one's gear.)

**Flavor:**
- *Skyroad Sigil:* "A fragment of the road as it climbed toward Olympus."
- *Frostroad Sigil:* "Carried the length of the road through Asgard's coldest stretch."
- *Sunroad Sigil:* "Warmed by every mile of the road through Rome's long noon."

### 5.3 Daily Step Goal Reward

**Trigger:** same daily step goal event defined in Section 4.6.2 (default 7,000 steps). In addition to Section 4's guaranteed common item, there is a **25% chance** of also receiving 1 Mortal-tier Weapon/Armor/Accessory (random slot), resolved independently.

**Economy check** (mirroring Section 4's model):

| Profile | Wild gear/week (from 20% roll) | Step-goal gear/week (25% × goal days) | Total Mortal gear/week |
|---|---|---|---|
| Average user (2 enc/day, 5/7 goal days) | ~2.8 | ~1.25 | **~4.1** |
| Highly active user (4 enc/day, 7/7 goal days) | ~5.6 | ~1.75 | **~7.4** |

This keeps Mortal gear flowing fast enough to feel like a constant "found along the road" trickle (matching the planning prompt's emphasis on everyday-effort loot) without requiring any unique art per piece, since Mortal tier has no unique sprite.

### 5.4 Level Milestones

Offset from Section 4's item milestone levels (10/20/30/40/50/60) so the two reward tracks don't collide on the same level-up:

| Level | Reward |
|---|---|
| 15, 35, 55 | 1 guaranteed Heroic gear piece (random Weapon/Armor/Accessory) |
| 25, 45 | 1 guaranteed Mythic gear piece (random Weapon/Armor/Accessory) |

Milestone gear, like Section 4's milestone items, is never blocked by inventory capacity (§5.5) — it always delivers, with the overflow prompt firing after if needed.

### 5.5 Gear Inventory

A separate cap from Section 4's 20-slot battle-item inventory, since gear isn't consumed the way items are:

- **12 gear slots** (4 currently equipped + 8 held in reserve for swapping/comparison).
- Same overflow rule as Section 4: a new piece that would exceed 12 triggers a keep/discard prompt — nothing is silently lost.
- No crafting, selling, or salvage system exists in the base game (out of scope per the planning prompt's Phase 1 focus). Excess gear is simply discarded via the overflow prompt. This is flagged in Open Questions as a candidate Phase 2 addition once a currency/economy layer exists.

---

## 6. Balance Notes

### 6.1 Gear as a punishing-fight safety valve, not a difficulty removal tool

Sections 6 and 7 flagged two fights as the tightest in the game: Jörmungandr's pre-Level-30 window (Section 6) and Cacus at Level 52 (5 HP remaining margin, Section 7). Neither of those fights' *first-attempt* numbers change here — Section 8 doesn't touch locked Vigor, Power, or type-chart values. What changes is that a thorough player who has cleared the *previous* zone arrives at each fight with one extra tool (§4.2). This is additive difficulty relief for prepared/returning players, not a first-attempt nerf — the "arrive too early" tension both sections designed for stays fully intact for a player who beelines the zone gates without exploring.

### 6.2 Stacking ceiling check

A theoretical full-Divine-loadout Level 60 Traverser (+19 Might/Resolve/Vigor, +11 Favor/Aegis) was checked against the damage formula from Section 2 across representative enemy defense values from Sections 5–7 (Cerberus Resolve, Fenrir Aegis-equivalent, Cacus Resolve). In all cases the swing is a modest single-digit-to-low-teens percentage increase in damage output or survivability — consistent with "legendary gear feels good," not "gear replaces the type system." No one-shot or trivialization cases were found, and none are expected given gear only ever adds to stats that already sit within the ranges Sections 5–7 balanced against.

---

## 7. Naming Conventions

- **Weapon/Armor/Accessory** follow one tier ladder across the whole game (zone-agnostic, per §1): **Traveler's → Warden's → Paragon's → Ascendant's**, deliberately echoing the tier system's own mortal-to-divine narrative arc. ("Champion's" was the original choice for the Mythic tier but collides with the locked Physical Skill **Champion's Surge** from Section 3 — same word, different item category, but confusing enough in a shared inventory/battle UI to avoid. "Paragon's" keeps the same near-peak-mortal register without the clash.)

| Tier | Weapon | Armor | Accessory |
|---|---|---|---|
| Mortal | Traveler's Blade | Traveler's Guard | Traveler's Band |
| Heroic | Warden's Blade | Warden's Guard | Warden's Band |
| Mythic | Paragon's Blade | Paragon's Guard | Paragon's Band |
| Divine | Ascendant's Blade | Ascendant's Guard | Ascendant's Band |

- **Trinkets** follow zone-specific naming, no proper god names (per Section 3's convention), Old Roads/road-branding for Heroic tier and creature-adjacent epithets (never the creature's literal name) for Mythic/Divine, matching the register already established for gear moves.

---

## 8. Cross-Section Flags

- **Section 3 (Move & Ability Design) — gear move assignment: FULFILLED.** All six Mythic/Divine Trinket moves are now fully specified using Section 3's structure and effect vocabulary (§4.3 above). The "Power 65–80 range overlapping the level-unlock pool" open question is resolved in practice: overlap is intentional and load-bearing (§4.2, §6.1) rather than a problem to narrow away.
- **Section 4 (Battle Items) — independent gear/item drop rolls: CONFIRMED, no runaway rate.** Both rolls are independent per §5.1. Worst case (wild encounter) is 35% item + 20% gear + 0% Trinket (Trinkets don't drop from wild encounters) — a ~7% chance of both landing in the same encounter, which is fine since gear and items serve non-overlapping economies (equipment vs. consumables) and gear isn't stackable/hoardable the way items are.
- **Section 5 (Olympion): FULFILLED.** Gear drop chances and tier pools assigned for Harpy/Satyr (wild, §5.1), Cyclops (mini-boss, §5.1 + Skyroad Sigil), Cerberus (zone boss, §5.1 + Gatekeeper's Ruse/Snare).
- **Section 6 (Valheon): FULFILLED.** Draugr/Valkyrie (wild, §5.1), Fenrir (mini-boss, §5.1 + Frostroad Sigil), Jörmungandr (zone boss, §5.1 + Coilbreaker's Oath/Wrath). The flagged Trickery-gear-power question is resolved via §4.2 — Trickery power comes from the *previous* zone's boss reward (Gatekeeper's Ruse/Snare), not from anything droppable within Valheon itself, preserving Jörmungandr's own first-attempt difficulty.
- **Section 7 (Imperion): FULFILLED.** Strix/Lemures (wild, §5.1), Griffin (mini-boss, §5.1 + Sunroad Sigil), Cacus (zone boss, §5.1 + Emberwise Ward/Verdict). The Storm/War-for-Strix and Sea/Wisdom-for-Griffin/Cacus questions are resolved the same way as Valheon's: the relevant power comes from the *previous* zone's boss reward (Coilbreaker's Oath/Wrath, War-typed), not from anything obtainable before reaching Strix.
- **Section 9 (Overworld Map):** no new dependency beyond what Sections 5–7 already flagged (boss gate distance thresholds). Gear acquisition here is encounter-triggered, not distance-triggered directly.
- **Section 10 (Onboarding):** Tutorial completion should introduce the Weapon slot with a starter Mortal-tier piece (parallel to the 3 Traveler's Salves granted per Section 4) so the player understands gear exists before their first wild encounter. The gear-move mechanic (Trinket only) shouldn't be introduced until the player's first mini-boss Heroic Trinket — too early would be confusing since Heroic Trinkets carry no move.
- **Section 12 (Story & Lore): FULFILLED.** The "next zone's reward comes from this zone's final boss" pattern (§4.2) is surfaced explicitly in Section 12's boss-defeat text — Cerberus's "a trick worth carrying north" (§5.2), Jörmungandr's "a war learned from the Serpent's own fury" (§6.2), and Cacus's defeat text echoing Emberwise Verdict's own flavor line (§7.2).
- **Section 13 (UI Architecture): FULFILLED.** The Equip/Inventory screen distinct from the battle-item inventory — 4 equip slots + gear comparison view + the keep/discard overflow prompt from §5.5 — is delivered in Section 13 §5.1, and the pre-first-kill Trinket surfacing is delivered via the Boss Gate Detail screen (Section 13 §4.3).
- **Art phase (future, separate Claude Project per planning prompt):** the layered-PNG gear overlay pipeline (planning prompt item 9) is out of this GDD section's scope but depends on the slot/tier structure defined here — specifically that Weapon/Armor/Accessory are zone-agnostic (one silhouette per slot, palette-varied by tier) while Trinkets need bespoke per-zone art at Mythic/Divine tier. This should be handed off as a structural constraint when that project starts.

---

## 9. Open Questions

- **Egyptian zone (Phase 2) Trinket chain:** Emberwise Ward/Verdict (Cacus, Wisdom-typed) is explicitly forward-flagged rather than solving a base-game problem (§4.2). When the Egyptian zone is designed, its final boss should have an identified weakness that Wisdom-typed gear meaningfully addresses, or this Trinket's type should be revisited. Not urgent — flagged for whenever Phase 2 scoping begins.
- **Gear salvage/economy (Phase 2 candidate):** §5.5 notes there's no sell/salvage system for excess gear in the base game — overflow is simply discarded. If a currency or crafting layer is introduced post-launch, excess gear discard is the natural sink to convert into that system's Phase 1 answer to "why am I finding this."
- **Weapon slot gear-move extension:** flagged in §1 — if the endgame loadout ever feels too dependent on a single Trinket for all typed damage variety, extending the gear-move system to Weapon (Physical-only gear moves are already prohibited by Section 3, so this would need to stay within Divine-typed moves, effectively giving players two "Trinket-like" slots) is the lowest-friction fix. Not needed at this stage — noted only as a pressure release valve if playtesting reveals a problem.
- **Mini-boss 60% / wild 20% drop rate calibration:** these figures were set by internal consistency with Section 4's item-drop cadence and a target of roughly one full Mortal gear "set" (3 pieces — Weapon, Armor, Accessory; Trinket doesn't drop at Mortal tier per §5.2) landing every 1–2 weeks of average play. At the corrected ~4.1 Mortal gear/week for an average user (§5.3), a coupon-collector estimate (expected draws to see all 3 random slots at least once ≈ 5.5) puts this at roughly 1.3 weeks — consistent with the target. **Revisited and confirmed in Section 9 §5.4:** with the real daily encounter cap defined (5/day, expected volumes ~1.75 avg / ~4.5 active), the ~4.1 Mortal gear/week and ~1.3-weeks-to-a-set figures hold; no rate revision was needed.

