# Traverser — Development Kickoff & Session Prompt

## Context

The 15-section GDD is complete and locked. This project turns it into a working app in two phases: a short **Tech Spec** phase (design decisions before code), then **Build Milestones** (vertical slices, each playable). At the start of each session I'll tell you which spec or milestone we're working on. Read the relevant GDD sections and any completed tech specs first, ask only genuinely unresolvable questions, then produce the deliverable.

---

## Phase 1 — Tech Specs (one session each)

| # | Spec | Key Deliverable | Primary GDD Inputs |
|---|---|---|---|
| T1 | Data Model & Schema | Postgres schema: player profile, stats, XP/level, activity days, streaks, inventory (items + gear), equipped loadout, zone/boss progress, bestiary discovery. Designed so quests/classes/currency can be added later without migration pain. | 1, 4, 8, 9, 11 |
| T2 | API Surface & Sync Protocol | Endpoint list, the sync-on-open flow (steps → XP → Leagues → encounter checkpoints in one transaction), offline queue + conflict rules (server never loses XP; last-write-wins is not acceptable for additive values like XP/steps — use additive merge). | 1, 9, planning doc's offline section |
| T3 | Health Integration | **Health Connect** (Android-only — Matthew's device) read strategy: steps, HR sessions, tier-minute derivation per Section 1's zones, permission flows, what's computed on-device vs. server. Includes a spike checklist for the known unknowns. HealthKit/iOS deferred indefinitely (note the abstraction seam only); wearables (Fitbit/Garmin) deferred — phone + watch-syncing-to-Health-Connect covers the personal use case. | 1, 10, 11 |
| T4 | Client Architecture | RN framework choice (recommendation expected: Expo vs. bare, with rationale), navigation matching Section 13's 3-tab structure, state management, local storage, and the swappable asset pipeline (sprite/audio lookup by data key). Flag every spot where RN diverges from web-React habits. | 13, 14, planning doc |
| T5 | Battle Engine | Where combat logic lives (client-side per the sanctioned trim), deterministic implementation of Section 2's formula + Section 3's moves/effects + Section 4's items, enemy AI weights, and a test suite built directly from the GDD's worked examples (Section 2 examples, Section 10 §6.3 tutorial values, Sections 5–7 fight-arc numbers as sanity fixtures). | 2, 3, 4, 5–7, 10 |
| T6 | Deployment & Dev Loop | Docker Compose (API on .NET 10 + Postgres + Sentry free tier) running on my current PC, local dev workflow, Android device path (local dev builds + release APK sideload over USB — no EAS cloud builds, no store account), backup strategy for the guest-only profile, and remote-reachability design (Tailscale, free) so the phone can sync away from home. Hard constraint: $0 recurring cost. Include a short migration note for moving Compose onto dedicated home-lab hardware later — not urgent, decide at M5. | planning doc |

Each spec is a standalone markdown decision doc, saved as `traverser-tech-0N-<topic>.md` and added to project knowledge. Short is correct — decisions and contracts, not prose.

---

## Phase 2 — Build Milestones

Each milestone ends with a build I can run on my actual phone. Placeholder art (colored shapes + labels) until the Art Project delivers real sprites; the asset pipeline from T4 makes the swap trivial later.

| M | Name | Playable Outcome | GDD Sections Implemented |
|---|---|---|---|
| M0 | Scaffolding | RN app boots and talks to the API; Postgres migrated; Docker Compose up; Sentry wired. Nothing to play yet — this is the only non-playable milestone, kept deliberately small. | — |
| M1 | **The Walk** | Real steps sync on app open and level me up. Health permissions, Step + HR-tier XP, level curve, manual stat allocation, Character screen with stats + activity log. *The core purpose of the app is delivered here.* | 1, parts of 10, 13 §3 |
| M2 | **The Fight** | Battles work. Battle engine, tutorial battle (Waystone Wisp, deterministic), Harpy + Satyr wild encounters with the daily cap, healing items + Surge charms, Vigor persistence/regen, battle screen with type callouts. | 2, 3, 4 (subset), 5 (wilds), 9 §5, 10 §6 |
| M3 | **The Road** | Olympion is a complete game. Full Map (Leagues, Waymarker, gates, Explore), Cyclops + Cerberus, full item roster, gear system with drops/milestones/equip screen, remaining onboarding flow. | 4, 5, 8, 9, 10, 13 |
| M4 | **The Realm** | All three zones. Valheon + Imperion rosters, Trinkets + gear moves, zone entry narratives + boss dialogue + bestiary, streaks/rest days/grace logic, overactivity warning. | 6, 7, 8, 11, 12 |
| M5 | **The Song** | Ship-quality personal build. Full sound design, real art integrated, fixed-time daily notification, remaining polish, installable on my phone as a daily-use app. | 14, remaining 10/13 polish |

> **Amended 2026-11-03 (M6/P9).** Delivered as seven milestones, M0–M6. On 2026-10-24 the row above was split in two: M5 finished the game, and M6, "The Song", added the sound, the art, the notification and the release build. From 2026-08-04 Claude writes the code by default and Matthew reviews and commits it, which supersedes the working agreement below.

**Working agreement:** I write the code manually in VS Code, using Claude Code (VS Code extension) as an assist rather than the builder, with Context7's MCP server providing current framework docs. Backend targets **.NET 10**. Hosting is my current PC via Docker Compose through the build phase (off-between-sessions is fine, no uptime need yet); a dedicated home-lab box is a later, deliberately deferred purchase. Hand-written by me: RN screens/navigation, health integration, sync flow, battle engine core — the learning-value and architecture-weight work. Delegated to Claude Code: test suites from the GDD's worked examples (expected values are already locked — ideal delegation), EF migrations, boilerplate/DTOs, and debugging assists. The GDD and tech specs are checked into the repo with a `CLAUDE.md` at the root pointing to them. This chat project handles planning each milestone, resolving spec questions that surface during the build, and the post-milestone review (the dev-phase version of the GDD's consistency audit: does the build match the spec, with formula outputs tested against the GDD's own verified numbers).

---

## Phase 3 — Direction & Polish (after M6)

Phase 2 builds the game as the GDD specifies it. Phase 3 revisits how the game looks, sounds and feels, now that a playable foundation exists. Nothing here is decided yet: each item becomes a packet with its own plan, and a choice is locked into the GDD only once Matthew picks it.

### Art direction: pixel-art sprites

**The goal:** replace the ink-emblem sprites with pixel-art battle sprites, in the style of handheld monster-battlers. The designs stay Traverser's own creatures. Matthew prefers a gothic, mature feel (desaturated colours, sharp silhouettes, heavy shadow) to a bright, rounded, cartoony one.

**The constraint is direction, not drawing.** Matthew can draw in LibreSprite; what he finds hard is deciding the art direction. Fix the direction first, as a style sheet, so each sprite becomes routine work:

| Decision | Sets |
|---|---|
| Canvas | Sprite size: 64×64 for enemies and the avatar, 32×32 for items and gear. 16×16 is too small to read as a boss. |
| Palette | Colour count and hues, for example 16 colours from a Lospec palette, with one accent per zone. |
| Outline | Black, a darker shade of the fill, or the outer edge only. |
| Light | Direction and shading levels, for example top-left with 3 levels. |
| View | Camera angle, for example enemies front three-quarter facing left, and the Traverser from behind. |
| Proportion | Realistic and lean, or squat and chunky. |
| Detail density | Big readable shapes, or fine texture. |
| Mood | One sentence, for example "weathered temple carvings come to life." |

**The process:**

1. Claude presents three distinct directions side by side, each filling in the table with references and a palette.
2. Matthew picks one or mixes them, and it is written into GDD 13 as the style sheet.
3. Matthew draws one test sprite (the Harpy) in LibreSprite, with Claude coaching each step: silhouette, flat colours, shading, then cleanup. View it on the Pixel next to the ink sprite.
4. Only then decide on the other 51 sprites, the avatar and the zone banners.

**Budget: $50–100, approved by Matthew (2026-11-01)** for creative help. Confirm each purchase before making it.

- **AI image generation for concept art, about $10–20.** Use it to explore designs in the chosen direction, then redraw by hand at 64×64. The output is a reference, not a finished sprite.
- **One commissioned anchor sprite, about $40–80** (optional). A pixel artist (itch.io, Fiverr, r/HungryArtists) draws one 64×64 enemy and its palette. Get commercial rights in writing.
- **Free:** LibreSprite, and Lospec's palette list.

**Tools assessed and not adopted:**

- **Sprite Sheet Generator** (clsandoval) and **Creating Sprites** (RiccardoGrin): agent skills that generate sprites with a paid image API (Gemini and OpenAI). Image models paint a smooth picture and shrink it, which gives uneven pixels, stray colours and a large palette, so every sprite still needs hand cleanup. They're worth reconsidering only for concept art.
- **Motion Anything** (nexu-io, Apache-2.0): a web motion engine. Its CSS and browser-React exports don't run in React Native. Its Lottie export could drive battle effects (a Thundercrack flash, a crit splash) through `lottie-react-native`, but that adds a native module and a `vfx_` manifest family. Trial it on one effect first.

**What a pixel restyle touches:** GDD 13's ink-on-marble style, all 52 manifest sprites, the avatar figures, the zone banners, `credits.json`, and `scripts/export-art.ts`, which must scale by nearest neighbour with no smoothing. Check on the Pixel that Android doesn't smooth the PNGs when it scales them.

### UI and UX changes

Record any change Matthew wants to the look or flow of a screen here, then plan it as a packet. Carried from M6 §2.2, all still undecided:

- **A further pass on the battle screen's UI.** No known defect.
- **Shorten or skip a boss's intro on a rematch** (M5 drill note 4). Needs a GDD 12 §2 amendment first.
- **An in-game codex or help screen.** Needs a GDD 13 amendment first.
- **A respec.** A design question, not a gap.
- **The restore link's `›` on the Name screen** (`04-name.tsx`). The same glyph that M5 drill note 5 found reads as a dot. M6/P5e replaced it only on the Battle buttons.

### Content

- **The Egyptian zone** (GDD 9, GDD 12 §9). `gate_cacus` already unlocks `egypt_tbd`.

### Carried over from Phase 2

- **Real sound.** The spoken temp audio (`npm run audio:temp`) stands in until real sound replaces it, key by key. It brings two items with it: GDD 14 §4.2's low-Vigour layer for the six boss tracks, whose manifest keys are added with the files (DECISIONS 2026-10-28), and an OGG encoder, since T4 §9.3 names `.ogg` and the placeholders are `.wav`.
- **Source-map upload**, off since M0 (DECISIONS 2026-10-28). Revisit the first time a minified release stack trace gets in the way.
- **The enemy restyle in the svgsilh style**, deferred in P5b for lack of matching images. A pixel restyle would replace it.
- **The female figure's licence:** confirm the CC0 badge on svgsilh image 1905054.
- **GDD 14's table**, which an earlier P3 note splits in two.
- **M6's deferred drills:** 5 (the overactivity sting), 6 (onboarding again: the figure picker, Screen 10 and a denial) and 7.3 (the nudge's same-day copy: open the app before 6 PM, under the goal) in `traverser-m6-drills.md`. Confirm each in daily use, and refresh the sheet against the server first.
- **The nudge's "a 11-day streak"**, note 1 in the M6 drill sheet: streaks of 8, 11, 18 and 80–89 days need "an".
- **Encounters never expire** (M3 drill note 2, carried as a cross-spec flag through M4, M5 and M6). Spec-correct, but unfought grants pile up: 23 were waiting on 2026-11-03.

---

## Current Session

**Phase 3 — Direction & Polish.** No plan yet. The first Phase 3 plan draws its scope from the notes in the Phase 3 section above, starting with the art direction's style sheet. Commits follow `Phase 3 - <plan>: <name> (P<n>)`.

Rather than restating the session here every time and letting it rot, this block names the current milestone only. **The milestone plan is the session brief** — its packet list is the running order and its §5 exit criteria are the definition of done.

**Complete:**

- **Phase 1 — Tech Specs:** all six, T1–T6, closed 2026-07-26. Amendments land in place as dated blockquotes; deviations get a `DECISIONS.md` line.
- **Phase 2 — M0 (Scaffolding):** closed 2026-08-01. The app builds locally and installs to the Pixel over USB; Postgres is migrated and seeded; Compose, Tailscale, Sentry, and the release keystore are wired. `traverser-m0-plan.md` §4.1 records where delivery diverged from the plan.
- **Phase 2 — M1 (The Walk):** verified 2026-08-16. **M2 (The Fight):** 2026-08-22. **M3 (The Road):** 2026-09-01. **M4 (The Payoff):** 2026-10-24. **M5 (The Realm):** 2026-10-28. **M6 (The Song):** 2026-11-03, on a short drill pass. Each plan's §7 records where delivery diverged, and the README summarizes each milestone.
