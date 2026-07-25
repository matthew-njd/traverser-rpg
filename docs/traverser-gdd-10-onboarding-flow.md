# Traverser GDD — Section 10: Onboarding Flow

## 1. Overview

This section specifies the first-launch experience: the exact screen sequence from app install to entering the main app loop, the permission request flow, account creation, and the scripted tutorial battle. Per the planning prompt's ordering, health/wearable permissions are requested immediately, before any story or UI; a brief story intro follows; a guaranteed-win tutorial battle teaches core combat safely before any random encounter can occur.

**Scope note:** This session covers first-launch flow, permissions, account creation, and the tutorial battle script only. The daily engagement loop (streak mechanic, grace-period logic, push notification copy/timing) is explicitly **out of scope** for this section per Matthew's direction — it remains an unhoused topic, tracked in Cross-Section Flags below, for a future dedicated session.

---

## 2. Screen-by-Screen Flow

| # | Screen | Purpose |
|---|---|---|
| 1 | Splash | Logo, load assets |
| 2 | Health & Activity Permission Request | HealthKit / Health Connect / wearable access — requested first, before any story |
| 2a | Permission Denied Fallback (conditional) | Graceful degradation path if denied |
| 3 | Story Intro (3–4 screens) | "The Old Roads" framing, the Traverser's role |
| 4 | Name Your Traverser | Text input, default name offered |
| 5 | Starting Loadout Reveal | Traveler's Blade equips, 3 Traveler's Salves granted |
| 6 | Tutorial Battle | Scripted, guaranteed-win — teaches Attack, Vigor, Item |
| 7 | Victory / Tutorial Complete | Battle XP awarded, brief acknowledgment |
| 8 | Placeholder Overworld Map | MVP-scoped map — Olympion entry node + Waymarker only |
| 9 | Save Your Progress | Sign-in prompt (Apple / Google / email), guest mode default |
| 10 | Notification Permission Request | OS-level prompt only — copy/timing strategy deferred (see §9) |
| 11 | → Main App | Lands on Character/Avatar screen (MVP primary screen, per planning doc) |

Total: **11 screens/steps**, roughly 2–4 minutes end to end for a player who reads the story screens, faster for one who taps through.

---

## 3. Permission Request Flow

### 3.1 Health & Activity Permissions (Screen 2)

Requested **immediately after the splash screen**, before any story content or UI chrome — matching the planning prompt's explicit ordering. A single short explanation screen precedes the native OS permission dialog:

> **"Traverser turns your steps and workouts into real progress."**
> We'll need access to your step count and heart rate to bring the road to life. Your health data never leaves your device — only summaries (like daily totals) sync to your Traverser profile.

CTA: **Continue** → triggers native HealthKit (iOS) / Health Connect (Android) permission dialog. Wearable-specific connections (Apple Watch, Fitbit, Garmin) are **not** requested at this stage — those are configured later from Settings, since requiring a paired wearable at first launch would block phone-only users from ever starting.

### 3.2 Permission Denied Fallback (Screen 2a)

If the player declines, the app does **not** hard-block progress — a fitness app that can't be opened without granting permissions immediately is a bad first impression and risks an uninstall before the player has seen any value.

- Onboarding continues normally through story and the tutorial battle (which doesn't depend on real step/HR data).
- A persistent, low-key banner appears on the main app's Character screen: *"Enable activity access to start earning real XP — the road is waiting."* Tapping it deep-links to OS settings.
- No XP accrues from steps/HR until permission is granted; Battle XP still functions normally (battles aren't gated on permission), so a permission-denied player can still fight — they just won't level up meaningfully until they grant access. This keeps the app usable rather than dead-ended, while making the missing value proposition obvious.

### 3.3 Notification Permission (Screen 10)

Requested **after** the tutorial battle and account prompt — not at first launch — since opt-in rates are consistently better once a player has already experienced value, and the planning doc's "immediately, before any story" ordering applies specifically to health permissions, not notifications. This screen triggers the OS-level permission dialog only; the actual notification copy, send-time strategy, and streak-tied logic are deferred (see §9).

---

## 4. Story Intro (Screen 3)

Three to four short screens, tap-to-advance, each a single sentence or two over a full-bleed illustration. Deeper lore is drip-fed later through zone transitions (Section 12, Story & Lore), so this intro stays brief — it establishes premise, not detail.

1. *"Long before memory, roads connected every realm — Olympion, Valheon, Imperion, and worlds beyond. They call it Omnivium: the realm of all roads."*
2. *"The roads went quiet. Overgrown. Forgotten."*
3. *"But every step you take in the world beyond this one echoes here — and the old roads are stirring again."*
4. *"You are the Traverser. Where you walk, the roads reopen."*

Not skippable on first launch (it's brief enough not to warrant it); skippable on any subsequent reinstall/replay via a "Skip" link that appears only if an existing account is detected during Screen 2's flow.

---

## 5. Starting Loadout (Screens 4–5)

### 5.1 Naming (Screen 4)

Simple text input, 20-character limit, default suggestion **"Traverser"** pre-filled so a player who doesn't care can just tap through. No character customization at this stage, consistent with the planning doc's fixed default appearance for v1.

### 5.2 Starting Gear & Items (Screen 5)

A short reveal screen, framed as the road provisioning the Traverser before their first steps:

- **Traveler's Blade** (Mortal Weapon) — auto-equipped. Grants the standard Mortal-tier bonus at Level 1: `round(0.05×1)+1 = 1` Might, bringing the Traverser to 11 Might. This is the first piece of gear a player sees equipped, establishing early that gear visibly matters (per the planning doc's avatar-progression principle) rather than introducing the system as a wall of text.
- **3× Traveler's Salve** — added to inventory (Section 4's tutorial-completion grant), available for use in the tutorial battle itself rather than withheld until after.

Armor and Accessory slots start empty — intentional, so the first Mortal Armor/Accessory drop (from the very first real wild encounter or step-goal roll) feels like an early, earned discovery rather than a pre-filled loadout.

---

## 6. Tutorial Battle (Screen 6)

### 6.1 Design approach: scripted determinism, not just favorable odds

A tutorial battle that merely uses very favorable stats can still — however rarely — go wrong on an unlucky roll (a string of enemy crits), which would undermine "guaranteed win" and could genuinely scare off a new player during the most fragile part of the funnel. To make the guarantee absolute rather than probabilistic, **this is the one fight in the game that bypasses Section 2's random factor and crit roll**: damage is calculated with the standard formula but with the random multiplier fixed at 1.0 and crit chance set to 0%. Every player sees the identical, predictable sequence below. This exception is scoped narrowly to this single scripted encounter and does not apply anywhere else, including repeat tutorial replays (there are none — this battle is one-time only).

### 6.2 Combatants

**The Traverser (Level 1):** Vigor 20, Might 11 (10 base + 1 from Traveler's Blade), all other stats at Level 1 baseline (Section 1).

**Waystone Wisp** (tutorial-exclusive, non-canon): A flickering echo of the road itself — not a creature from any zone's roster, and not typed for teaching purposes (it does not appear in Section 5's Olympion table or any drop table). This is deliberate: Harpy retains its role as the *first real* encounter that begins teaching type advantage (Section 5's combat arc). The Wisp exists only to teach Attack, Vigor, and Item use.
- Vigor 15, Favor 12, Stride 6 (below the Traverser's 10 — player always acts first, no tie roll needed)
- One fixed move: **"Chilling Gust"** — Divine category (Favor vs. Aegis), Power 30, no secondary effect. The Wisp has no type assignment (it's non-canon and outside the type chart entirely), which is separate from — and in addition to — Section 2's standing rule that enemy attacks never apply a TypeMultiplier against the player regardless of the enemy's type. Both facts point the same direction here, but only one of them (the deterministic random/crit override) is unique to this battle.

### 6.3 Verified damage values (deterministic mode)

| Action | Formula | Result |
|---|---|---|
| Traverser Basic Attack | floor((40 × 11) / (8 × 8)) | **6 damage**, every hit |
| Wisp's Chilling Gust | floor((30 × 12) / (10 × 8)) | **4 damage**, every hit |
| Traveler's Salve heal | round(0.20 × 20 max Vigor) | **4 Vigor**, every use |

### 6.4 Battle script

Only **Attack** and **Item** are available; **Skill** is visibly present but greyed out with tooltip *"Skills unlock at Level 4,"* and **Flee** is disabled with tooltip *"You can't flee this fight — it's perfectly safe."* This establishes the full UI chrome early without letting the player wander off-script.

| Round | Event | Enemy Vigor | Player Vigor |
|---|---|---|---|
| — | Start | 15 | 20 |
| 1 | Prompt: *"Tap Attack to strike first."* → Player attacks | 9 | 20 |
| 1 | Wisp uses Chilling Gust → Tooltip: *"That's your Vigor — it's your health. Keep an eye on it."* | 9 | 16 |
| 2 | Prompt: *"Attack again."* → Player attacks | 3 | 16 |
| 2 | Wisp uses Chilling Gust → Tooltip: *"Taken a couple of hits? Let's patch up — open your Items."* | 3 | 12 |
| 3 | Prompt guides player to open Items and use a Traveler's Salve → heals 4 | 3 | 16 |
| 3 | Wisp uses Chilling Gust | 3 | 12 |
| 4 | Prompt: *"Finish it!"* → Player attacks → Wisp defeated | 0 | 12 |

The player finishes at **12/20 Vigor (60%)** — low enough that the earlier heal visibly mattered, high enough that the fight never feels tense. Four rounds sits slightly above Section 2's normal 2–5 turn target band's low end by design, since the extra round is needed to demonstrate all three core actions (Attack, Vigor tracking, Item) without rushing any one of them.

### 6.5 Victory (Screen 7)

Standard Battle XP is awarded, no special-casing: `15 + (1 × 2) = 17 XP`. No item/gear roll — the Wisp isn't part of any drop table. Brief acknowledgment screen: *"The road remembers this. Onward."* → advances to the placeholder map.

---

## 7. Progressive Tutorial Moments (Post-Onboarding)

Section 3's cross-section flag explicitly assigned two further scripted moments to this section — unlike Screens 1–11 above, these fire naturally whenever the player reaches the relevant level in normal play, which may be hours or days after onboarding ends, not as part of the first-launch sequence itself. They're narrow, fully specified, one-time events, which is why they're covered here directly rather than deferred with the daily engagement loop.

### 7.1 Level 4 — First Skill Unlock

When Iron Advance unlocks, the Skill button (greyed out with a tooltip since the tutorial battle, §6.4) becomes active for the first time. The player's next battle — a normal, RNG-driven wild encounter, not another scripted fight — opens with a one-time tooltip:

> *"Iron Advance is ready — tap Skill to use it. It hits harder than a Basic Attack, but has limited uses per battle, so time it well."*

This is a passive unlock notification plus an in-battle tooltip only; no separate scripted encounter is created for it, since the tutorial battle already established the Attack/Item flow and a second guaranteed-win fight would feel redundant.

### 7.2 Level 6 — Type System Introduction

When Thunderer's Wrath unlocks — the player's first typed move — a one-time interstitial screen appears before the next battle:

> *"Some attacks carry the power of a god's domain. Thunderer's Wrath is Storm-typed — it hits some enemies much harder, others much weaker. Watch for the 'Super Effective' and 'Not very effective' callouts in battle."*

This is the player's first exposure to type-effectiveness language, priming them for Satyr's payoff moment shortly after (Section 5's combat arc — the type chart "clicking" at the first Storm/War-advantaged fight).

Both moments are one-time and dismissible, and never repeat once seen. The secondary-effect tooltip (Weaken/Fortify/Swift/Rend, triggered by first Divine gear) remains Section 12's responsibility, per Section 3's own routing of that specific moment — not duplicated here.

---

## 8. Post-Battle: Map, Account, Notifications

### 8.1 Placeholder Overworld Map (Screen 8)

Per the planning doc's explicit MVP scoping ("a simple placeholder... enough for the player to land somewhere after the tutorial battle") and Section 9's cross-section flag, this is **not** the full Road/Leagues/Waymarker system from Section 9. It ships as a static single-zone view:

- Olympion's visual identity (sun-bleached marble/olive groves, per Section 9) as a background illustration
- A single Waymarker pin at the zone entry point, with the label *"Olympion — the road begins."*
- No scrolling, no Explore action, no visible Cyclops/Cerberus gates, and no League counter — Section 9's Leagues/distance display is tied to the full Waymarker system and doesn't activate until that system ships
- One CTA: **"Begin your journey"** → proceeds to Screen 9

### 8.2 Save Your Progress / Account (Screen 9)

**Recommendation: guest-first, no signup friction before the tutorial.** An anonymous local profile is created automatically at first launch (Screen 1), with zero account-related interruption before this point — the player experiences the full value of story, gear, and the tutorial fight before ever being asked to commit to an account. This screen is the first sign-in touchpoint, framed around what's now at stake:

> **"Save your progress"**
> Create an account so your Traverser's progress survives a lost phone or a new device.
> [Continue with Apple] [Continue with Google] [Continue with Email] — [Maybe later]

"Maybe later" is honored (guest mode continues), but the prompt resurfaces once, non-intrusively, before the app is closed for the first time (e.g., a dismissible bottom-sheet on first backgrounding) — full resurfacing cadence beyond that single follow-up (e.g., after N days, after first level-up) is a notification/retention-system question and is deferred along with the rest of the daily engagement loop (see §9).

Apple Sign In, Google Sign In, and email/password are offered per the planning doc's authentication requirements; Apple Sign In's presence satisfies App Store guidelines since a third-party login (Google) is also offered.

### 8.3 Notification Permission (Screen 10)

OS-level permission dialog only, framed briefly:

> **"We'll gently remind you when the road is waiting — nothing pushy."**

No specific copy variants, send-time logic, or streak-tied triggers are specified here — see §9.

---

## 9. Cross-Section Flags

- **Overactivity warning (90-min threshold) — assignment resolved, and since delivered.** This message triggers during an ongoing activity session at any point in the app's lifetime, not as part of the first-launch flow — it belongs with the general runtime UI architecture rather than onboarding. Final split under the current 15-section numbering: **trigger logic in Section 11 §8** (fires at sync time only, consistent with the no-passive-sync architecture), **visual component in Section 13 §6.5** (dismissible banner), with the planning doc's exact copy ("You've been at it a while — the road will still be here after you rest").
- **Daily engagement loop (streak mechanic, grace-period logic, push notification copy/timing) — RESOLVED: became Section 11.** Deferred by explicit decision this session, then given its own dedicated section (Section 11, Daily Engagement & Retention Loop), inserted into the plan and renumbering the remaining sections (Story & Lore → 12, UI Architecture → 13, Sound Design → 14, Analytics → 15). Everything deferred here is fully specified there.
- **Section 3 (Move & Ability Design) — FULFILLED.** Section 3's cross-section flag specifically asked this section to design the Level 4 Skill-unlock moment and the Level 6 type-system introduction (§7 above). Both are now fully scripted. The third item in that same flag — the secondary-effect tooltip for first Divine gear — was explicitly routed to Section 12 by Section 3 itself, not this section, and is left there.
- **Section 4 (Battle Items) — FULFILLED.** The tutorial-completion grant of 3 Traveler's Salves (Section 4 §6.3) is now placed concretely at Screen 5, given before the tutorial battle rather than after, so the Item action can be demonstrated live rather than merely granted and explained separately.
- **Section 8 (Gear & Loot Tables) — FULFILLED, both parts.** Section 8's flag had two halves: (1) introduce a starter Mortal-tier Weapon parallel to the starter Salves — done at Screen 5, auto-equipped; (2) don't introduce the Trinket gear-move mechanic until the player's first Heroic Trinket — respected by omission: no Trinket, gear-move, or gear-slot-beyond-Weapon concept appears anywhere in this section's onboarding flow or tutorial battle.
- **Section 9 (Overworld Map) — FULFILLED.** Confirmed the MVP placeholder subset: Olympion entry node + Waymarker only, no scrolling/Explore/League counter, matching Section 9's own flag that this section would define exactly which subset ships pre-full-map.
- **Section 13 (UI Architecture): FULFILLED.** The Skill-locked and Flee-locked tooltip components used in the tutorial battle (§6.4) are delivered as reusable patterns in Section 13 §6.4, alongside the overactivity warning component (§6.5 there), the secondary-effect tooltip (per Section 3's own routing), and the streak/notification UI (streak display, Rest Day control, sign-in bottom-sheet — Section 13 §3.1/§8, with system logic in Section 11).
- **Section 5 (Enemy Roster — Olympion):** No changes required. Confirmed the tutorial's non-canon Waystone Wisp does not overlap with or precede Harpy's role as the first *real* type-teaching encounter — the tutorial teaches Attack/Vigor/Item only; type-effectiveness language is introduced separately at Level 6 (§7.2), still ahead of Satyr's actual payoff fight.

---

## 10. Open Questions

- **Notification resurfacing cadence for skipped sign-in:** ~~genuinely dependent on the deferred notification/retention system design — left unresolved here.~~ **CLOSED — resolved in Section 11 §7.3.** First backgrounding → Day 3 → every 14 days, hard cap of 5 total attempts.
- **Guest-mode data retention window:** how long an anonymous local profile's progress remains recoverable if the player uninstalls before ever signing in is a backend/data-architecture question outside this section's scope (relates to the planning doc's open offline-sync and account-architecture items) — flagged, not answered here.
- **Daily engagement loop ownership:** ~~explicitly deferred per §9 — needs a home before the final sections are considered complete.~~ **CLOSED — became Section 11**, whose §9 event schema was consumed directly by Section 15 (Analytics) exactly as anticipated here.
