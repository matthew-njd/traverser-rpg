# Traverser Build Plan — M1: The Walk

**Status:** planned 2026-08-02, not started. Predecessor: M0 (complete, 2026-08-01).
**Inputs:** GDD 1 (XP & leveling) · GDD 10 §2–§5 (onboarding, partial) · GDD 13 §3, §7 · `traverser-tech-02-api-sync.md` §3–§6 · `traverser-tech-03-health.md` (all) · `traverser-tech-04-client.md` §4–§8 · `traverser-tech-06-deploy.md` §10, §13.1 · `traverser-test-fixtures.md` §4, §9, §11 · `DECISIONS.md`.

**Playable outcome:** real steps and heart-rate minutes sync on app open, become XP, and level the Traverser up. Stat points are allocated by hand. The Character screen shows level, XP, the six stats, and a reverse-chronological activity log. *This is the milestone that delivers the core purpose of the app* — everything in M0 was pipeline.

---

## 1. The ordering constraint that shapes this milestone

T6 §10.7 and §13.1 both say the same thing and it inverts the natural build order: **the backup job and the device-identity export must both exist before the first real step sync, not after it.**

The reason is not caution. Health Connect retained ~30 days of history on the spiked device (`DECISIONS.md` 2026-07-26), so past that window the Postgres row is the only copy of a given day's steps that exists anywhere — and T4 §6.5 makes `player_id` and the bearer token die with an uninstall, so a Postgres backup with no exported identity restores a history that no client can claim.

Consequence for this plan: infrastructure packets (P2, P3) precede health and UI work, and the milestone does not reach a real device until P9. The restore drill (§10.6) is the one piece that must come *after* real data exists, so it sits at the end with the first sync.

---

## 2. Scope

### 2.1 In

| Area | What lands | Spec |
|---|---|---|
| Identity | Guest registration, bearer token, `GET /players/me` | T2 §1.4, §3 |
| Sync | `POST /sync` — T2 §4 steps **1, 3, 4, 5, 6** only | T2 §4 |
| Progression | Step XP, HR tier XP, level curve to 60, 3 points/level | GDD 1 §2, §4, §5 |
| Allocation | Manual stat allocation on the `client_operation` ledger | T2 §3, GDD 13 §3.2 |
| Health | Permissions, read pass, tier-minute derivation, delta minting | T3 (all) |
| Client storage | SQLite mirror, outbox, watermarks, session ledger | T4 §6 |
| Onboarding | GDD 10 screens 1, 2, 2a, 3, 4 (+ birth year) → tabs | GDD 10, T3 §1.4 |
| Screens | 3-tab shell, Character/Avatar, Character/Stats, Settings | GDD 13 §2.1, §3, §7 |
| Recovery | Identity export + restore-at-first-launch | T6 §13.1 |
| Ops | `pg_dump` job, retention, schedule, restore drill | T6 §10 |

### 2.2 Out, and where it lands

| Deferred | Milestone | Why |
|---|---|---|
| T2 §4 step 2 (battles, drops, bestiary) | M2 | No battle engine yet |
| T2 §4 steps 7, 8 (gates, encounter grants) | M2/M3 | Map and encounters |
| T2 §4 step 9 (streak, grace) | M4 | GDD 11 is M4's section |
| T2 §4 step 10 (deterministic rewards) | M3/M4 | No item or gear systems yet |
| T2 §4 step 11 (overactivity) | M4 | GDD 11 §8 |
| Streak badge, Rest Day control | M4 | Named on the Character screen by GDD 13 §3.1, but their server halves are M4 |
| Content bundle embed + `GET /content/bundle` | M2 | §3.2 below |
| Tutorial battle, loadout reveal (GDD 10 screens 5–7) | M2 | Battle engine |
| Placeholder map (GDD 10 screen 8) | M3 | GDD 9 |
| Sign-in (GDD 10 screen 9) | never | Sanctioned trim — guest only |
| Notification permission (GDD 10 screen 10) | M5 | Notifications are M5 |
| Audio sliders in Settings (GDD 13 §7) | M5 | No audio bus until M5 |
| `metro.config.js`, source-map upload | M5 | Recorded at M0 close-out |

The Map and Inventory tabs ship as stubs so the 3-tab bar (GDD 13 §2.1) is built once rather than retrofitted at M3.

---

## 3. Decisions taken at plan time

**3.1 The backup schedule is a Windows Task Scheduler task on the host, not a sidecar container.** This resolves T6 §10.3's `⟨Decide at M0⟩` marker, which slipped M0's checklist because §10 is scoped to M1 — it arrives on time rather than late. The spec's own lean was the host task; the deciding argument is that §10.3's requirement is *at-startup with catch-up*, and a sidecar cannot satisfy that without Compose already being up, which is precisely the state the trigger exists to recover from. §11.2's portability requirement is honoured by keeping the task a thin wrapper around a portable `pg_dump` command line, so a Linux host later replaces it with a cron entry and changes nothing else.

**3.2 The content bundle is deferred to M2.** T4 §5.1 requires the bundle to ship embedded so the app is playable having never fetched it — that requirement is unchanged and still lands, but everything the bundle carries (enemies, moves, items, gear, drop tables) is battle content that nothing in M1 reads. The server owns `xp_curve` (T2 §1.1) and level-ups are never projected client-side (T4 §8.4), so M1's client needs no seeded content at all. Step 10 of T4 §8.1's pass is therefore a version poll that stores the number and fetches nothing until M2.

**3.3 `GET /content/version` becomes authenticated when registration lands.** DECISIONS 2026-08-01 left this open specifically until there was something to authenticate with, and named it "the only endpoint on the surface where staying unauthenticated would be defensible — and that should be a decision rather than an oversight." P3 makes it the decision.

**3.4 Onboarding ends after naming.** GDD 10's eleven screens split across three milestones; M1 takes 1–4 and routes straight into the tabs. This is the expected shape of a vertical slice, not a deviation — M2 inserts screens 5–7 between naming and the hub, and the (onboarding) stack is built with that insertion in mind.

---

## 4. Packets

Each packet is one commit, following M0's `Phase 2 - M1: <name> (P<n>)` convention.

### P1 — Housekeeping & toolchain

- Delete `api/Traverser.Tests/UnitTest1.cs` — the template stub, currently one of 21 passing tests and asserting nothing.
- Prune the template's web-facing deps, left installed at M0 close-out for a deliberate pass: `react-native-web`, `react-dom`, `expo-web-browser`, `@expo/ui`, `expo-glass-effect`, `expo-symbols`.
- Install M1's: `expo-sqlite`, `expo-secure-store`, `zustand`, `react-native-health-connect@3.5.3`.
- Stand up the JS test harness — `jest-expo` + `@testing-library/react-native` (T4 §12). **The project has no JS test runner at all today**; P6's pure derivation tests are the first thing that needs it.
- `npx expo prebuild --clean && npx expo run:android` to prove the prune broke nothing. ↯ The health-connect config plugin adds two manifest entries (T3 §2), so this is a rebuild boundary, not a reload (T4 §3.2).
- Fix `traverser-dev-kickoff-prompt.md`'s stale "Today's Session" block (still says T2).

### P2 — Backups (T6 §10)

- `pg_dump -Fc` to a local folder **and** an already-synced OneDrive/Drive folder (§10.2). Off-machine is the copy that matters.
- Retention pruning: 7 daily, 4 weekly, 12 monthly (§10.4).
- Task Scheduler task with **both** a daily trigger and an at-startup trigger, run-if-missed (§10.3, decision §3.1 above).
- README section documenting the backup set — which at this point is three members (`infra/.env`, `traverser-release.keystore`, `~/.gradle/gradle.properties`) and gains a fourth at P8.

**Not here:** the restore drill. It runs at P9, against real data.

### P3 — Identity & auth (API)

- `POST /api/v1/players` — idempotent on the client-minted `player_id` (re-registering returns the existing profile and token rather than 409), mints the opaque bearer token, stores its SHA-256 hash in `auth_token`, inserts `player_zone_progress` for `olympion`.
- Bearer-token authentication filter; failures as RFC 9457 `ProblemDetails` with a `code` extension member (T2 §2).
- `GET /api/v1/players/me` — the full authoritative snapshot, and the mirror's one-shot repair path (T2 §3).
- Authenticate `GET /content/version` (decision §3.3).

### P4 — Sync transaction (API)

- `POST /api/v1/sync`, one Postgres transaction, `READ COMMITTED`, opening `SELECT … FOR UPDATE` on the player row.
- Steps **1** (ingest deltas, `ON CONFLICT DO NOTHING RETURNING` — everything downstream computed from the returned rows only), **3** (additive `activity_day` rollup, `step_goal_snapshot` on insert only), **4** (XP derivation), **5** (XP application and the `xp_curve` walk, hard stop at 60, remainder discarded), **6** (`lifetime_steps`).
- Step 6 is included despite Leagues being an M3 display concern: `lifetime_steps` must accrue from the first sync or the Waymarker's history is permanently wrong.
- `POST /players/me/allocations` on the `client_operation` ledger — zero rows from `ON CONFLICT DO NOTHING` is success, not an error (DECISIONS 2026-08-01).
- `GET /players/me/activity?from=&to=`, `PATCH /players/me/settings` (step goal, birth year).

**Tests (delegable — expected values are already locked):**
- Level curve against fixtures §4; XP rates against fixtures §9.
- **Tier 3's 20-minute cap evaluated against the day's post-merge cumulative minutes**, not against the delta in isolation — fixtures §11.6. T2 §4 flags this as the single easiest way to get the transaction wrong, and notes it fails silently in the player's favour, so no bug report will ever surface it.
- **The replay test.** Apply a sync payload, apply the byte-identical payload again, assert 0 XP, 0 Leagues, and a byte-identical `player` block. T2 §4 calls this the first integration test worth writing and T2 §8 says that if a future change breaks the design, it breaks here.

### P5 — Client storage (T4 §6)

- One `traverser.db`, opened once at boot, pragmas `WAL` / `foreign_keys = ON` / `synchronous = FULL`.
- Forward-only migrations under `PRAGMA user_version`, applied in a transaction at boot before anything reads, with the version bump **inside** the same transaction as the DDL.
- Mirror tables (the M1 subset of tech-01 §4) plus the five device-only tables: `outbox`, `step_watermark`, `hr_minute_watermark`, `hr_session_ledger`, `read_watermark`.
- Bearer token in `expo-secure-store`, never in SQLite (T4 §6.4).

**Tests:** migration application, `outbox` FIFO drain and survival across process death, and the watermark-advance ordering from T3 §8.4 — a crash between read and enqueue must re-read the same window and produce the same deltas.

### P6 — Health derivation (T3 §5, §8)

Pure logic first, platform second.

- `derive.ts` — whole-minute bucketing on mean BPM, tier assignment with `ceil` thresholds off `HRmax = 220 − age`, session segmentation. A gap of exactly 10 sub-Tier-1 minutes does **not** close a session; the 11th does.
- `deltas.ts` — per-date step high-water marks and per-`(date, tier)` HR marks. A downward provider revision mints nothing **and does not lower the mark**.
- **The client ships raw, uncapped Tier 3 minutes** (T3 §5.5). Applying the cap here as well as on the server would charge the discount twice and quietly underpay a hard workout.
- `provider.ts` (the interface that is T3 §11's iOS seam) and `healthconnect.ts` (the only file that imports the library).

↯ Four places the spike proved the web instinct wrong, all of which live here:
- `getSdkStatus` → `initialize` runs on **every** pass, not once at onboarding — a permission change in Health Connect settings restarts the app process.
- `getGrantedPermissions` is the authority, never `requestPermission`'s return, and is matched by exact `recordType` — granting Steps silently also grants `StepsCadence`, so array length and index are both meaningless.
- Reads **throw** on a missing permission; they do not return empty. Every call is wrapped and the exception maps to banner state.
- Reads are **paginated at 1000 records**. No read of any type bypasses the `pageToken`-following helper (T4 §8.2).

**Tests:** everything above is a pure function over plain data and asserts against fixtures §11 with no device, no renderer, and no Expo — §11.7 pins the high-water-mark rules, §11.3 the gap boundary, §11.8 the earlier-ID-wins session merge.

### P7 — Sync orchestration & state (T4 §8)

- The ordered foreground pass, steps 1–13, with its two transaction boundaries: step 8 (deltas + watermarks, after which everything is retryable) and step 12 (apply response, delete drained outbox rows).
- **Steps 10–13 are best-effort.** If the server is unreachable the pass *succeeds* having stopped after step 9 — that is the normal case, not the error case (T2 §1.2).
- `dto.ts` — the single `snake_case` ↔ `camelCase` boundary; nowhere else in the app sees a wire key.
- `projection.ts` — optimistic XP and Leagues flagged `provisional`, the server's numbers **replacing** the projection outright, and the correction rendered with no annotation of any kind. **Level-ups are never projected** (T4 §8.4).
- Zustand store holding the hydrated hot slice only; SQLite is written first, always.

The client duplicates GDD 1 §2's XP rates (1 per 20 steps; 3/5/7 per tier-minute) for the projection. That duplication is deliberate and bounded — the server remains the authority, the curve is never duplicated, and the projection is discarded rather than reconciled.

### P8 — Screens

- `(onboarding)`: 01 splash → 02 health permission (+2a denied fallback, non-blocking) → 03 story (four lines, GDD 10 §4, not skippable on first launch) → 04 name **+ birth year** (T3 §1.4's logged GDD 10 deviation) → tabs.
- **Restore-from-backup branch** at first launch, accepting an exported `player_id` + token instead of registering (T6 §13.1).
- `(tabs)`: the 3-tab bar; Map and Inventory as stubs.
- Character/Avatar: placeholder Traverser sprite, level + XP bar, health-permission banner when denied. No streak badge, no Rest Day control (M4).
- Character/Stats: the six-stat allocation panel with an unspent-points indicator and a per-stat stepper, permanent on confirm; the activity log as a `FlatList` (↯ a `.map()` over hundreds of rows visibly janks).
- Settings: **identity export**, step goal, birth year, health-permission status + deep link. No audio sliders (M5).
- Every full-screen overlay gets an explicit answer to "what does hardware back do here" — silence ships a bug (T4 §4.2).

### P9 — Device build, first real sync, drills

- Build to the Pixel, walk, sync, watch the level go up.
- **Restore drill (T6 §10.6)** — `createdb` → `pg_restore` → spot-check a known `activity_day` row, the player's level, and the `xp_curve` row count → `dropdb`. The M1 drill is the important one: it is the cheapest possible moment to discover the dump command has a typo in it.
- Add the exported identity file to the backup set, making it four members.
- Opportunistically close T3 §12's two uncharacterised probes: **2** (backfill latency — read at +5min/+1h/+6h/+24h after a workout) and **9** (long gap — leave the app closed >48h with activity happening). Both fallbacks are "widen the constant" and re-reads are idempotent by §8, so neither is a blocker; they are simply cheap to observe once real syncing is happening daily.

### P10 — Close-out review

**This packet exists because M0 did not have it.** M0's review happened *after* its wrap-up commit and needed an unplanned seventh packet (`traverser-m0-plan.md` §4.1) to build four schema amendments that had been written into the spec but never migrated, strip the template, and add the asset pipeline. That was cheap at M0, which had no users and no data. The same review at M1 lands on top of real, unreproducible fitness history — so it runs before the wrap-up, and **whatever it finds is fixed in this packet**.

Checklist, each item drawn from something M0 actually missed or nearly missed:

1. **Every spec amendment written during M1 has code behind it.** The M0 failure mode exactly: tech-01 was amended on 07-31 and the migration arrived on 08-01, so "schema delivered" was true only of the pre-amendment schema for a day. An amended spec with no migration is a promise, not a change.
2. **Every packet's stated tests exist and assert against fixtures**, not against values transcribed from prose or — worse — from the implementation.
3. **Every T2 §4 step declared in-scope at §2.1 is implemented, and every step declared out has a named milestone.** A stubbed step with no home is a silent scope cut.
4. **The obligations are discharged, not merely built:** the backup task has run unattended at least once, the restore drill has actually passed, and the identity export file is in the backup set. §10.6's whole point is that an untested backup is not a backup.
5. **Nothing is deferred silently.** Every deferral has a `DECISIONS.md` line or a row in §2.2.
6. **`dotnet test`, `tsc --noEmit`, and the jest suite are green, and the tree is clean.**
7. **Any `⟨verify⟩` marker M1 touched is resolved**, or explicitly re-scoped to a later milestone with a reason.

If the review turns up something too large to absorb here, that is a signal the milestone is not finished — not a reason to open a P11. An empty diff is the good outcome, not a wasted packet.

### P11 — Wrap-up

- README and `DECISIONS.md` updates; any tech spec amended in place, following the dated-blockquote convention.
- Mark this plan complete and note where the delivery diverged from it, in the shape of `traverser-m0-plan.md` §4.1 — the divergences are the part a future milestone actually learns from.
- `traverser-m2-plan.md`.

---

## 5. Exit criteria

Verified at P10, before the wrap-up. M1 is done when, on the Pixel:

1. A fresh install registers a guest profile and reaches the Character screen.
2. A real day's walking appears as steps, converts to XP at GDD 1 §2's rates, and levels the Traverser up with 3 allocatable points per level.
3. Heart-rate minutes from a real workout appear as tier minutes and pay the correct bonus XP, with the Tier 3 cap applied server-side against the day's cumulative total.
4. The activity log lists prior days with their step, tier-minute, and XP breakdown.
5. Denying health permission leaves the app fully usable with the banner showing, per GDD 10 §3.2.
6. Killing the app mid-sync loses nothing — the outbox drains on the next foreground.
7. The API being off is invisible: steps still appear, and reconcile quietly when it comes back.
8. The nightly dump has run at least once unattended, the restore drill has passed, and the identity export file is in the backup set.

---

## 6. Cross-spec flags

- **T6 §10.3's `⟨Decide at M0⟩` marker is resolved by §3.1** and gets a `DECISIONS.md` line when P2 lands. It is the last live decision marker in the spec set; the remainder are scoped "at the time" or to M5.
- **T6 §13.1 closes at P8.** It has been an outstanding obligation since Phase 1 close-out (2026-07-26) and is the reason T6 §10's backup deliverable was incomplete rather than merely unbuilt.
- **T2 §7's M1 line is satisfied by P4** — "§4 is M1's spine, with steps 7–11 stubbed until their milestones." §2.2 above records which milestone each stubbed step belongs to, so no step is stubbed without a named home.
- **T4 §12's "the eight fixtures T3 §10 owes must exist before that code is written"** is already satisfied — they were delivered as fixtures §11 at Phase 1 close-out. P6 asserts against them rather than authoring them.
- **M2 inherits** the content bundle (§3.2), GDD 10 screens 5–7, and T2 §4 step 2. The `(onboarding)` stack built at P8 is shaped for that insertion.
- **Manifest:** M1 introduces no content IDs. `player_id`, delta IDs, and operation IDs are runtime UUIDs, not manifest keys.
