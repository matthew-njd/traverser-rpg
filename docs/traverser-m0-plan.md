# Traverser Build Plan — M0: Scaffolding

**Status:** complete 2026-08-01 (`b23a57f` … `7676382`). Successor: M1 (`traverser-m1-plan.md`).
**Written retrospectively 2026-08-02**, reconstructed from the six M0 commits and `DECISIONS.md`, so the milestone set reads consistently. It records what M0 *was*, not what was forecast — where the delivery diverged from the intent, §4 says so.
**Inputs:** `traverser-tech-01-data-model.md` · `traverser-tech-02-api-sync.md` §3 · `traverser-tech-04-client.md` §1, §9 · `traverser-tech-06-deploy.md` (primary consumer) · `traverser-data-manifest.md` · `traverser-test-fixtures.md` §4, §5.

**Outcome:** the RN app boots and talks to the API, Postgres is migrated and seeded, Compose is up, Sentry is wired on both tiers, and a signed build installs over USB to a Pixel 9 as `com.oldroads.traverser`. **Nothing to play** — this was the only non-playable milestone, kept deliberately small.

---

## 1. What shaped this milestone

M0's job was to prove the *pipeline*, not to build any game. The kickoff prompt scopes it to "RN app boots and talks to the API; Postgres migrated; Docker Compose up; Sentry wired," and the discipline that mattered was resisting anything further — no screens, no formulas, no gameplay.

Two things made it larger than that sentence suggests, and both were correct:

- **T6 §13's "M0 is this doc's primary consumer."** The deployment spec assigned M0 the Dockerfile, Compose file, `.env.example`, migration and seed commands, the §5.4 validation pass, the release keystore and its config plugin, the `tailscale serve` setup, and the README recording the manual host steps. That is most of a milestone on its own.
- **T4 §9.2's build-time asset check.** A missing sprite fails the build from day one, which means the full 115-file placeholder set and its codegen had to exist before M1 could add a screen that renders anything.

The **release keystore** is the one item whose timing was non-negotiable. `expo prebuild --clean` regenerates the debug keystore, so anything signed with it has a silently-changing signing identity; Android refuses to update-install across a key change, the only way forward is uninstall, and per T4 §6.5 uninstall destroys `player_id` and the bearer token unrecoverably. Generating it after the first install would have cost a wipe.

---

## 2. Scope

### 2.1 In

| Area | What landed | Spec |
|---|---|---|
| Solution | `Traverser.sln`, API + test projects, Expo SDK 57 app | — |
| Schema | Full tech-01 EF model, 5 migrations | T1 |
| Content seed | Enemies, moves, items, gear, progression tables as `HasData` | T1 §5 |
| Validation | CHECK constraints + `ContentValidationTests` + manifest cross-check | T6 §5.4 |
| API | `GET /api/v1/content/version`, migration assertion at boot | T2 §3, T6 §5.2 |
| Deployment | Dockerfile, Compose (`api` + `db`), `.env.example` | T6 §3–§5 |
| Remote reach | Tailscale MagicDNS + HTTPS + `tailscale serve`, verified from the phone | T6 §8 |
| Errors | Sentry on both tiers, errors only, privacy options explicit | T6 §9 |
| Signing | Release keystore + `withReleaseSigning` config plugin | T6 §7.3 |
| Client config | `app.config.ts` replacing `app.json`, `env.ts` single read point | T6 §4.2 |
| Assets | `gen-assets.ts` codegen + 115 placeholders | T4 §9.2–§9.3 |

### 2.2 Out

Everything else. No screens beyond a boot shell, no health integration, no sync endpoint, no battle engine, no XP. The app shipped showing a placeholder screen, which was the intended result.

---

## 3. Decisions

M0 produced **~30 entries in `DECISIONS.md`**, all dated 2026-07-31 or 2026-08-01, and that file — not this one — is the record. The ones that changed the shape of the deployment rather than a detail inside it:

| Decision | Why it mattered |
|---|---|
| Postgres 16 → **18**, done at M0 | A major bump is a data-directory incompatibility. At M0 it cost a reseed; from M1 it costs a `pg_upgrade` against real fitness history. |
| The `db` volume mounts `/var/lib/postgresql`, **not** `…/data` | The 18+ images moved `PGDATA` into a major-scoped subdirectory; the pre-18 path makes the container refuse to start. T6 §3's table was written against the old convention. |
| Migrations run **from the host**, not a Compose profile | Resolves T6 §5.1's open pick. Consequence: `db` publishes a loopback-bound port, a documented deviation from §3.2. |
| Runtime image is `aspnet:10.0-noble-chiseled-extra` | Plain chiseled omits ICU *and* tzdata, and Npgsql resolves time zones through `TimeZoneInfo` on every `timestamptz` — of which tech-01's schema is full. |
| `app.json` **deleted**, not layered under `app.config.ts` | When both exist the dynamic file wins and the static one contributes only what is spread — a silent-drift trap for exactly the values (package, scheme) that must never drift. |
| Package name `com.oldroads.traverser`, set before the first build | The package is the app's identity to Android and cannot be changed after an install without the new build being a different app. |
| Tailnet host renamed `workshop` **before** enabling HTTPS | A certificate-transparency entry cannot be withdrawn, so the §8.2 mitigation is only free while no certificate has ever been issued. |
| Signing credentials in `~/.gradle/gradle.properties`, not the environment | A shell-export approach silently reverts to the debug key from any terminal lacking the exports — and the failure is a wrongly-signed APK, not an error. |
| Gear bonuses use banker's rounding (`ToEven`) | Fixtures §5 needs it, .NET's default is already correct, and **JavaScript's `Math.round` is not** — a client/server hazard T4/T5 must respect. |
| §5.4's validation splits between CHECK constraints and tests | "It lands in the seed step" had no target: the seed is `HasData` inside a migration, so there is no seed step to hook. |

Three `⟨verify⟩` markers were resolved during M0 (T6 §7.2's `--variant` spelling, §7.3's config-plugin API surface, §9.3's Sentry option names). **T6 §10.3's `⟨Decide at M0⟩` marker was not** — it governs the backup schedule, and §10 is scoped to M1; it is resolved in `traverser-m1-plan.md` §3.1.

---

## 4. Packets, as delivered

| P | Commit | Date | Contents |
|---|---|---|---|
| **P1** | `b23a57f` | 07-30 | Scaffolding: solution, API + test projects, Expo template, `infra/docker-compose.yml`, `.env.example`, root `.gitignore`. |
| **P2** | `3777589` | 07-31 | Data model: 30+ EF entities, snake-case enum converters, `TraverserDbContext` split content/player, `InitialSchema` migration. |
| **P3** | `b4a5323` | 07-31 | Content seed (~2,400 lines of `InsertData`) plus `ContentSeedTests`, `SeedIntegrityTests`, and `Fixtures.cs` — the deliberate second transcription of ~50 fixture numbers. Includes the `ZoneIsReleasedNoStoreDefault` fix. |
| **P4** | `a6ad420` | 07-31 | **Documentation only.** T1 amended in place with the four schema additions later specs require and it does not provide: `auth_token`, `encounter_grant` + `battle.grant_id`, `client_operation`, `player_settings.birth_year`. |
| **P5** | `7901be7` | 08-01 | Wrap-up: Dockerfile, Compose finalisation, `content/version` endpoint, migration assertion, §5.4 constraints + `ContentValidationTests` + `ManifestKeys`, `app.config.ts`, `env.ts`, `sentry.ts`, `withReleaseSigning`, the 352-line README, and 26 DECISIONS entries. |
| **P6** | `7676382` | 08-01 | Housekeeping: the P4 amendments **built** as `T1AmendmentTables`, `gen-assets.ts` + generated registry + 115 placeholders, the Expo template stripped to a boot shell, docs squared away. |

### 4.1 Where the delivery diverged from the intent

Two things are worth carrying forward rather than smoothing over:

- **P4 amended the spec; P6 built it.** The four T1 additions were written into tech-01 on 07-31 and did not exist in the EF model until the close-out review caught it on 08-01. For a stretch the milestone's "EF schema delivered" claim was true only of the pre-amendment schema. *Lesson for M1: a spec amendment and its migration belong in the same packet, or the amendment is a promise rather than a change.*
- **P6 was not planned.** It exists because a close-out review found unfinished work — the amendments above, the asset pipeline, and the template strip. It was cheap here because M0 had no users and no data; the same review at M1 lands on top of real fitness history. *Lesson: the review belongs before the wrap-up commit, not after it — `traverser-m1-plan.md` P10 is that packet, and its checklist is drawn from this section.*

---

## 5. Exit criteria, as met

1. `docker compose up` brings up `api` + `db`; the API answers on `127.0.0.1:8080` and the host's LAN address refuses. ✔
2. `dotnet ef database update` applies all migrations from the host; the API refuses to serve against a mismatched schema. ✔
3. `GET /api/v1/content/version` returns `{"content_version": 1}` from the phone over Tailscale HTTPS. ✔
4. The seed passes §5.4's validation with zero violations; `dotnet test` green. ✔
5. A signed build installs over USB to the Pixel 9 and boots to a placeholder screen. ✔
6. Sentry captures on both tiers, and a blank DSN disables capture without breaking the dev loop. ✔

---

## 6. What carried into M1

- **T6 §10 (backups) and §13.1 (identity export)** — both explicitly M1-before-first-sync, and the reason M1's packet order puts infrastructure ahead of features.
- **The three-member backup set** — `infra/.env`, `traverser-release.keystore`, *and* `~/.gradle/gradle.properties`. The keystore is useless without its passwords, and losing it forces an uninstall that destroys the local profile. It gains a fourth member (the identity export) at M1 P8.
- **↯ The manual ninja swap.** The Android SDK's bundled ninja 1.10.2 was replaced with 1.12.1 at `Sdk/cmake/3.22.1/bin/ninja.exe`; 1.10.2 cannot build Reanimated on Windows. **An SDK Manager update to the CMake package silently reverts this** and the build fails with `manifest 'build.ninja' still dirty after 100 tries`. Recorded in the README with the restore path and the dead ends.
- **Audio placeholders are `.wav`, not `.ogg`** — no OGG encoder exists in the $0 toolchain, and Metro's default `assetExts` excludes `ogg` entirely. The registry prefers `.ogg` per key when present, so real deliveries are drop-in; `metro.config.js` lands at M5.
- **The template's web-facing npm dependencies** were left installed for a deliberate prune at the next device rebuild — M1 P1.
- **Deferred by explicit decision:** source-map upload and the `getSentryExpoConfig` half of the Sentry setup (M5).
