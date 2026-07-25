# Traverser GDD — Section 13: UI & Screen Architecture

## 1. Overview

This section defines the full screen list, navigation structure, and screen-by-screen layout for Traverser's main app (post-onboarding), plus the reusable component library that every prior locked section has been quietly accumulating flags against. Sections 3, 4, 6, 7, 8, 9, 10, 11, and 12 all pointed here — this is the first session where those flags get built rather than deferred, so §9 below traces every one of them explicitly.

**Design philosophy — consolidate, don't proliferate.** The planning doc calls for "simple choices... without deep, time-consuming menus." Every screen-count decision below defaults toward folding related content into shared screens with sub-tabs rather than adding new top-level navigation destinations, matching the same instinct Section 11 used to avoid a fifth notification type and Section 3 used to cap the loadout at 4 Skills.

**MVP framing carried forward.** Per the planning doc, Character/Avatar and Stats & Activity Log are the two MVP-priority screens; the Map is a placeholder until Section 9's full Road system activates. This section specs the **target-state** app (all systems live), consistent with how Sections 9 and 10 handled the same MVP/target split — Section 10 already defined exactly which subset ships at first launch, so that scoping isn't repeated here.

---

## 2. Navigation Architecture

### 2.1 Structure: 3-tab bottom bar + contextual overlays

| Tab | Icon concept | Default landing |
|---|---|---|
| **Character** | Traverser silhouette | Yes — first screen after onboarding (Section 10 §2, Screen 11) |
| **Map** | Road/compass | No |
| **Inventory** | Satchel/pack | No |

**Rationale for 3, not more.** A Stats screen, an Equip screen, a battle-item Inventory screen, and a Bestiary screen were each independently flagged by earlier sections (Sections 4, 8, 12, plus the planning doc's own Stats & Activity Log priority). Four additional top-level tabs would push total nav past what "simple, lightweight" supports on a phone-sized tab bar (5 is the practical ceiling before icons crowd). Instead, **Character** and **Inventory** each become a single tab hosting multiple sub-views — detailed in §3 and §5. This is the same consolidation logic Section 11 used when it decided the Rest Day control and streak display both live on the Character screen rather than spawning a separate "Engagement" tab.

**Battle is not a tab.** Battle is always contextual — triggered by tapping an available node on the Map (mid-boss/final-boss gate), by a wild-encounter checkpoint firing during the Map's sync animation (Section 9 §5), or by the Explore action on a revisited zone segment. It opens as a full-screen modal over whatever screen the player was on, and returns to that same screen on battle end. This matches the planning doc's framing of combat as an event that interrupts the walk, not a menu you open on demand.

**Settings is not a tab.** A small gear icon in the Character screen's top-right corner opens Settings (§7) as a pushed screen, not a bottom-tab destination — it's low-frequency enough (permissions, step-goal configuration, sign-in status, notification preferences) that it doesn't warrant permanent nav real estate.

### 2.2 Screen inventory (full list)

| # | Screen | Tab / entry point | Locked section(s) driving content |
|---|---|---|---|
| 1 | Character — Avatar | Character tab (default sub-view) | Planning doc, Sections 8, 11 |
| 2 | Character — Stats & Activity Log | Character tab (sub-tab) | Section 1, planning doc |
| 3 | Map | Map tab | Section 9 |
| 4 | Boss Gate Detail | Pushed from Map (tap a Gate node) | Sections 5–8 |
| 5 | Battle | Modal, contextual trigger | Sections 2, 3, 4, 12 |
| 6 | Inventory — Gear (Equip) | Inventory tab (default sub-view) | Section 8 |
| 7 | Inventory — Items | Inventory tab (sub-tab) | Section 4 |
| 8 | Inventory — Bestiary | Inventory tab (sub-tab) | Section 12 |
| 9 | Zone Entry Narrative | Full-screen overlay, auto-fires on zone entry | Section 12 |
| 10 | Settings | Pushed from Character screen's gear icon | Section 10, planning doc |

Ten screens total for the target-state app — small enough to hold in one diagram, consistent with "no padding" scope discipline.

---

## 3. Character Tab

### 3.1 Avatar sub-view (default landing screen)

The MVP-priority screen per the planning doc. Layout, top to bottom:

- **Traverser sprite**, rendered with currently equipped gear overlays (Weapon/Armor/Accessory/Trinket per Section 8's layered-silhouette art pipeline) — this is the single place in the app where gear visibly changes the character's appearance, fulfilling the planning doc's "avatar progression" principle.
- **Level & XP bar** — current level, XP toward next level (Section 1's formula), a thin progress bar rather than a raw number to keep the read glanceable.
- **Streak display** — a compact badge (flame/road-mile icon + day count, e.g., "🔥 14"), tapping it opens a small popover showing the streak milestone track (Section 11 §5) with the next reward previewed and current progress toward it.
- **Rest Day control** — a single tappable button, "Tag today as a Rest Day." Tapping opens a one-line confirmation ("Rest tagged. [Name]'s strength returns."), matching Section 11 §3.1's toast copy exactly. If today is already tagged, the button shows a checked/disabled state with the same copy. No cap or friction beyond this single tap, per Section 11's explicit "unlimited, trust-based" design.
- **Health permission banner (conditional)** — only rendered if permission was denied at onboarding (Section 10 §3.2): *"Enable activity access to start earning real XP — the road is waiting."* Tapping deep-links to OS settings. Disappears permanently once permission is granted.
- **Overactivity warning banner (conditional, transient)** — see §6.4. Renders here specifically when it fires while the Character tab is frontmost; see §6.4 for the general rendering rule across screens.
- **Sub-tab switcher** to Stats & Activity Log.

### 3.2 Stats & Activity Log sub-view

The second MVP-priority screen. Two stacked sections:

- **Stat allocation panel** — the six stats (Vigor, Might, Resolve, Favor, Aegis, Stride) with current values and an "unspent points" indicator when a level-up has granted the flat +3 (Section 1) that hasn't been allocated yet. Allocation is a simple stepper per stat (+/− before confirming, since Section 1 doesn't specify respec rules — treated as permanent once confirmed, consistent with no stated respec mechanic anywhere in the locked GDD).
- **Activity log** — a reverse-chronological daily list: date, steps, HR-tier minutes breakdown, XP earned that day (split Step XP / HR XP / Battle XP per Section 1's three sources), and a Rest Day tag indicator if applicable. This is the log the planning doc calls out by name as an MVP priority, and it's also where a player can visually confirm the Automatic Sync Grace (Section 11 §3.2) actually credited a day it looks like they missed.

---

## 4. Map Screen

Implements Section 9's full spec directly; this section resolves the two items Section 9 explicitly deferred here.

### 4.1 Road orientation — decision: vertical, bottom-to-top scroll

**Recommendation: vertical scrolling, Road climbing upward, Waymarker anchored near the bottom of the viewport with the unexplored Road extending above.** Two reasons: (1) phone screens are taller than wide, so a vertical Road uses the available viewport far more efficiently than a horizontal one that would need constant panning; (2) an *upward* climb reinforces the game's own mortal-to-divine framing (Section 8's gear tier arc, the "Old Roads... stirring again" ascension language from Section 10's story intro) — walking the Road is visually walking toward something higher, not just sideways. This mirrors the vertical-climb pattern already familiar from other mobile RPGs, so it costs nothing in player onboarding.

### 4.2 Screen layout

- **Road rendering** (Section 9 §4.1): three zone segments, each a fixed proportional share of vertical space regardless of underlying League count, with a lit/unlit texture fill showing real progress within that segment.
- **Nodes** (Section 9 §4.2): Zone Entry (cosmetic), Mid-boss Gate (soft gate, tappable once available), Final-boss Gate (hard gate, blocks further scroll-reveal past it until defeated), Zone Terminus (locked "coming soon" marker past Cacus).
- **Node visual states** (closes Section 9's flag on how locked/greyed nodes are communicated): **Locked** — desaturated grey silhouette, no tap response beyond the "Reach [N] Leagues" tooltip (§4.3). **Available** — full color with a slow pulsing glow, signaling "action wanted" without being alarming. **Defeated** — full color, static (no glow), with a small checkmark badge overlaid on the node icon. This three-state treatment applies uniformly to both Mid-boss and Final-boss Gate nodes.
- **Waymarker**: the Traverser sprite (same base sprite as the Character screen's Avatar view, gear overlays included) sitting at the current frontier, or wherever the Viewport has scrolled per Section 9 §4.3.
- **League counter**: fixed header strip, "*[current] / [next gate threshold] Leagues to [Gate name]*" (Section 9's exact wording).
- **Return to the Road** button: floating action button, bottom-right, enabled only when the Viewport isn't already centered on the Waymarker.
- **Explore** button: floating action button, bottom-left, enabled only when the Viewport is centered on a previously-unlocked (already-passed) zone segment — triggers a manual wild-encounter roll against that zone's roster (Section 9 §4.3).
- **Zone name banner**: top strip, updates live as the Viewport scrolls past segment boundaries.

### 4.3 Boss Gate Detail screen (new, resolves Section 8's Trinket-surfacing flag)

Tapping any Gate node (mid-boss or final-boss, locked or available) pushes a detail screen rather than starting the fight immediately — this is also where an as-yet-undefeated boss's reward is surfaced ahead of time:

- Boss name, sprite, and type (once discovered — see bestiary interaction note below).
- **For final-boss gates only:** a "Trinket Reward" panel showing the zone's Trinket name and flavor line (Section 8 §5.2/§4.3), with a **silhouette icon at Divine tier and the tier ladder (Heroic → Mythic → Divine) shown as a locked progression track** until first kill, after which it displays normally. This directly resolves Section 8's flag: *"surface which Trinket a zone boss will drop before first kill, so exploring players understand what they're working toward."* Mid-boss gates show only the Heroic Sigil name/flavor (no move, per Section 8 §5.2 — no progression track needed since there's only one tier).
- A single **"Begin Battle"** CTA (disabled with a tooltip, *"Reach [N] Leagues to challenge this gate,"* if the gate is still locked).

### 4.4 Zone Entry Narrative overlay

Fires automatically the first time the Waymarker's forward sync animation crosses into Valheon or Imperion (Section 12 §2). Full-bleed, tap-to-advance, 3–4 screens, using the same illustration-behind-text component as Section 10's onboarding story intro (Section 12 explicitly calls for this visual consistency). Skippable on any viewing after the first via a "Skip" tap target that appears only on repeat entry (Viewport-scroll re-visits do not re-trigger this — it's a one-time-per-zone event keyed to the Waymarker's forward crossing, not to viewing the segment).

---

## 5. Inventory Tab

Three sub-tabs sharing one top-level destination, resolving Section 8's "distinct from the battle-item inventory" flag not by separating navigation (which would cost a second tab) but by separating *interaction pattern* within a single screen family — gear is equip/compare, items are consume/manage, bestiary is browse/read. A segmented control at the top of the screen switches between them; the switch itself carries no state loss (all three sub-tabs stay mounted).

### 5.1 Gear (default sub-tab)

- **Four equip slots** (Weapon, Armor, Accessory, Trinket) shown as a fixed row, each populated with the currently equipped item's icon and tier-colored border (Mortal/Heroic/Mythic/Divine, per Section 8's tier-color convention — exact palette is an art-phase decision).
- Tapping a slot opens a **comparison view**: currently equipped item's stats side-by-side with each held item of that slot, sorted by tier descending. Differences are highlighted (+/− per stat) rather than requiring mental math — directly resolves Section 8's flag for "gear comparison view (current vs. held)."
- **Trinket slot specifically** shows a small zone-icon badge (Olympion/Valheon/Imperion) so a player with multiple zone Trinkets can tell at a glance which pantheon's identity they're currently wearing, since only one Trinket can be equipped at a time despite three existing by end-game.
- **Overflow keep/discard prompt** (Section 8 §5.5): a modal that interrupts navigation the moment a gear pickup would exceed the 12-slot cap (4 equipped + 8 reserve, per Section 8) — shows the new item against the fullest/lowest-value existing item as a suggested discard, but the player can pick any slot to clear or discard the new item instead. Never resolves silently.

### 5.2 Items

- **20-slot grid** (Section 4 §5.1), each slot a single item (not stacked-with-count) — a player holding 5 Traveler's Salves sees 5 identical tiles.
- Category filter chips at the top: All / Healing / Buffs / Charms — the 18-item roster across 4 categories benefits from a filter once a player has accumulated variety.
- **Battle-only items (Buffs, Surge Charms, Breach Charms) render greyed out with a lock icon when viewed outside of battle**, with a tap-tooltip: *"Requires an active battle."* (Section 4 §4, explicitly flagged to this section.)
- Same overflow keep/discard modal pattern as Gear (§5.1), reused rather than redesigned — one component, two data sources.
- **Road-find pickup moment**: when the daily step-goal item reward (Section 4 §6.2) is ready for collection, a small badge appears on the Inventory tab icon; opening Items shows the new item with a brief highlight animation and the flavor framing *"Found along the road."* This is a lightweight version of the Reveal Card component (§6.3) rather than a full modal, since it's a routine daily event rather than a milestone.

### 5.3 Bestiary (resolves Section 12's open question)

**Decision: folds into the Inventory tab as a third sub-tab, rather than becoming a standalone screen.** Section 12 explicitly left this open, suggesting the Equip/Inventory screen as one option. A standalone fourth tab would break the 3-tab structure (§2.1) for a screen that's read-only and low-frequency (viewed on-demand, not part of the daily loop); folding it into Inventory keeps it discoverable without new navigation, and it shares the same "catalog of things you've found" conceptual frame as Gear and Items.

- **Grid of all 6 wild encounters** (Harpy, Satyr, Draugr, Valkyrie, Strix, Lemures) **plus all 6 bosses** (Cyclops, Cerberus, Fenrir, Jörmungandr, Griffin, Cacus), grouped by zone with zone headers — matching Section 12 §8's own zone-grouping structure.
- Undiscovered entries render as a silhouette with "???" — discovered on first sighting (wild) or first battle start (bosses, since boss intro dialogue is the discovery trigger).
- Tapping a discovered entry opens its bestiary flavor text (wild encounters, Section 12 §8) or a combined intro/defeat-text readout (bosses, Section 12 §5–7) — view-on-demand, matching Section 12's requirement exactly.
- Each entry also shows the enemy's **type icon**, doubling as a lightweight reference for players trying to recall a matchup outside of battle (complements, but doesn't replace, the in-battle indicator in §6.2).

---

## 6. Battle Screen

### 6.1 Core layout

- **Enemy panel** (top): sprite, name, **type icon** (shown from the start of the first battle — the encounter itself is the Bestiary's discovery trigger per §5.3; the type icon reveals *what* the enemy is without revealing effectiveness, which stays gated behind §6.2's second-encounter chevron rule), and Vigor bar (percentage-based display, not raw numbers — enemy max Vigor isn't meaningful info to expose raw per Section 2's stat design). **No enemy level indicator** — enemy level always equals player level (Section 5's scaling rule), so displaying it would be redundant noise. This closes Section 5's flagged question on whether the battle screen shows a level indicator: it doesn't; name, type, and Vigor only.
- **Player panel** (bottom, above the action menu): Traverser sprite, Vigor bar with raw current/max numbers (the player's own Vigor pool is meaningful to track precisely, unlike the enemy's).
- **Compact combat log**: a 2–3 line scrolling text feed above the action menu ("Thunderer's Wrath — Super Effective! 26 damage."), giving the player a persistent record within the fight without needing a full-screen combat report.
- **Action menu**: four buttons — **Attack, Skill, Item, Flee** — always in this fixed order and position (spatial consistency reduces menu-scanning time, matching "quick, scannable" from Section 2).

### 6.2 Type-effectiveness indicator (resolves the Section 6/7/12 flag, raised three times)

Two complementary surfaces, addressing both *before* and *after* the fact:

- **Pre-selection hint:** when the Skill sub-menu is open, each typed move shows a small colored chevron next to its type icon — green double-chevron (▲▲, 2×), grey single dash (–, 1×/neutral), red single chevron (▽, 0.5×) — computed against the *current target's* known type. This hint is withheld during a player's first-ever battle against a given enemy type and becomes available starting with that enemy's second encounter onward. This is a distinct, later-firing trigger than Bestiary discovery (§5.3), which unlocks on first *sighting* — the enemy is visible and named in the Bestiary immediately, but the chevron hint specifically requires having already *fought* it once, preserving some discovery tension on the first real fight without leaving the Bestiary entry itself gated on the same condition. This directly targets Section 7's flagged risk of "explaining why a fight is hard" without duplicating Section 12's narrative role.
- **Post-hit callout:** the combat log line and a brief floating text overlay on the enemy sprite read **"Super Effective!"** (2×), nothing extra (1×, no callout needed — silence is itself informative), or **"Resisted..."** (0.5×) — standard JRPG-familiar language.
- **Direction disambiguation:** both surfaces always frame the match as **"[Move Type] vs. [Enemy Type]"** in the underlying tooltip-on-long-press, never just "Sea" or "Wisdom" alone — this directly answers Section 7's flag that the same two types (Sea/Wisdom) produce opposite outcomes depending on attacker/defender direction, so the UI must never leave that ambiguous.

### 6.3 Reveal Card component (loot, level-up, milestones)

A shared full-width card component, used for: post-battle loot reveal (items + gear drops, Section 4/8), level-up (stat points available, Section 1), and streak milestones (Section 11 §5, gear reward). Structure: icon/sprite, name, rarity-tier color border, one line of flavor text where applicable (gear/Trinket flavor text, Section 8), a single "Continue" tap target. Reused rather than bespoke per-source, since all three are structurally "here's what you got" moments.

### 6.4 Overlay & tooltip inventory (inherited components, all confirmed here)

| Component | Source section | Trigger |
|---|---|---|
| Skill-locked tooltip | Section 10 §6.4 | Tapping a greyed-out Skill button before its unlock level |
| Flee-locked tooltip | Section 10 §6.4 | Tapping Flee during a non-fleeable boss fight |
| Secondary-effect tooltip | Section 3 (routed via Section 10 §9) | First time a Divine move with Weaken/Fortify/Swift/Rend is available to use |
| Type-system intro tooltip | Section 10 §7.2 | One-time, Level 6, before the next battle |
| Boss intro dialogue overlay | Section 12 §5–7 | Any mid- or final-boss battle start, 1–3 lines, tap-to-continue |
| Boss defeat text overlay | Section 12 §5–7 | Any boss defeat, first-kill (2–3 lines) or repeat-kill (1 line) variant |

All six share one underlying **Tooltip/Overlay component** with two size variants (inline tooltip vs. full dialogue box) rather than six bespoke implementations — inline tooltips are small anchored bubbles near the relevant UI element; dialogue overlays are bottom-third text boxes over the battle background, matching the visual register Section 12 specifies for boss dialogue.

### 6.5 Overactivity warning — rendering rule

Per Section 11 §8, the trigger logic fires at sync time (app open/foreground), which may land the player on *any* screen depending on what they had open when they last backgrounded the app. Rendering rule: the warning is a **dismissible top-of-screen banner**, using the same banner component as the Character screen's permission-denied banner (§3.1), rendered on whichever screen is frontmost at the moment sync completes. It never interrupts an in-progress battle (sync only happens on app foreground/open, and a battle in progress means the app was already open — so this case cannot occur in practice, consistent with Section 11's "never fires retroactively for a session never checked in during"). Copy is fixed per Section 11 §8.4: *"You've been at it a while — the road will still be here after you rest."*

---

## 7. Settings Screen

Pushed from the Character tab's gear icon. Not driven by any single locked section but necessary infrastructure implied across several (Section 10's OS-settings deep-link, Section 11's configurable step goal, planning doc's account architecture):

- **Account**: sign-in status (guest vs. signed-in), sign-in CTA if guest (reuses the same bottom-sheet component from Section 10 §8.2 / Section 11 §7.3's resurfacing cadence — this screen is simply another entry point to the same component, not a new one).
- **Daily step goal**: current value, editable, hard floor of 3,000 enforced with Section 11 §2.1's exact gentle-nudge copy if set at the floor.
- **Health & Activity permission**: status + deep-link to OS settings if not granted.
- **Notifications**: OS permission status + deep-link; no in-app copy/timing controls are exposed here since Section 11's notification logic is fully automatic, not player-configurable.
- **Wearable connections** (Apple Watch / Fitbit / Garmin): configured here per Section 10 §3.1's note that these are deliberately not requested at first launch.
- **Audio**: two independent sliders — **Music** (zone ambient tracks, battle themes) and **Sound Effects** (UI taps, combat hits, stings/cues) — plus a single **Mute All** toggle. Split into two controls rather than one master volume because a player may want combat-hit feedback without ambient music (e.g., playing in a quiet public space) or vice versa. Exact track list and per-cue assignment belong to Section 14 (Sound Design); this entry only reserves the control surface, since the planning doc treats audio as a stated priority, not an afterthought, and the Settings screen would otherwise have no home for it at all.

---

## 8. Component Hierarchy Summary

A condensed reference for implementation planning — every reusable primitive introduced above, in one place:

| Component | Variants | Used by |
|---|---|---|
| **Tooltip/Overlay** | Inline bubble / full dialogue box | Skill-lock, Flee-lock, secondary-effect, type-intro, boss intro/defeat, zone entry narrative |
| **Banner** | Permission-denied, overactivity warning | Character screen (and wherever frontmost at sync time) |
| **Toast** | Rest Day confirmation, road-find pickup | Character screen, Inventory tab |
| **Reveal Card** | Loot, level-up, streak milestone | Battle screen (post-battle), Character screen (level-up), streak popover (milestone) |
| **Bottom-sheet** | Sign-in prompt | Onboarding Screen 9, first-backgrounding resurface, Settings, resurfacing cadence per Section 11 §7.3 |
| **Overflow keep/discard modal** | Gear, Items | Inventory tab (both sub-tabs) |
| **Comparison view** | Gear only | Inventory — Gear sub-tab |
| **Type-effectiveness chevron/callout** | Pre-selection, post-hit | Battle screen |

---

## 9. Cross-Section Flags — Resolution Trace

Every flag pointed at this section (Sections 3, 4, 5, 6, 7, 8, 9, 10, 11, 12) is addressed above; this table confirms each explicitly rather than leaving resolution implicit.

| Flag source | Flag | Resolved in |
|---|---|---|
| Section 3 | Secondary-effect tooltip | §6.4 |
| Section 4 | Inventory screen, 20 slots, battle-only greyout, overflow prompt, road-find moment | §5.2 |
| Section 5 | Battle-screen enemy level indicator — show or omit? | §6.1 (omitted — redundant since enemy level = player level; enemy panel shows name, type icon, and Vigor bar only) |
| Section 6 | Type-effectiveness indicator (Trickery/War, Wisdom/Sea non-obvious results) | §6.2 |
| Section 7 | Type-effectiveness indicator, attacker/defender direction disambiguation | §6.2 |
| Section 8 | Equip/Inventory screen distinct from item inventory; gear comparison view; Trinket surfaced before first kill | §5.1, §4.3 |
| Section 9 | Full Map screen spec; Road orientation decision | §4 |
| Section 10 | Skill-locked/Flee-locked tooltips as reusable components; overactivity warning component ownership; secondary-effect tooltip (confirmed, not duplicated) | §6.4 |
| Section 11 | Overactivity warning rendering; streak counter + milestone reveal; Rest Day tagging control; sign-in resurfacing bottom-sheet | §3.1, §6.3, §6.5, §8 |
| Section 12 | Zone entry narrative screens; boss dialogue overlays; bestiary/compendium screen (standalone vs. folded — decided) | §4.4, §6.4, §5.3 |

**No flag was left unaddressed.** Two items from Section 9 (Road orientation, exact rendering approach) were explicitly named as "an art/engineering call for Section 12/13" — both are decided in §4.1 with rationale rather than passed forward again, consistent with Matthew's stated preference for decisive recommendations over further deferral.

---

## 10. New Cross-Section Flags

- **Section 14 (Sound Design):** every component in §8 is a natural cue point — dialogue-box-open (shared by Tooltip/Overlay's full variant), Reveal Card presentation (loot/level-up/milestone — likely three volume/tone variants of one base sting), banner appearance (overactivity warning should stay deliberately quiet/non-alarming per its tone, distinct from the more celebratory Reveal Card sting), and the type-effectiveness post-hit callout (a short audio stinger distinct per Super Effective/Resisted, reinforcing the visual without needing to be read). Additionally, §7's Settings screen now reserves a two-slider **Music / Sound Effects** control surface (plus Mute All) — Section 14's full track and cue list should confirm every asset it defines cleanly falls into one of these two buckets, or flag back here if a third category turns out to be needed.
- **Section 15 (Analytics):** this section doesn't itself require new schema (Section 11 §9 and Section 12 §10 already cover the events these screens surface), but two screen-level view events are worth adding for UX-funnel visibility rather than gameplay measurement: `boss_gate_detail_viewed` (with `boss_id`, `trinket_revealed` bool) and `bestiary_screen_opened`. Optional — flagged as a nice-to-have, not required for the core retention/engagement analytics goals already defined.
- **Art phase (future, separate Claude Project):** the tier-color palette referenced in §5.1 (Mortal/Heroic/Mythic/Divine border colors) and the exact chevron/badge iconography for the type-effectiveness indicator (§6.2) are visual decisions this GDD section intentionally leaves as structural requirements rather than art direction — matching how Section 8 already handed off its layered-gear-overlay pipeline the same way.

---

## 11. Open Questions

- **Stat allocation respec:** §3.2 assumes stat point allocation is permanent once confirmed, since no locked section (including Section 1, which introduced the +3/level system) specifies a respec mechanic. If a respec system is wanted later (e.g., as a gold/currency sink once Section 8's flagged gear-salvage economy is designed), this section's stat panel would need an "unlock for respec" state added — not designed now since it would be speculative.
- **Combat log depth:** §6.1 specifies a 2–3 line scrolling feed with no stated history limit or full-log view. If playtesting shows players want to review a full battle's log after the fact (e.g., to understand a loss), a "View full log" expansion could be added to the post-battle Reveal Card — flagged as a possible polish item, not core to MVP.
- **Landscape/tablet layout:** this entire section assumes portrait phone orientation throughout (consistent with every prior section's phone-first framing and the vertical Road decision in §4.1). No tablet or landscape-mode layout is specified; out of scope unless the planning doc's platform targets expand.
