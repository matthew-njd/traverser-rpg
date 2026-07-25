# CLAUDE.md — Traverser

Traverser is a mythology-themed fitness RPG (React Native + ASP.NET Core 10 + PostgreSQL) where real-world walking and heart-rate exercise drive all progression. Solo personal project by Matthew, who hand-writes most code to learn React Native/mobile — **Claude's role here is assistant, not builder.**

## Your role

- **Do when asked:** generate tests, EF migrations, boilerplate/DTOs, debug assistance, explain RN/mobile concepts (Matthew is expert in .NET/C# and web React; RN, HealthKit/Health Connect, and mobile packaging are new to him — flag where mobile diverges from web patterns he'd assume).
- **Don't:** rewrite architecture unprompted, refactor beyond the asked scope, or implement whole features that weren't delegated. Prefer minimal diffs.
- **Docs:** use the Context7 MCP server for current React Native/Expo/library APIs rather than trusting memory — these move fast.
- **Platform:** Android-only (Health Connect, local `expo run:android` builds, USB sideload). Don't add iOS/HealthKit code paths.
- **Runtime:** .NET 10 (LTS through Nov 2028) for the API — don't target .NET 8/9.
- **Hosting:** API + Postgres run in Docker Compose on Matthew's current PC (turned off between sessions is fine — dev only, no uptime need yet). A dedicated home-lab box is planned for later (also to host other apps/games), not yet purchased — don't assume always-on infrastructure or write code that depends on it.
- **Cost:** $0 stack — self-hosted (current PC now, dedicated hardware later), local builds (never suggest EAS cloud builds), free tiers, local notifications (no FCM). Never introduce a paid service, account, or API key requirement without flagging the cost and a free alternative first.

## Source of truth (in `/docs`)

1. **The 15 GDD sections** (`traverser-gdd-*.md`) — every formula, table, stat, and flow is locked design. Never change game behavior to make code simpler; if a spec genuinely can't be implemented as written, stop and flag it.
2. **Tech specs** (`traverser-tech-*.md`) — locked architecture decisions.
3. **`traverser-data-manifest.md`** — canonical snake_case IDs for all content (enemies, moves, items, gear, audio). Never invent IDs; add to the manifest first.
4. **`traverser-test-fixtures.md`** — machine-verified expected values. **All formula tests assert against this file.** If code disagrees with a fixture, the code is wrong — do not "fix" a fixture to make a test pass.

## Sanctioned scope trims (do not re-add)

Analytics deferred (Sentry only) · guest-only local profile, no auth flows · no anti-cheat/data-integrity work · fixed-time local notifications only · battle engine and enemy stats computed **client-side** (formulas exactly per GDD; only the location differs from Section 5's server-authoritative wording).

## Non-negotiable game rules (most commonly violated by "reasonable" code)

- Damage divisor is `DefenseStat × 8`, floor the final result. Crit 6.25%/×1.5, random 0.90–1.10 — **except** the tutorial battle, which bypasses both (deterministic).
- The type chart applies **only to the player's own typed attacks**. Enemy moves never get a TypeMultiplier. Physical moves never get one in either direction.
- Enemy level always equals player level at encounter time.
- Stride never receives gear bonuses. XP stops entirely at Level 60 (no banking).
- Streak/rest-day logic is never punitive: no loss notifications, quiet reset copy, grace rules per GDD Section 11.
- Sync happens only on app open/foreground — nothing assumes background execution.

## Conventions

- Record any deviation from the GDD or tech specs in `/docs/DECISIONS.md` (date, what, why) — one line each; this is the dev-phase changelog.
- Asset lookups by manifest key only (`enemy_harpy`, `mus_hub`) — no hardcoded filenames or display strings in logic.
- C#: standard .NET conventions, EF Core migrations checked in. TypeScript: strict mode.
