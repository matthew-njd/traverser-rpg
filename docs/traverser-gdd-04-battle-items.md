# Traverser GDD — Section 4: Battle Items

## 1. Overview

Battle items are single-use consumables the Traverser carries into combat as the third action type alongside Attack and Skill. They fall into three categories — **Healing** (Vigor restoration), **Buffs** (temporary tactical effects), and **Type Charms** (typed damage amplifiers) — and are acquired through battle drops, daily activity rewards, and milestone grants.

The item system follows the same design constraints as the rest of combat: simple enough to scan at a glance, consequential enough to reward thoughtful use. Items should feel like genuine tactical decisions, not emergency buttons to spam.

**Two foundational rules govern the whole system:**
- Each item is consumed immediately on use, regardless of whether the effect fires (e.g., if a Swift item is used but the round resolves before the Traverser acts, the item is still gone).
- One item per turn — the Item action replaces Attack or Skill for that round; no multi-item turns.

---

## 2. Item Categories

### 2.1 Healing Items

Restore a percentage of the Traverser's **maximum Vigor**. Percentage-based scaling (rather than flat values) keeps healing relevant across the full level range without requiring a separate balance pass at each level tier.

Healing items are the only items usable **outside of battle** — a player can use one between encounters to recover before the next fight. Buff items and Type Charms are battle-only (they trigger off battle actions and have no meaningful out-of-battle application).

| # | Name | Effect | Rarity | Max stack |
|---|------|--------|--------|-----------|
| 1 | **Traveler's Salve** | Restore 20% of max Vigor | Common | 5 |
| 2 | **Herald's Draft** | Restore 40% of max Vigor | Uncommon | 3 |
| 3 | **Ambrosia Shard** | Restore 100% of max Vigor | Rare | 2 |

**Absolute reference values** (for balancing — not surfaced to the player):

| Item | Level 10 (Vigor ~50) | Level 30 (Vigor ~110) | Level 60, Vigor-focused (~197) |
|---|---|---|---|
| Traveler's Salve | +10 | +22 | +39 |
| Herald's Draft | +20 | +44 | +79 |
| Ambrosia Shard | +50 | +110 | +197 |

**Vigor persistence note (from Section 2):** Healing items extend a player's fighting session without breaking the daily reset or rest-day pacing. At Level 10, five Salves (max stack) extend a player from ~4 fights to ~8 before KO — meaningful headroom but well within any reasonable daily encounter cap. Ambrosia Shard's rarity (max 2, milestone-only source) prevents it from becoming a routine reset button.

**Flavor (brief in-game description):**
- *Traveler's Salve:* "Found along every old road. Mixed from whatever grows near the path."
- *Herald's Draft:* "What gods' messengers drink between realms. Enough remains for mortals."
- *Ambrosia Shard:* "A fragment of something that shouldn't exist in the mortal world. Use it carefully."

---

### 2.2 Buff Items

Apply a single-trigger tactical effect to the current battle, using the same effect vocabulary established for Divine gear moves in Section 3. Three of the four gear effects appear as consumable items; Rend is excluded because Type Charms (Section 2.3) already fill the "set up amplified damage" role — duplicating it here would muddy the tactical vocabulary.

All buff items are **battle-only**. Effects resolve identically to their gear counterparts: single-trigger, non-stacking, resolved at the moment of the next relevant action.

| # | Name | Effect | Rarity | Max stack |
|---|------|--------|--------|-----------|
| 4 | **Ironhide Tincture** | **Fortify** — next hit the Traverser receives deals 50% of normal damage (×0.5 incoming) | Uncommon | 3 |
| 5 | **Sunder Oil** | **Weaken** — enemy's next outgoing attack deals 50% of normal damage (×0.5 outgoing) | Uncommon | 3 |
| 6 | **Fleet Omen** | **Swift** — Traverser acts first next round, regardless of Stride comparison | Rare | 2 |

**Interaction rules** (inherited from Section 3):
- Fortify and Weaken can be in effect simultaneously without conflict (they affect opposite sides of an exchange).
- If both the Traverser and enemy apply Swift in the same round, effects cancel and normal Stride order applies.

**Flavor:**
- *Ironhide Tincture:* "Rubbed into the skin before a battle that might hurt. Usually does."
- *Sunder Oil:* "Coats a weapon or hand. The next blow it lands will land soft."
- *Fleet Omen:* "The tingling sense that you're about to move very quickly. Follow it."

---

### 2.3 Type Charms

Type Charms are split into two mechanical variants — **Surge** and **Breach** — with one charm per godly-domain type in each variant: 12 charms total. Both are **battle-only**.

#### Surge Charms — Amplify Outgoing Damage

**Effect:** The Traverser's next typed move deals **1.5× its base damage**, before type multipliers are applied.

This multiplier slots into the damage formula from Section 2 as follows:

```
Damage = floor( (Power × AttackStat) / (DefenseStat × 8) × SurgeMultiplier × TypeMultiplier × CritMultiplier × RandomFactor )
```

Where `SurgeMultiplier = 1.5` if a matching Surge charm was used this turn, else `1.0`.

**Tactical profile:** Surge charms are burst tools, not DPS optimizers. Using a charm costs the Traverser's action for one round, so they only pay off when the amplified hit materially changes the fight's outcome (e.g., KO'ing a tanky enemy in fewer total rounds, or landing a decisive hit before the boss can recover). At a neutral matchup, Surge+neutral (×1.5) is strictly less efficient than two unamplified neutral hits across two turns — the charm's value emerges specifically when combined with a favorable type matchup (Surge+SE = ×3.0 total), or when minimizing total hits taken against a hard-hitting enemy.

| # | Name | Type | Rarity | Max stack |
|---|------|------|--------|-----------|
| 7 | **Stormveil** | Storm | Common | 3 |
| 8 | **Battlebrand** | War | Common | 3 |
| 9 | **Shadowblur** | Trickery | Common | 3 |
| 10 | **Pale Ash** | Underworld | Common | 3 |
| 11 | **Brinestone** | Sea | Common | 3 |
| 12 | **Clearsight** | Wisdom | Common | 3 |

**Flavor:**
- *Stormveil:* "Charge the air around your next strike. Something vast will answer."
- *Battlebrand:* "Mark yourself for war. The next blow strikes with a conqueror's weight."
- *Shadowblur:* "Blur the line between you and shadow. Your next move blurs with it."
- *Pale Ash:* "Ash from the cold dark below. Your next strike carries its chill."
- *Brinestone:* "A sea-smoothed stone, still damp. The depths speak through it."
- *Clearsight:* "Clarity you hold for a moment. Long enough for one precise strike."

#### Breach Charms — Override Enemy Type Resistance

**Effect:** The enemy's **next incoming hit** of the specified type is treated as **super-effective (×2.0)**, regardless of that type's natural relationship to the enemy. If the enemy is already weak to that type (the matchup is already ×2.0), the Breach charm has no additional effect — it cannot stack type multipliers beyond ×2.0.

In formula terms, Breach forces `TypeMultiplier = 2.0` for the qualifying hit, overriding the chart value.

**Tactical profile:** Breach charms are most effective against type-resistant enemies (natural ×0.5), where they flip the matchup from a 4× damage deficit to a 4× damage advantage — the largest single-item swing available (e.g., ×0.5 → ×2.0 against a resistant enemy is a 4× shift in absolute damage). Against neutral enemies, Breach is equivalent to naturally having SE, which is worthwhile but not as decisive. Against already-weak enemies, Breach is wasted — it doesn't stack.

| # | Name | Type | Rarity | Max stack |
|---|------|------|--------|-----------|
| 13 | **Thundercrack** | Storm | Uncommon | 3 |
| 14 | **Warhex** | War | Uncommon | 3 |
| 15 | **Shadowbind** | Trickery | Uncommon | 3 |
| 16 | **Gravemark** | Underworld | Uncommon | 3 |
| 17 | **Undertow** | Sea | Uncommon | 3 |
| 18 | **Blindveil** | Wisdom | Uncommon | 3 |

**Flavor:**
- *Thundercrack:* "Pressed to the enemy's path. The sky's wrath will find them."
- *Warhex:* "A battlefield curse. Whatever hits them next will hit them harder."
- *Shadowbind:* "Their senses blur. They won't see the strike they should have."
- *Gravemark:* "The mark of the cold dark. It opens what should have stayed closed."
- *Undertow:* "Set loose in the current beneath them. The tide will pull them down."
- *Blindveil:* "A veil over their sight. What follows passes through unimpeded."

#### Damage ceiling check

The maximum damage achievable through item use in a single hit is **Surge + SE = ×3.0** (base damage × 1.5 Surge × 2.0 SE type multiplier). This matches the Rend + SE ceiling from Section 3. Crucially, reaching this ceiling through items requires two separate turn investments (one turn to apply the Breach charm, one turn to apply a Surge charm, then the attack) — making it a 3-turn setup impractical in most 2–5 turn fights. It remains achievable against prolonged boss encounters, which is the intended design: items should matter most when fights are hardest.

---

## 3. In-Battle Item Rules

- **One item per turn.** Using an item is a full-round action replacing Attack or Skill. No combining items with other actions in the same round.
- **Items are consumed on use**, immediately and without condition. An item used on a round where the Traverser is KO'd before acting is still consumed.
- **Turn order:** item use resolves on the Traverser's normal Stride-determined turn, same as any other action.
- **Healing items in battle:** Vigor is restored immediately when the item is used, before the enemy's action resolves that round (if the Traverser acts first).
- **Buff and charm effects:** resolve per the timing rules in Sections 2.3 and 3.3 (inherited from gear effect vocabulary). The effect persists until resolved by the qualifying trigger — a Fortify persists until the Traverser is hit, even if that's multiple rounds later.
- **No inventory access outside the player's turn.** Items cannot be used reactively to an incoming hit.

---

## 4. Out-of-Battle Item Use

**Healing items only** (Traveler's Salve, Herald's Draft, Ambrosia Shard) can be used from the inventory screen between encounters to recover Vigor passively. This supplements the existing passive regen (1%/10 min from Section 2) when a player wants to top up before a known-tough fight.

Buff items and Type Charms are locked to battle use — the UI should grey them out in the inventory screen with a brief tooltip explaining they require an active battle to function.

---

## 5. Inventory System

### 5.1 Capacity

**20 item slots total.** Each slot holds **one individual item** (not a stack) — if the player carries 5 Traveler's Salves, those occupy 5 of their 20 slots. This keeps the inventory model simple (a flat list of items, not a stack-and-count system) and creates real trade-offs between healing depth and charm breadth.

**Per-type maximum** (enforced at acquisition, not at use):

| Category | Max per item type |
|---|---|
| Healing items | 5 |
| Buff items | 3 |
| Type Charms (Surge) | 3 |
| Type Charms (Breach) | 3 |

A player who maximizes all 18 item types would need 5+5+5+3+3+3+3×6+3×6 = 15+9+18+18 = 60 slots — far beyond the 20-slot cap. In practice, players hold a curated selection reflecting their playstyle and current zone.

### 5.2 Overflow

When a milestone, boss drop, or battle drop would push inventory above 20 slots:
- The player is presented with the new item and prompted to **keep it (drop another item)** or **discard it**. No item is ever silently lost without player acknowledgment.
- Items already at their per-type maximum are simply not dropped by the acquisition systems (a player with 5 Salves will not receive another Salve from a battle drop until they fall below 5).

### 5.3 Naming convention note

All item names follow Section 3's mythology-flavored convention: no proper deity names, tonal register matched to type (for charms), speakable aloud. Healing and buff items draw from the Old Roads/traveler register (Salve, Draft, Tincture, Oil, Omen) rather than a deity-domain register, keeping their identity distinct from the typed charm names.

---

## 6. Acquisition

Items are acquired through three sources, all tied to real-world activity.

### 6.1 Battle Drops

The primary day-to-day source. Items can drop alongside gear (Section 8) — both systems resolve independently on the same encounter outcome.

| Encounter type | Drop chance | Drop quantity | Item tier |
|---|---|---|---|
| Regular wild encounter | 35% | 1 item | Common only (Traveler's Salve, any Surge charm) |
| Mini-boss (zone milestone encounter) | 75% | 1–2 items | Common or Uncommon |
| Zone boss | 100% (guaranteed) | 2–3 items | Any tier; first kill includes at least 1 Rare |

Specific items dropped by mini-bosses and bosses are defined in Sections 5–7 (Enemy/Boss Rosters) as part of each enemy's drop table. The rates above define the structure; the content is per-enemy.

**Drop pool for regular encounters:** Traveler's Salve and all six Surge charms are in the common drop pool, weighted roughly equally. Breach charms, Herald's Draft, buff items, and Ambrosia Shard do not drop from regular encounters — they require mini-boss drops, milestone rewards, or boss kills.

**Per-enemy pool restrictions (defined in Sections 5–7):** Each wild encounter type may be assigned a thematic subset of the common pool rather than drawing from all seven items equally. Where specified, those per-enemy restrictions take precedence over the full pool above. All per-enemy wild encounter pools must draw exclusively from the Common tier (Traveler's Salve and Surge Charms only).

### 6.2 Daily Step Goal Reward

**Trigger:** Reaching the player's daily step goal (configurable, defaulting to 7,000 steps — the average active user baseline from Section 1) rewards **1 common-tier item**, drawn from the same pool as regular battle drops (Traveler's Salve or a random Surge charm). Awarded once per calendar day, collected from the main screen when the app is opened after the goal is reached.

**Thematic framing:** Walking the Old Roads rewards you with things found along the way. The item is presented as a "road find" — a brief in-UI moment acknowledging the player hit their goal, not just a silent inventory increment.

This source produces approximately 5–7 items per week for an average user (hitting the goal 5–7 days out of 7), making it the second-largest item source after battle drops.

**Economy model:**

| Profile | Battle drops/week | Step goal items/week | Total items/week |
|---|---|---|---|
| Average user (2 enc/day, 5/7 goal days) | ~4.9 | ~5 | **~10** |
| Highly active user (4 enc/day, 7/7 goal days) | ~9.8 | ~7 | **~17** |

At these rates, a 20-slot inventory fills in roughly 1–2 weeks of consistent play if items are never used — providing meaningful inventory pressure without the scarcity that would discourage engagement. Players who use items regularly will find the acquisition rate comfortably replenishing.

### 6.3 Milestone Rewards

Fixed item grants awarded at specific progression events. Unlike drops, milestone rewards are deterministic — the player always receives the specified item.

| Milestone | Items awarded |
|---|---|
| Level 10, 20, 30, 40, 50, 60 | 1 Uncommon item, fixed per level — each matched to the next boss challenge on the road: **L10 Ironhide Tincture** (Fortify — Cerberus is the game's first item-management fight), **L20 Sunder Oil** (Weaken — blunts Fenrir's acts-first pressure), **L30 Warhex** (War Breach — forces Warlord's Advance to 2× vs. Jörmungandr, a second SE lever alongside the fresh Pale Sentence unlock), **L40 Ironhide Tincture** (Griffin is the game's longest sustained boss fight), **L50 Thundercrack** (Storm Breach — a pre-L44 fallback lever vs. Cacus for players still racing to Sage's Verdict), **L60 Sunder Oil** (endgame boss-farming utility) |
| Zone boss first kill | 2–3 items including 1 Rare (see Sections 5–7 for specifics) |
| Zone unlock (first entry to Valheon, Imperion) | 1 Herald's Draft + 2 Breach charms targeting that zone's genuine SE gaps — wild-encounter types for Valheon (Thundercrack + Shadowbind, Section 6 §5), boss fights for Imperion (Undertow + Blindveil, Section 7 §5, a documented deliberate deviation) |
| Tutorial completion | 3 Traveler's Salves — ensures the player has immediate familiarity with the healing mechanic |

Milestone rewards are not subject to inventory cap blocking — they always deliver. If the player is at inventory capacity, the overflow prompt (Section 5.2) fires after the milestone screen.

---

## 7. Cross-Section Flags

- **Section 2 (Combat) — Item action confirmed and fully specified.** The Item action defined in Section 2's turn structure is now complete. The Vigor restoration concern flagged in Section 2 (items not undermining the rest-day pacing) is addressed: Ambrosia Shard's rarity cap (max 2, milestone-only) prevents routine full-restore abuse, and the percentage-based healing model keeps items in their intended role as fight extenders rather than reset buttons.
- **Section 2 (Combat) — Buff effect vocabulary inherited.** Ironhide Tincture (Fortify), Sunder Oil (Weaken), and Fleet Omen (Swift) resolve identically to their gear-move counterparts. No new effect resolution rules introduced here — both systems draw from the same vocabulary.
- **Sections 5–7 (Enemy/Boss Rosters): FULFILLED.** All three zones' drop tables are complete, assigning specific items within the rate structure above for every mini-boss and zone boss. Zone unlock rewards were supplied with zone-specific Breach charm types for both Valheon (Thundercrack, Shadowbind) and Imperion (Undertow, Blindveil) — the latter deliberately targeting the zone's boss-fight SE gaps rather than its wild-encounter types, since Imperion's wild encounters had no gap left to fill by the time the zone was designed.
- **Section 8 (Gear & Loot Tables):** Battle drops can yield both an item and a gear piece from the same encounter — the two economies resolve independently. Section 8 should confirm this doesn't produce runaway combined drop rates that undermine either system's scarcity. Suggested approach: item and gear rolls are separate dice; winning an encounter rolls each independently.
- **Section 9 (Overworld Map / Step Tracking):** The daily step goal reward (Section 6.2) requires a hook in the step-tracking system to flag when the daily goal is reached and queue the item reward for collection on next app open. The step goal threshold (default 7,000) should use the same baseline established in Section 1.
- **Section 10 (Onboarding):** Tutorial completion grants 3 Traveler's Salves (Section 6.3). The tutorial battle should demo the Item action (using a Salve) on a safe scripted encounter — ideally after taking a couple of hits to make the heal feel impactful. Type charm mechanics (Surge/Breach) should receive a brief in-UI tutorial moment when the first charm drops, analogous to the type system tooltip planned for first Divine move use.
- **Section 13 (UI Architecture): FULFILLED.** Inventory screen with 20 individual item slots, battle-only greyout with lock indicator, the overflow keep/discard prompt, and the road-find moment are all delivered in Section 13 §5.2.
- **Daily encounter cap (flagged in Sections 1 and 2, still unhoused):** The item economy model assumes 2–4 encounters per day. Once the encounter cap is defined, the 35% battle drop rate should be revisited to confirm the weekly item supply stays within the intended range.

---

## 8. Open Questions

- **Step goal threshold for daily reward:** ~~confirm whether the reward should use the player's custom goal or a fixed platform threshold — a custom goal could be gamed by setting a trivially low target.~~ **CLOSED — resolved in Section 11 §2.1.** The reward uses the player's configurable personal goal (default 7,000 steps), with a hard floor of **3,000 steps** enforced by the app — closing the gaming concern without sacrificing personalization. (An earlier draft of this bullet said "minimum 7,000"; 3,000 is the locked floor per Section 11.)
- **Repeat boss drops:** ~~zone bosses are guaranteed 2–3 items on first kill. Should repeat boss encounters (if the player re-enters a boss room) drop items at all, at reduced rates, or not at all? This needs resolving in Sections 5–7 before boss encounter design is finalized.~~ **CLOSED — resolved in Section 5, reaffirmed in Sections 6 and 7.** Repeat boss kills drop at 75% chance, Common/Uncommon only, no Rares — applied consistently across all six bosses in the base game (Cyclops, Cerberus, Fenrir, Jörmungandr, Griffin, Cacus) with no exceptions.
- **Surge + Breach simultaneous use:** ~~a player could spend two separate turns applying a Breach charm and a Surge charm before attacking, achieving ×3.0 total damage — the same ceiling as Rend+SE from Section 3. This is intentional and the action economy cost (3 turns of setup) keeps it impractical in most fights. Confirm acceptable once enemy Vigor values from Sections 5–7 are known.~~ **CLOSED — confirmed acceptable.** With all three zones' enemy Vigor values now known (Section 7), the ×3.0 ceiling never approaches one-shotting even the squishiest wild encounter, let alone a boss. The 3-turn setup cost keeps it firmly non-exploitable in practice.
- **Out-of-battle charm use edge case:** this section rules Buff items and Type Charms as battle-only. If a future zone or mechanic introduces a non-battle use case for a charm (e.g., a puzzle or environmental interaction), that's additive and doesn't require changing these rules — worth flagging as a design space for Section 12 (Story & Lore) if relevant. **Reviewed and deliberately deferred by Section 12 §10** — no such mechanic exists yet, so there is nothing to narratively hook into; revisit only if a future mechanic introduces one.
