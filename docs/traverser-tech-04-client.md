# Traverser Tech Spec — T4: Client Architecture

**Status:** locked. Inputs: GDD Sections 9, 10, 11, 13, 14 · `traverser-tech-01-data-model.md` · `traverser-tech-02-api-sync.md` · `traverser-tech-03-health.md` · `traverser-data-manifest.md` · `DECISIONS.md` (spike/health-connect, 2026-07-26) · sanctioned scope trims.
**Scope:** the workflow decision (Expo/CNG vs. bare), the navigation tree behind GDD 13's 3-tab structure, the state architecture, on-device durable storage, the sync orchestration that stitches T3's read to T2's transaction, and the asset pipeline that turns a manifest key into a sprite or a sound. No screen code, no components, no package installs this session — those land in M0/M1.

**A note on sourcing.** Every version-sensitive claim below was checked against current Expo documentation rather than recalled. Where the documentation index lags the SDK this project is actually on (the spike ran on **Expo SDK 57**; the doc corpus is authoritative through SDK 55), the claim is marked **⟨verify⟩** and Matthew should confirm before it is relied on. Nothing marked that way changes the architecture — only the exact API surface.

**↯ markers.** Every place React Native diverges from a habit that transfers cleanly from web React is marked **↯**. §11 collects them into one table; the inline markers are where they actually bite.

---

## 1. Decisions

**1.1 Expo with Continuous Native Generation. The `android/` directory is generated, not committed.**
The "managed vs. bare workflow" question this session was convened to answer no longer has the shape it used to. Expo's own glossary now records **bare workflow as deprecated terminology** — the distinction was retired, and all projects are described in terms of **CNG**: `app.json` plus config plugins are the source of truth, and `npx expo prebuild` generates `android/` on demand. So the real decision is narrower than "Expo or not": it is *do we check in the native project*. We do not.

The reason is specific to this project rather than general preference. T3 §2 requires two pieces of Android manifest plumbing — an `ACTION_SHOW_PERMISSIONS_RATIONALE` activity and a `ViewPermissionUsageActivity` alias — and `react-native-health-connect` ships a config plugin that writes both. Under CNG that plumbing is a declarative line in `app.json` that survives every SDK upgrade. Under a committed `android/`, it is a hand-edited XML file that has to be re-reconciled by hand at every upgrade, and T3 already flagged that a broken rationale target *fails silently*. Committing the native project would take a category of silent breakage and make it permanent.

What this costs: nothing that matters here. `expo run:android` builds locally, on Matthew's machine, with no EAS involvement — this is the documented local-build path, not a workaround, and it satisfies the $0 constraint outright. Native customisation beyond what plugins express is possible via a local config plugin (a small JS file in the repo) or `expo-build-properties`; the escape hatch is `npx expo prebuild --clean`, which is always available and is not a one-way door.

**Consequences to hold onto:**
- `android/` goes in `.gitignore`. Anything a developer edits inside it is *deleted by the next prebuild*. This is the single most expensive thing to learn by accident.
- The New Architecture is not optional. SDK 54 was the last release where it could be disabled; from SDK 55 on, `newArchEnabled: false` has no effect. On SDK 57 the app is New-Architecture-only, which means any third-party native library must be New-Arch-compatible or it is simply not a candidate. `react-native-health-connect` 3.5.3 is already proven on-device by the spike.
- Expo Go is not usable for this project and never will be — `react-native-health-connect` requires a development build (T3 §2). This is already how the spike ran.

**1.2 `expo-router` for navigation; the route tree *is* GDD 13 §2.2's screen inventory.**
File-based routing, shipped with Expo, built on React Navigation underneath. Ten screens map to ten files, the 3-tab bar is one `_layout.tsx`, and deep links (which we need — the Health Connect settings round-trip and the local notification tap-through both re-enter the app) come free rather than being hand-wired. §4 gives the tree.

**1.3 SQLite is the local mirror, and it mirrors tech-01's tables.**
`expo-sqlite`, one database file, holding: the cached content bundle, the player mirror, the durable delta queue, T3's per-date step high-water marks, T3 §6's session ledger, and an in-progress battle snapshot. One durability mechanism for everything that must survive process death, one transaction boundary when a sync response is applied, and the activity log (GDD 13 §3.2, a reverse-chronological paged list) is a real indexed query rather than a JSON array held in memory. The mirror's repair path is T2's `GET /players/me` applied in a single transaction — the schema matching tech-01 is what makes that a straight write rather than a translation layer.

**1.4 Zustand for state, and deliberately no server-cache library.**
The instinct carried from web React is TanStack Query — and it is wrong here, which is worth stating rather than leaving to be discovered. TanStack Query manages a *cache of a server you can reach*. This app's server is off by design (T2 §1.2), reachable perhaps once a session, and everything the UI reads comes from the local mirror whether or not a sync happened. There is no cache to invalidate and no stale-while-revalidate story; there is a mirror, and a sync that writes to it. Adding a query library would put a second, weaker cache in front of the real one.

So: **Zustand holds view state and a hydrated projection of the mirror; SQLite holds truth.** Writes go to SQLite first and the store is updated from the write's result, never the reverse.

**1.5 The asset registry is generated from the manifest, and every key resolves at build time.**
CLAUDE.md's rule — *asset lookups by manifest key only, no hardcoded filenames* — cannot be implemented the way it would be on the web, because Metro resolves `require()` at build time and a dynamic path does not work at all (§9.1, ↯). A codegen step reads `traverser-data-manifest.md` and emits a static require map. A missing sprite becomes a build failure and a missing manifest key becomes a type error. Placeholder art ships for every key from M0, so the art phase swaps files and touches no logic.

**1.6 Audio is a module, not a component.**
GDD 14 §3.1 requires `mus_hub` to persist *uninterrupted* across sub-tab switches, across Character ↔ Inventory switches, and underneath pushed screens. A player tied to a screen component's lifecycle cannot do that. The audio bus lives outside the React tree, is driven by route changes and explicit game events, and owns the two volume buckets and the mute toggle GDD 13 §7 exposes in Settings. §10.

---

## 2. Conventions

- **TypeScript strict.** `strict: true`, `noUncheckedIndexedAccess: true`. Manifest keys are string-literal union types generated alongside the asset registry (§9.2), so an invalid `enemy_harpie` is a compile error, not a missing-sprite report from a playtest.
- **`snake_case` on the wire, `camelCase` in the app.** T2 §2 fixes the wire format to match tech-01's columns. The mapping happens in exactly one place — a typed DTO layer at the sync boundary — and nowhere else in the app is a `snake_case` key ever seen. The on-device SQLite schema keeps `snake_case` column names to match tech-01, so the mapping layer serves the database too.
- **Integers stay integers.** T2 §2 puts decimal values on the wire as strings. They are parsed to `number` only where a formula needs them and never round-tripped through `float` arithmetic before being compared to a fixture.
- **All money-equivalent state — steps, XP, minutes, queue entries — is written inside a transaction, and never held only in memory.** The Android process can be killed at any moment with no callback (↯ §11).
- **Time.** `activity_date` is a bare `YYYY-MM-DD` computed on-device in the player's local timezone (T2 §2). The device's IANA timezone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone` — available on Hermes on Android — and is sent at registration and on every sync. Instants are ISO-8601 with offset. **A local-naive string is never sent to Health Connect** — the spike proved it throws (`DECISIONS.md`, probe 5); the filter takes a UTC instant and the library does the local conversion itself.

---

## 3. Workflow, toolchain, and what a rebuild costs

### 3.1 The stack

| Concern | Choice | Note |
|---|---|---|
| Framework | Expo SDK 57, CNG (§1.1) | New Architecture only ⟨verify for 57⟩ |
| Build | `npx expo run:android` locally | Never EAS (CLAUDE.md) |
| Navigation | `expo-router` | §4 |
| State | `zustand` | §5 |
| Local DB | `expo-sqlite` | §6 |
| Token storage | `expo-secure-store` | §6.5 |
| Health | `react-native-health-connect` 3.5.3 | Proven on-device by the spike |
| Audio | `expo-audio` | §10. **Not `expo-av`** — deprecated, removed in SDK 55 |
| Animation | `react-native-reanimated` | §11 |
| Notifications | `expo-notifications`, local only | No FCM (trim) |
| Errors | `@sentry/react-native` | Sentry only (trim) |
| Test | `jest-expo` + `@testing-library/react-native` | §12 |

### 3.2 ↯ The rebuild boundary — the most expensive web habit to carry over

On the web, every change is a reload. Here there are two classes of change and they cost three orders of magnitude apart:

- **JS/TS/asset change** → Fast Refresh, sub-second, no rebuild.
- **`app.json`, a config plugin, a new native dependency, a permission, an app icon, the package name** → the JS bundle reloading proves *nothing*. The native project must be regenerated and reinstalled: `npx expo prebuild --clean && npx expo run:android`. Minutes, not seconds.

The failure mode is that a change to `app.json` appears to do nothing and the natural next move — reload, clear cache, restart Metro — is all in the wrong layer. The rule: **if it isn't JavaScript, it needs a rebuild.**

### 3.3 ↯ Metro is not webpack

No code splitting, no lazy routes, no dynamic `import()` of a chunk fetched at runtime. Everything ships in one bundle. `React.lazy` will not help startup, and route-level splitting — reflexive on the web — has no analogue. Startup cost is managed by *doing less work at boot* (§7.1), not by shipping less code.

---

## 4. Navigation

### 4.1 The route tree

GDD 13 §2.2 lists ten screens. They map one-to-one:

```
app/
  _layout.tsx                     Root Stack. Owns: providers, audio bus mount,
                                  sync-on-foreground listener, splash gate.
  index.tsx                       Boot router — redirects to (onboarding) or (tabs).

  (onboarding)/
    _layout.tsx                   Stack, gesture-back disabled, no tab bar.
    01-splash.tsx … 11-hub.tsx    GDD 10's eleven screens (03 carries the
                                  birth-year field — T3 §1.4 deviation).

  (tabs)/
    _layout.tsx                   The 3-tab bar. GDD 13 §2.1 order:
                                  character | map | inventory.
    character/
      _layout.tsx                 Sub-tab switcher (Avatar ↔ Stats). NOT a nested
                                  navigator — see §4.3.
      index.tsx                   Screen 1  — Avatar
      stats.tsx                   Screen 2  — Stats & Activity Log
    map/
      _layout.tsx                 Stack (Map → Boss Gate Detail).
      index.tsx                   Screen 3  — Map
      gate/[gateId].tsx           Screen 4  — Boss Gate Detail (pushed)
    inventory/
      _layout.tsx                 Segmented control (Gear ↔ Items ↔ Bestiary).
      index.tsx                   Screen 6  — Gear
      items.tsx                   Screen 7  — Items
      bestiary.tsx                Screen 8  — Bestiary

  battle.tsx                      Screen 5  — full-screen modal, root-level
  settings.tsx                    Screen 10 — pushed from Character's gear icon
  zone-entry/[zoneId].tsx         Screen 9  — full-bleed overlay
```

`battle.tsx` and `zone-entry/` sit at the **root** stack, not inside `(tabs)`, which is what makes them cover the tab bar. GDD 13 §2.1 requires battle to open over whatever screen the player was on and return to that same screen — a root-level modal route does exactly this, because dismissing it pops back to whatever was underneath without the tab tree ever unmounting.

### 4.2 ↯ Modal presentation is not a web modal

`presentation: 'modal'` is a *navigation* mode, not a DOM overlay. Consequences that surprise:

- **On Android the modal is a full-screen push**, not a sheet. That is what GDD 13 wants for Battle, so this is free — but it means "modal" here does not imply a card, a backdrop, or a dimmed parent. Any visual dimming is drawn by hand.
- **The screen underneath stays mounted.** Its effects keep running, its timers keep firing. This is a feature (the Map's music continues underneath the Boss Gate Detail exactly as GDD 14 §3.1 requires) and a trap (a screen you thought was gone is still subscribed).
- **The Android hardware back button is a real input with no web analogue.** By default it dismisses the modal. During an active battle it must not — GDD has no "abandon battle" affordance. The battle route intercepts back via `BackHandler` inside `useFocusEffect` and swallows it. Every full-screen overlay (battle, zone-entry narrative, the overflow keep/discard modal) needs an explicit answer to "what does hardware back do here", and *silence is an answer that ships a bug*.

### 4.3 ↯ Sub-tabs are state, not routes — with one deliberate exception

GDD 13 §5 is explicit: switching Inventory sub-tabs *"carries no state loss (all three sub-tabs stay mounted)"*. A nested navigator would satisfy that. But there is a cheaper correct answer, and the two cases differ:

- **Inventory (Gear/Items/Bestiary)** — a segmented control over three always-mounted views inside one route. No navigator, no route change, mount-state preserved by construction, and the Inventory tab icon's road-find badge (GDD 13 §5.2) has one owner. Sub-tab choice is component state; it does **not** persist across app restarts (GDD 13 §5.1 names Gear the default sub-view, so the default is what a cold start shows).
- **Character (Avatar/Stats)** — same treatment, same reasoning.
- **Map → Boss Gate Detail** — a genuine `Stack`, because it is a real push with a real back affordance and GDD 14 §3.1 requires the Map's music to continue underneath it.

The rule for the future: something is a route when it pushes, is deep-linkable, or needs its own back behaviour. Otherwise it is state. This is roughly the web instinct, but the cost asymmetry is different — a route change in RN remounts and re-runs effects far more visibly than a web route change with a warm DOM.

### 4.4 Route-driven side effects

Two subsystems observe navigation rather than being called by screens:

- **Audio** (§10): the current route selects the track per GDD 14 §3.2 — but only via the *Waymarker's* zone, never the Map's scroll position (GDD 14 §3.2 is explicit).
- **Banner host**: GDD 13 §6.5 requires the overactivity warning to render *"on whichever screen is frontmost at the moment sync completes."* This is a single host mounted in the root layout that renders above the current route, not a component each screen remembers to include. The permission-denied banner (GDD 13 §3.1) is Character-screen-only and uses the same component through the same host, scoped by route.

---

## 5. State architecture

Four layers, distinguished by *what invalidates them*. Conflating any two is where this kind of app usually rots.

| Layer | Lives in | Owned by | Invalidated by |
|---|---|---|---|
| **L1 Content** | SQLite, read-only | Server (`content_version`) | A version bump (T2 §3) |
| **L2 Mirror** | SQLite | Server, projected locally | A sync response; repairable from `GET /players/me` |
| **L3 Session** | Zustand + a SQLite snapshot | Client | Battle end, app restart |
| **L4 Ephemeral** | Component state | Component | Unmount |

### 5.1 L1 — the content bundle

Fetched only when `GET /content/version` moves (T2 §3), stored in SQLite tables mirroring tech-01 §3, and read by the battle engine and every display path. **The app must be fully playable having never fetched it once** — the bundle ships embedded in the binary as a seed, at the `content_version` current at build time, and the first successful sync upgrades it. Without that, a fresh install with the PC off is an app with no enemies in it.

### 5.2 L2 — the mirror

Tech-01's player tables, on-device. Written **only** by: a sync response, an optimistic projection (§8.4), or a local write that is simultaneously queued for replay (T2 §3's progression writes). Never written by a UI component directly.

Zustand holds a **hydrated projection** of the small, hot slice — level, XP, unspent points, Leagues, streak, equipped gear, current Vigor — so screens read synchronously without touching SQLite on every render. Large or paged data (activity log, bestiary, item grid) is queried on demand and never mirrored into the store.

**↯** On the web, `useState` + a fetch is usually enough because a reload rebuilds everything from the server. Here the store is a *cache of a cache* and it can be stale in one direction only: SQLite is always at least as fresh. Any read path that could observe the store mid-write reads SQLite instead.

### 5.3 L3 — session state, and why a battle must be persisted

The battle engine is client-side (sanctioned trim; T5 owns it). Battle state is ephemeral by nature — but the Android process can be killed while the app is backgrounded, without warning and without a callback (↯ §11). A player who takes a phone call mid-boss and comes back to a lost fight, having spent items and uses, has lost real progress.

**Therefore: a battle snapshot is written to SQLite after each resolved turn**, and a cold start with an unresolved snapshot resumes the fight. This is not a performance concern — a turn is a user action seconds apart, and the write is a few hundred bytes. The alternative is a data-loss bug that only reproduces under memory pressure.

The snapshot is a T5 shape; T4 owns only the guarantee that a durable slot exists and is written inside the same transaction that spends an item or a use.

### 5.4 L4 — ephemeral

Component state. The stat-allocation stepper's pre-confirm values (GDD 13 §3.2), the open/closed state of a comparison view, scroll positions. Confirmed allocation leaves L4 for L2 and the replay queue in one transaction.

---

## 6. Local storage

One SQLite database, `traverser.db`, opened once at boot with `openDatabaseSync` and held for the process lifetime.

### 6.1 Pragmas, set at open

```
PRAGMA journal_mode = WAL;    -- concurrent read during write; survives kill
PRAGMA foreign_keys = ON;     -- OFF by default in SQLite
PRAGMA synchronous = FULL;    -- see below
```

`synchronous = FULL` rather than the usual `NORMAL`. The normal argument for `NORMAL` is that a crash can lose the last transaction, and that is acceptable for a cache. It is not acceptable here: the last transaction is frequently *the delta queue write that just consumed a health read*, and T3 §8.4 orders the watermark advance strictly after that write precisely so nothing is lost. `NORMAL` would put a hole in the middle of that guarantee. The cost is a few extra milliseconds on writes that happen a handful of times per session.

### 6.2 Tables

Mirrors of tech-01 §3 (content) and §4 (player), plus five tables that exist only on-device:

| Table | Purpose | Spec |
|---|---|---|
| `outbox` | The durable delta/write queue: `client_op_id` (UUIDv7 PK), `kind`, `payload` JSON, `created_at`, `attempts`. FIFO by `created_at`. | T2 §5 |
| `step_watermark` | `(activity_date) → reported_high_water`. The per-date step high-water mark. | T3 §8.1 |
| `hr_minute_watermark` | `(activity_date, tier) → reported_minutes`. Same discipline, per tier. | T3 §8.2 |
| `hr_session_ledger` | Derived session identity with a **frozen `started_at`**, so backfill cannot shift a session's ID. | T3 §6, `DECISIONS.md` 2026-07-25 |
| `read_watermark` | The single end-instant of the last successfully-consumed health read. | T3 §4.1, §8.4 |
| `battle_snapshot` | At most one row. §5.3. | T5 |

`outbox` is one table, not one per write type: T2 §3's progression writes and T2 §5's activity deltas share the same durability, ordering, and retry requirements, and splitting them would mean two drain loops that can disagree about order.

### 6.3 Migrations

`PRAGMA user_version` as the schema version, a numbered array of forward-only migration functions, applied inside a transaction at boot before anything reads. No down-migrations — a rollback in dev is `adb uninstall`.

**↯** There is no server-side migration runner and no `dotnet ef database update` here. The database is on a device you may not be holding, and a migration that throws at boot is an app that cannot start. Every migration must be idempotent-safe to re-run after a crash mid-apply — which the transaction gives, provided `user_version` is bumped *inside* the same transaction as the DDL.

### 6.4 What is *not* in SQLite

- **The bearer token** — `expo-secure-store` (Android Keystore-backed). It is a credential and does not belong in a database file that a rooted device or a debug build can read trivially. T2 §1.4.
- **Volume settings, mute, birth year, step goal** — these are mirror fields (`player_settings`, tech-01 §4) and go in SQLite with everything else. There is no separate preferences store; a second persistence mechanism for four values is how state ends up in two places disagreeing.

**↯** No `localStorage`, no `IndexedDB`, no cookies, and no synchronous global storage of any kind — except `expo-sqlite/kv-store`, which is a SQLite-backed drop-in for `AsyncStorage` and does offer synchronous `getItemSync`/`setItemSync`. It is not used here: everything durable is already relational, and a second key-value surface next to the mirror invites exactly the split-brain §6.4 is trying to avoid.

### 6.5 ↯ Uninstall is total, and there is no recovery

Secure storage and the app's database are both removed on uninstall. Since `player_id` is device-minted and guest-only (T2 §1.4), **a reinstall is a new player with no path back to the old profile** — the server still holds it, but nothing on the device knows its ID. This follows directly from the guest-only trim and is not a defect, but it is a real consequence that has not been written down anywhere until now, and it should be understood before any long play session is treated as precious. Recovery arrives with real auth (T2 §8). Flagged in §14.

---

## 7. Application lifecycle

### 7.1 Cold start

Ordered, and the ordering is the startup budget:

1. Native splash holds (`expo-splash-screen`, `preventAutoHideAsync`).
2. Open SQLite, apply migrations (§6.3).
3. Read the boot slice: onboarding-complete flag, player row, settings.
4. Hydrate the Zustand projection (§5.2).
5. Route: `(onboarding)` or `(tabs)`.
6. Hide splash. **The app is now interactive.**
7. *After* the frame: mount the audio bus, start the foreground sync (§8), preload the current screen's assets.

Steps 1–6 touch the network zero times and the health provider zero times. A sync that takes eight seconds against a PC that is off must never be something the player waits through — T2 §1.2's "the server is normally unreachable" is a startup requirement, not just a networking one.

### 7.2 ↯ Foreground, background, and death

`AppState` replaces `visibilitychange`, and the differences matter:

- `AppState.addEventListener('change', …)` with a transition to `'active'` is the sync trigger (T2 §4, T3 §1.5). This is the *only* sync trigger. Nothing is scheduled, nothing polls.
- **`'background'` is not `beforeunload`.** There is no reliable last-chance hook; the process may be killed later with no further callback. Anything that must survive is already written (§2, §5.3).
- **Timers do not run in the background.** `setInterval` is throttled or stopped outright. Nothing — audio fades, session liveness, streak evaluation — may assume elapsed wall-clock time was observed. Elapsed time is always computed from timestamps, never accumulated by a ticker.
- The **first** foreground after a permission change in Health Connect settings is a *cold start*, not a resume: the spike found that changing permissions restarts the app process (`DECISIONS.md`, 2026-07-26). The sync path must therefore call `getSdkStatus` → `initialize` every time, not just at onboarding — see §8.1.

---

## 8. Sync orchestration

T2 §4 specifies the server transaction. T3 §4–§8 specify the health read. T4 owns the sequencing between them, which is where the two specs actually meet.

### 8.1 The foreground pass, in order

```
 1. AppState → 'active'  (or cold start, step 7.1.7)
 2. getSdkStatus()              ── every time, per DECISIONS 2026-07-26
 3. initialize()                ── every time; per-process, not per-install
 4. getGrantedPermissions()     ── authority, not requestPermission's return
                                   Match by exact recordType. Granting Steps
                                   also silently grants StepsCadence, so array
                                   length and index are both meaningless.
 5. Read window [max(read_watermark, now−72h), now]         T3 §4.1
      steps: aggregateGroupByPeriod, UTC instant strings    T3 §4.2
      hr:    readRecords, PAGINATED — follow pageToken      §8.2
 6. Derive: bucket → tier → segment sessions                T3 §5
 7. Mint deltas against the watermarks                      T3 §8
 8. ── TRANSACTION ──
      insert deltas + hr_session rows into `outbox`
      update step/hr watermarks
      advance read_watermark                                T3 §8.4
    ── COMMIT ──                 Everything after this point is retryable.
 9. Optimistic projection → UI                              §8.4
10. GET /content/version → bundle fetch if moved            T2 §3
11. POST /sync with the full drained outbox                 T2 §4
12. ── TRANSACTION ──
      apply response to the mirror (server values REPLACE)
      delete outbox rows named in accepted_ ∪ duplicate_delta_ids
    ── COMMIT ──
13. Render: level-ups, grants, warnings, banners            §8.5
```

Steps 10–13 are all best-effort. If the server is unreachable, the pass **succeeds** having stopped after step 9 — deltas are durably queued, the watermark has advanced, the projection is on screen, and the player sees their steps. That is the normal case, not the error case (T2 §1.2).

### 8.2 ↯ Health reads are paginated — T4's assignment from the spike

The spike found this and nothing anticipated it: a 48-hour `HeartRate` read returned **exactly 1000 records** with a `pageToken` present — the default page cap. *A read that assumes one call returns the window silently truncates.* Silently, and in the player's disfavour, and only for players active enough to exceed the cap.

The read helper therefore loops:

```ts
async function readAllRecords(type, filter) {
  const out = [];
  let token: string | undefined;
  let pages = 0;
  do {
    const res = await readRecords(type, { timeRangeFilter: filter, pageToken: token });
    out.push(...res.records);
    token = res.pageToken;
    if (++pages > MAX_PAGES) { Sentry.captureMessage('health_read_page_cap'); break; }
  } while (token);
  return out;
}
```

`MAX_PAGES` is a guard against an unbounded loop, not a design limit — set it generously (72h of dense Fitbit data at ~1 record/minute is ~4,300 records, so ~5 pages; 50 is ample) and report reaching it rather than failing quietly. **No read of any record type bypasses this helper.**

### 8.3 ↯ Errors, not empty results

T3 §3 assumed a read without permission returns empty. The spike disproved it: it **throws** `HealthConnectException: SecurityException`. Every call in steps 2–5 is wrapped, and the exception maps to banner state rather than to a crash. `initialize()` not having been called throws too ("Health Connect client not initialized"), which is the same code path.

This is a place where the web instinct — a failed `fetch` resolves and you check `res.ok` — actively misleads. These reject.

### 8.4 Optimistic projection, and the quiet correction

T2 §5 requires the client to project XP and Leagues locally the instant a delta is minted, and requires the server's numbers to **replace** the projection outright on response — never add, never treat a lower server value as an error, never re-queue to make up a difference.

T2 §7 hands T4 the presentation half of that: *"the reconciliation must be visibly quiet — a corrected projection is not an error state and must not render as one."* Concretely:

- Projected values are stored in the mirror flagged `provisional`. A replacing sync response clears the flag.
- A correction **animates** to the new value on the same component, using the same transition as any other value change. There is no toast, no colour change, no "synced!" confirmation, and above all no downward-correction indicator.
- A correction that would reduce a *displayed* number is applied with no annotation whatsoever. The player never learns a projection was optimistic; that is the entire point.
- Level-up is the one thing **never** projected optimistically. The server owns the curve (T2 §1.1), and a Reveal Card celebrating a level-up that then un-happens is the single worst reconciliation artefact this design can produce. Level-ups render only from `level_ups` in the sync response.

### 8.5 Consuming the response

- `level_ups` → Reveal Card queue (GDD 13 §6.3), `stg_reveal_*` by tier (GDD 14 §3.5).
- `encounter_grants` → mirror. Spendable offline, whenever (T2 §1.3). The client never rolls an encounter.
- `warnings: [{code: 'overactivity'}]` → render **only if the session is live** by T3 §9's rule. A closed session's warning is dropped on the floor.
- `pending_rewards` → the overflow keep/discard modal (GDD 13 §5.1), which interrupts navigation.
- `streak` → the badge. A break is *quiet*: no notification, no "you lost your streak" copy, no red state (GDD 11 §4, and the sanctioned rule in CLAUDE.md).

---

## 9. Asset pipeline

### 9.1 ↯ Why this cannot be done the web way

The web instinct is `<img src={`/sprites/${key}.png`} />`. On React Native that is not merely discouraged, it **does not work**. Metro resolves `require()` at *build* time by static analysis; a template-literal path resolves to nothing. There is no public directory, no URL for a local file, and no runtime filesystem lookup for a bundled asset.

Every bundled asset must therefore appear as a literal `require('./path/to/file.png')` somewhere in the source. Since CLAUDE.md forbids hardcoded filenames in logic, the literals must exist *somewhere that isn't logic* — which is what makes codegen the answer rather than a nicety.

### 9.2 The generated registry

A build script (`scripts/gen-assets.ts`, run via `npm run gen:assets`, and in CI) parses `traverser-data-manifest.md` — the ID tables in §Enemies, §Skills, §Gear-Granted Moves, §Enemy Moves, §Battle Items, §Gear, and §Audio IDs — and emits two files:

```ts
// src/assets/keys.generated.ts
export type EnemyKey = 'enemy_harpy' | 'enemy_satyr' | … ;
export type GearKey  = 'gear_weapon_mortal' | … ;
export type MusicKey = 'mus_title' | 'mus_hub' | … ;
export type SfxKey   = 'sfx_button_tap' | … ;
export type AssetKey = EnemyKey | GearKey | ItemKey | MusicKey | StingKey | SfxKey;
```

```ts
// src/assets/registry.generated.ts
export const SPRITES: Record<SpriteKey, number> = {
  enemy_harpy: require('../../assets/sprites/enemy_harpy.png'),
  …
};
export const AUDIO: Record<AudioKey, number> = {
  mus_hub: require('../../assets/audio/mus_hub.ogg'),
  …
};
```

Both are committed (so a clean checkout builds without running codegen) and regenerating them is expected to be a no-op diff unless the manifest changed.

**Three checks, all of which fail the build:**
1. Every manifest key has a file. Missing → build error naming the key.
2. Every file has a manifest key. An orphan `enemy_gorgon.png` is a manifest omission, and CLAUDE.md's rule is *add to the manifest first*.
3. Filenames are exactly `{key}.png` / `{key}.ogg` (manifest §Rules 3).

**↯** This is the RN answer to a problem the web solves with a directory listing at runtime. It is more machinery than a web developer expects, and it buys something the web version does not have: a missing asset is caught at build time on Matthew's machine, not at 3,000 Leagues on a player's phone.

### 9.3 Placeholders from M0

Every manifest key gets a placeholder file from the first build: a flat-coloured PNG with the key rendered as text, and a short silent OGG. Consequences worth having:

- The three build checks are live from day one, so the manifest and the asset set never drift.
- No screen ever hardcodes a fallback path, so nothing needs revisiting when real art lands.
- A screenshot during development names its own missing assets.
- The art and audio projects deliver files into a directory, and nothing else in the repo changes.

### 9.4 Sprite composition — layered gear

GDD 13 §3.1 requires the Character avatar to render with equipped gear overlays (Section 8's layered-silhouette pipeline), and the same composed sprite is the Map's Waymarker (GDD 13 §4.2).

One `<TraverserSprite>` component: a base sprite plus up to four absolutely-positioned overlay layers, in fixed z-order **weapon → armor → accessory → trinket**, each resolved from the equipped `GearKey`. Layers share one coordinate space and one nominal frame size fixed at the art phase; the component scales the whole stack, never individual layers.

**↯** `zIndex` on Android is unreliable enough that it should not be load-bearing — **render order in the JSX is the z-order**, and the array is ordered deliberately rather than sorted. Likewise `overflow: 'hidden'` does not reliably clip transformed children on Android; the sprite frame must not depend on clipping to look right.

### 9.5 Loading and preloading

Static `require()`d images are bundled and resolve synchronously — no loading state, no layout shift, and the bundler supplies intrinsic dimensions. `expo-asset`'s `useAssets` exists for asynchronous cases and is **not** needed for anything here.

Audio does need warming: a first `play()` on a cold player has audible latency. §10.3.

---

## 10. Audio subsystem

`expo-audio`. Explicitly **not `expo-av`** — its Audio API is deprecated and was removed in SDK 55.

### 10.1 The bus

A plain module (not a component, not a hook) instantiated once at §7.1 step 7, holding:

- **Two music players.** Two, not one, because GDD 14 §5.1 requires a *0.8-second linear crossfade* — outgoing and incoming playing simultaneously. One player cannot crossfade with itself.
- **A small SFX pool** of pre-warmed players, round-robin allocated. GDD 14 §6.1 layers `sfx_crit` *on top of* a base impact sound in the same instant, so simultaneous playback is a requirement, not a nicety.
- **Two gain scalars and a mute flag** — `musicVolume`, `sfxVolume`, `muted` — mirroring GDD 13 §7's two sliders plus Mute All, and GDD 14 §2.8's confirmation that two buckets cover every asset (`mus_` vs. `stg_`/`sfx_`).

Every set of a player's volume computes `bucketVolume × duckFactor × (muted ? 0 : 1)`. Ducking never writes the bucket value, so a duck that is interrupted by a settings change cannot strand the volume at 20%.

### 10.2 ↯ There is no Web Audio API — fades are hand-written

The web reflex is `gainNode.gain.linearRampToValueAtTime(...)`. There is no equivalent. `expo-audio` exposes a settable `volume` and a `loop` boolean, and nothing that ramps.

Every timing rule GDD 14 §5 specifies — the 0.8s crossfade, the 0.3s duck to 20% on battle entry, the 1.5s defeat fade, the 0.5s flee fade, the duck-to-60%-and-return in §5.4 — is implemented by a single shared fade helper driving `player.volume` from a `requestAnimationFrame` loop, cancellable, with the target volume applied exactly on completion so no fade can leave a player at 0.97.

Per §7.2: a fade in progress when the app backgrounds is **cancelled and snapped to its target**, never resumed by elapsed-time assumption.

### 10.3 Warming and lifetime

Players for the current context are created ahead of use: the two music players at boot, the SFX pool at boot, and the current screen's likely stings when the route settles. Battle-specific tracks are created when the battle route mounts, not when the first hit lands.

`mus_hub` persisting across Character ↔ Inventory ↔ Settings (GDD 14 §3.1) falls out of the bus living outside the React tree: a route change asks the bus for a track, and the bus does nothing at all when the requested track is already playing. **↯** Tying a player to a screen's `useEffect` would restart it on every tab switch, which is precisely the behaviour GDD 14 §3.1 forbids — and it is exactly what the web habit of "effects own resources" produces.

### 10.4 Priority and queueing

GDD 14 §5.5's priority order is a comparator in the bus, not scattered call-site conditionals. `stg_reveal_*` is *queued* behind a victory sting rather than dropped (§5.5 is explicit that it plays immediately after the victory sting resolves), so the bus holds a one-deep queue for stings that queue and drops the rest by priority.

### 10.5 Open: intro-then-loop

GDD 14 §4.1/§4.2 specify a play-once intro followed by a seamless loop (4+32 bars ambient, 2+16 bars battle). `expo-audio`'s `loop` loops the whole file, which would replay the intro every cycle.

Two implementations exist: a two-player handoff scheduled off `currentTime`, or authoring intro and loop as separate files and starting the second on the first's completion. **Neither is gapless on Android by construction**, and whether the seam is audible is a question about real chiptune audio that does not exist yet.

**Recommendation for M-phase:** author each track as a single file whose intro is part of the loop body, accepting that the intro repeats. Revisit with real assets in the audio-production project; if the repeat is objectionable, the two-player handoff is a change inside the bus and touches nothing else. Logged in §14 as a flag to the audio project rather than silently decided here — it is the one place in this spec where a GDD structural requirement is not fully satisfied by the chosen library.

---

## 11. React Native divergences — the collected list

Every ↯ above, in one place, plus the ones that did not have a natural home. Ordered by how expensively they are usually learned.

| # | Web habit | What actually happens | §|
|---|---|---|---|
| 1 | Change a config file, reload | `app.json`/plugins/native deps need `prebuild` + rebuild. Reloading proves nothing. | 3.2 |
| 2 | Edit the platform project directly | `android/` is generated and **deleted by the next prebuild**. Config plugins only. | 1.1 |
| 3 | `<img src={dynamicPath}>` | Metro resolves `require()` at build time. Dynamic paths do not resolve at all. | 9.1 |
| 4 | `localStorage` / `IndexedDB` | Neither exists. SQLite or `expo-sqlite/kv-store`. No cookies. | 6.4 |
| 5 | `beforeunload` to save on exit | No such hook. The process can die with no callback. Write as you go. | 7.2 |
| 6 | `setInterval` keeps time | Throttled or stopped in background. Compute elapsed time from timestamps. | 7.2 |
| 7 | A failed request resolves; check `res.ok` | Health Connect calls **throw** — including for a missing permission and an uninitialised client. | 8.3 |
| 8 | One request returns the collection | Health Connect reads page at 1000. Follow `pageToken` or truncate silently. | 8.2 |
| 9 | Browser back button | Android hardware back is a real input. Every overlay needs an explicit answer. | 4.2 |
| 10 | Modal = overlay div | Modal is a navigation mode; on Android it is a full-screen push, with the parent still mounted. | 4.2 |
| 11 | `zIndex` orders things | Unreliable on Android. **JSX order is z-order.** `overflow: hidden` does not reliably clip transforms. | 9.4 |
| 12 | Web Audio gain ramps | No equivalent. Every fade in GDD 14 §5 is hand-written against `player.volume`. | 10.2 |
| 13 | Effects own resources | An effect-owned music player restarts on every tab switch — forbidden by GDD 14 §3.1. Keep it outside the tree. | 10.3 |
| 14 | Route-level code splitting | Metro ships one bundle. `React.lazy` does not help startup. | 3.3 |
| 15 | TanStack Query for server state | The server is normally unreachable. The mirror *is* the cache; a query layer adds a weaker second one. | 1.4 |
| 16 | `.map()` a list into the DOM | No free virtualization. `FlatList` for the activity log, bestiary grid, and item grid — a `.map()` over hundreds of rows visibly janks. | — |
| 17 | Strings anywhere in markup | Text must be inside `<Text>`. A bare string in a `<View>` throws at runtime. | — |
| 18 | CSS cascade, inheritance, `%` units | No cascade, no inheritance (except limited `Text` nesting), no `vh`/`vw`. `flexDirection` defaults to `column`, not `row`. | — |
| 19 | `onClick`, `:hover` | `Pressable`. No hover. Touch targets need explicit `hitSlop`; there is no mouse to be precise with. | — |
| 20 | CSS transitions/animations | `react-native-reanimated`. Animations run on the UI thread via worklets; a JS-thread animation stutters whenever JS is busy. | — |
| 21 | Long loop is fine, the browser copes | No web workers. A blocking loop freezes the UI outright. The battle engine is small enough to be safe; nothing else should assume so. | — |
| 22 | Uncaught error → console, page survives | Uncaught error in release → crash. Error boundaries plus Sentry are not optional. | 3.1 |
| 23 | Safe area is the viewport | Notches, gesture bars, and status bars overlap content. `SafeAreaView`/insets everywhere. | — |
| 24 | Fonts via `@font-face` | Loaded at runtime; text renders in the fallback until they resolve. | — |
| 25 | `process.env` read at runtime | Inlined at build time by Babel. Changing an env var needs a rebundle. | — |
| 26 | jsdom for tests | `jest-expo` + React Native Testing Library. Pure formula tests need neither. | 12 |

---

## 12. Testing

- **Formula and derivation tests are pure TypeScript** — no renderer, no device, no Expo. Everything in T3 §5 (bucketing, tiering, segmentation), T3 §8 (watermarks, delta minting), and T5's battle math is a pure function over plain data, tested directly against `traverser-test-fixtures.md`. Per CLAUDE.md: if code disagrees with a fixture, the code is wrong.
- **The eight fixtures T3 §10 owes must exist before that code is written.** T4 adds none of its own — it introduces no formulas.
- **Storage tests** run against `expo-sqlite`'s in-memory database: migration application, `outbox` FIFO drain and survival, watermark advance ordering (T3 §8.4 — a crash between read and enqueue must re-read the same window and produce the same deltas), and the sync-response transaction.
- **The replay test is the first integration test worth writing** (T2 §8): apply a sync response, apply the byte-identical response again, assert the mirror is unchanged and the outbox is empty.
- **Component tests** with RNTL are reserved for components with real logic — the comparison view's +/− diffing, the overflow modal's suggested discard, the type-effectiveness chevron. Not for layout.
- **The asset registry test** is the three checks in §9.2, run in CI.

---

## 13. Directory structure

```
app/                      expo-router routes only — thin, no logic (§4.1)
src/
  assets/
    keys.generated.ts       generated (§9.2)
    registry.generated.ts   generated (§9.2)
    sprite.tsx              <TraverserSprite>, layered gear (§9.4)
  audio/                    the bus, fade helper, priority comparator (§10)
  db/
    schema.ts               table DDL mirroring tech-01
    migrations.ts           forward-only, user_version (§6.3)
    outbox.ts               durable queue (§6.2)
    mirror.ts               typed read/write over the player tables
  health/
    provider.ts             HealthProvider interface — T3 §11's iOS seam
    healthconnect.ts        the only file that imports react-native-health-connect
    derive.ts               bucketing, tiering, segmentation — pure (T3 §5)
    deltas.ts               watermarks and minting — pure (T3 §8)
  sync/
    orchestrator.ts         §8.1's ordered pass
    dto.ts                  the single snake_case ↔ camelCase boundary (§2)
    projection.ts           optimistic preview + quiet correction (§8.4)
  battle/                   T5
  state/                    zustand stores (§5)
  ui/                       shared components — GDD 13 §8's component table
scripts/
  gen-assets.ts             manifest → registry codegen (§9.2)
assets/
  sprites/   {key}.png      placeholders until the art phase (§9.3)
  audio/     {key}.ogg      placeholders until the audio phase (§9.3)
```

`app/` holds routes and nothing else — a route file composes from `src/ui` and reads from `src/state`. This keeps GDD 13's screen inventory legible as a directory listing and keeps logic testable without a renderer.

Everything Health-Connect-specific is confined to `health/healthconnect.ts`, satisfying T3 §11's only standing obligation: *"§5–§9 must not reach for a Health Connect type directly."*

---

## 14. Cross-spec flags

- **T2 (API & Sync):** all three of T2 §7's requirements are met — the queue survives process death (§6.1, §6.2), the mirror is repairable from `GET /players/me` in one transaction (§5.2), and reconciliation is visibly quiet (§8.4). T4 adds one constraint back: **level-ups are never projected optimistically** (§8.4), since the server owns the curve and a retracted Reveal Card is the worst possible artefact of the projection design.
- **T3 (Health):** T4 owns the durable storage for both things T3 named — the per-date step high-water marks and the session ledger (§6.2). T4 also takes the item `DECISIONS.md` assigned to it: **paginated reads via `pageToken`** (§8.2). Two corrections from the spike are wired into §8.1: `initialize()` runs every pass, and permission-less reads throw rather than returning empty.
- **T5 (Battle Engine):** owns the battle snapshot's shape; T4 guarantees a durable slot and requires the snapshot write to share a transaction with any item or use spend (§5.3). T5 consumes encounter grants from the mirror and never rolls its own (T2 §1.3).
- **T6 (Deployment):** the client treats an unreachable API as success, not as an error (§8.1). Nothing in the client alerts on it, retries aggressively against it, or degrades because of it.
- **GDD 14 (Sound Design) / audio-production project:** §10.5 is the one structural requirement this spec does not fully satisfy — `expo-audio` cannot express §4.1/§4.2's play-once-intro-then-seamless-loop without a hand-built handoff that is not gapless by construction. Recommended M-phase behaviour is a single-file whole-track loop with the intro inside the loop body. **This needs a decision from the audio project with real assets in hand**, and is the reason it is flagged rather than logged as a deviation.
- **GDD 13 (UI Architecture):** no deviations. §4.3 implements the sub-tab requirement (all three Inventory sub-views stay mounted) with component state rather than nested navigators — a different mechanism to the same specified behaviour, not a behaviour change.
- **Manifest:** T4 introduces no content IDs, and §9.2 makes the manifest load-bearing rather than documentary — an orphan asset file now fails the build. The two ID families `DECISIONS.md` (2026-07-25, T1) flagged as missing — the six `gate_*` keys and the twelve concrete `gear_{slot}_{tier}` keys — **must be added to the manifest before the codegen script can pass**, since the generator reads the manifest and the gear registry needs those twelve literal keys to emit twelve `require()` calls. This moves that item from "before M0 seeding" to "before M0 builds at all."
- **Guest identity, unflagged until now:** §6.5 — uninstall destroys `player_id` and the token, and there is no recovery path to an existing server-side profile. Follows from the guest-only trim; arrives with real auth (T2 §8). Named here because nothing else in the spec set says it out loud.

---

## 15. Deferred by design

| Deferred | Why / how it lands |
|---|---|
| iOS / HealthKit | T3 §11's seam is honoured by §13's directory boundary. Nothing is built. |
| Background sync, background audio, background health reads | Sanctioned trim. `expo-audio`'s `enableBackgroundPlayback` plugin option stays off. |
| Push notifications | Local only, fixed-time (trim). `expo-notifications` without FCM. |
| Over-the-air updates (`expo-updates`) | Sideloaded builds; no distribution channel to update through. Costs nothing to add later. |
| Account recovery after uninstall | §6.5. Arrives with real auth. |
| Multi-device | T2 §1.5, GDD 11 §11. The single-device assumption is baked into the watermarks and the mirror. |
| Tablet / landscape layouts | GDD 13 §11 scopes this out. Portrait phone only; the app locks orientation. |
| Analytics beyond Sentry | Trim. No event pipeline, no `POST /events`. |
| Respec UI | GDD 13 §11 leaves the mechanic unspecified; allocation is permanent on confirm. |
| Asset atlasing / sprite sheets | Individual PNGs per manifest key until real art proves a load or memory problem. The registry indirection means atlasing later changes only `registry.generated.ts`. |
