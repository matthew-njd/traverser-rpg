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

**Working agreement:** I write the code manually in VS Code, using Claude Code (VS Code extension) as an assist rather than the builder, with Context7's MCP server providing current framework docs. Backend targets **.NET 10**. Hosting is my current PC via Docker Compose through the build phase (off-between-sessions is fine, no uptime need yet); a dedicated home-lab box is a later, deliberately deferred purchase. Hand-written by me: RN screens/navigation, health integration, sync flow, battle engine core — the learning-value and architecture-weight work. Delegated to Claude Code: test suites from the GDD's worked examples (expected values are already locked — ideal delegation), EF migrations, boilerplate/DTOs, and debugging assists. The GDD and tech specs are checked into the repo with a `CLAUDE.md` at the root pointing to them. This chat project handles planning each milestone, resolving spec questions that surface during the build, and the post-milestone review (the dev-phase version of the GDD's consistency audit: does the build match the spec, with formula outputs tested against the GDD's own verified numbers).

---

## Current Session

**M1 — The Walk.** Scope, packet order, and exit criteria are in `traverser-m1-plan.md`; work the packets in order, one commit each, `Phase 2 - M1: <name> (P<n>)`.

Rather than restating the session here every time and letting it rot, this block names the current milestone only. **The milestone plan is the session brief** — its packet list is the running order and its §5 exit criteria are the definition of done.

**Complete:**

- **Phase 1 — Tech Specs:** all six, T1–T6, closed 2026-07-26. Amendments land in place as dated blockquotes; deviations get a `DECISIONS.md` line.
- **Phase 2 — M0 (Scaffolding):** closed 2026-08-01. The app builds locally and installs to the Pixel over USB; Postgres is migrated and seeded; Compose, Tailscale, Sentry, and the release keystore are wired. `traverser-m0-plan.md` §4.1 records where delivery diverged from the plan.
