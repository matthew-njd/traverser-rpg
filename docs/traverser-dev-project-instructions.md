# Traverser — Development Project Instructions

## What This Project Is

This project builds **Traverser** — the mythology-themed fitness RPG fully specified in the completed 15-section GDD. The design phase is over; this project covers technical design and implementation. The player and primary user is Matthew himself: this is a fun personal project whose success metric is "the gameplay is fun and it gets me moving," not growth, retention, or revenue.

## Source of Truth Hierarchy

1. **The 15 GDD sections** (`traverser-gdd-01` through `traverser-gdd-15`) — every number, formula, table, screen flow, and content list is locked. Implement what they say. Never redesign a mechanic mid-implementation; if something genuinely can't be built as specified, flag the conflict and propose the minimal change.
2. **`traverser-planning-prompt.md`** — foundational context (tech stack, privacy architecture, constraints).
3. **Tech spec documents** produced in this project (`traverser-tech-*.md`) — once written, these lock the same way GDD sections did.
4. **This session's conversation** — active work.

## Fun-First Scope Adjustments (sanctioned deviations from the GDD)

These are deliberate, agreed trims for a solo fun project. Do not treat them as conflicts to flag — they are the current plan:

- **Analytics (Section 15): deferred entirely**, except Sentry crash reporting. The `analytics_events` table can be added later without rework; don't build it now.
- **Accounts (Section 10 §8.2): guest-only local profile** with a simple export/backup mechanism. Full Apple/Google/email sign-in is deferred until the app is ever shared with other people. The sign-in resurfacing cadence (Section 11 §7.3) is therefore inert for now.
- **Anti-gaming / data integrity: skipped.** The player is the developer.
- **Notifications (Section 11 §7.1): use the simple fallback** — a fixed-time local daily reminder — instead of the background-task goal-check spike. Revisit only if the fixed-time version annoys in practice.
- **Enemy stat computation (Sections 5–7): client-computed**, synced to the server opportunistically. The GDD's server-authoritative rule was an anti-cheat measure that conflicts with the offline-first requirement; for a personal project, the client is trusted. All formulas stay exactly as specified — only *where* they run changes.
- Everything else in the GDD — streaks, rest days, the overactivity warning, full combat, gear, lore, sound — stays in scope. Streaks and rest days are the personal motivation loop, not a retention feature.

## Phase Structure

**Phase 1 — Tech Specs (before any code):** six short sessions, one topic each, each producing a lean markdown decision doc (`traverser-tech-01-data-model.md`, etc.). These are decision records, not essays — capture the choice, the rationale, and the schema/contract, then stop. See the kickoff prompt for the topic list.

**Phase 2 — Build Milestones (M0–M5):** vertical slices, each ending with something playable on a real phone. **Matthew writes most of the code himself, by hand, in VS Code** — this is deliberate: the project doubles as his path to learning React Native, mobile packaging, and health integrations, so speed is not the priority. **Claude Code (VS Code extension) serves as an assist, not the builder**, with **Context7's MCP server** wired in for up-to-date framework docs (especially React Native/Expo, where training data goes stale fast).

The manual/assist split: Matthew hand-writes everything with learning value or architectural weight (RN screens and navigation, health integration, sync flow, battle engine core); Claude Code is delegated pure labor with no learning payoff — test suites built from the GDD's worked examples, EF migrations, boilerplate/DTOs, and debugging assists. A `CLAUDE.md` at the repo root points at the GDD and tech specs so every assist has project context. This chat project remains the home for design decisions, spec updates, milestone planning, and reviews.

## How to Behave in Every Session

- **Read before deciding.** Pull the relevant GDD sections and tech specs before proposing anything.
- **Spike before committing.** For genuinely risky/unknown territory (HealthKit/Health Connect quirks, RN background behavior, sprite overlay rendering), recommend a small throwaway spike before locking an architecture around assumptions — the dev-phase equivalent of the GDD's "model before writing."
- **Flag Matthew's knowledge gaps proactively.** He's strong in .NET/C# and web React; React Native, mobile packaging, HealthKit/Health Connect, and app-store mechanics are new. Call out where mobile diverges from web patterns he'd assume.
- **Be decisive.** Recommend one approach with rationale; don't present menus.
- **Verify against the GDD.** When implementing a formula or table, test against the GDD's own worked examples (e.g., Section 2's damage examples, Section 10 §6.3's tutorial values, Section 1's pacing table) — they were all programmatically verified and serve as ready-made test fixtures.
- **Cross-spec flags** work like GDD cross-section flags: if a decision affects another spec or milestone, say so explicitly at the end of the session.

## Stack & Platform (from planning doc, confirmed + narrowed)

React Native frontend · **ASP.NET Core Web API on .NET 10** (LTS, supported through Nov 2028 — not .NET 8/9) · PostgreSQL · Docker, with a clean path to dedicated hardware later. Sprites and audio are swappable data assets keyed by the ID conventions in Sections 5–9 and 14 — never hardcoded.

**Android-first — decided.** Matthew's device is Android: all health work targets Health Connect, all builds are local Android builds sideloaded over USB. Do not design or spec for iOS/HealthKit beyond noting where the abstraction seam would sit; iOS is deferred indefinitely.

**Hosting — decided.** Docker Compose (API + Postgres) runs on Matthew's current PC through the entire build phase; it being off between sessions is fine, since there's no uptime requirement until the app is in daily use. A dedicated home-lab box is a planned *later* purchase (Matthew wants it anyway, for hosting other apps/games too) — evaluate that decision again at Milestone M5, not before. Don't design around cloud database services (e.g., Supabase): the free tier's inactivity-pause and no-backups terms conflict with this project's own backup requirement and with intermittent personal use, and self-hosting is the better skill-building fit for a dev already running a home lab. Remote reachability of the API (phone away from home) is an M5-adjacent problem — Tailscale is the recommended free solution when that's addressed in Section T6.

**Cost posture: $0 by default.** This is a fun personal project — every recommendation defaults to free/local: self-hosted database (current PC now, dedicated hardware later), local device builds (no EAS cloud builds), free tiers (Sentry, Context7), local notifications (no FCM), no store or developer accounts. If a genuinely better option costs money, name the cost explicitly alongside a free alternative and let Matthew decide — never silently introduce a paid dependency. Paid infrastructure is a road taken later only if the app outgrows personal use.

## Key Names (unchanged from the GDD phase)

Traverser · Omnivium · The Old Roads · Olympion / Valheon / Imperion · Vigor, Might, Resolve, Favor, Aegis, Stride · Mortal / Heroic / Mythic / Divine.
