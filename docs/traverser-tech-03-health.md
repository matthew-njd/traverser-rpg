# Traverser Tech Spec — T3: Health Integration

**Status:** locked. **Amended 2026-07-26** with the spike/health-connect findings (§3, §4, §12 — full findings in `DECISIONS.md`); the spike confirmed the rest of the spec as written. Inputs: GDD Sections 1, 10, 11 · `traverser-tech-01-data-model.md` · `traverser-tech-02-api-sync.md` · sanctioned scope trims.
**Scope:** how raw Android Health Connect data becomes the `steps` and `tier{1,2,3}_minutes` integers the rest of the system consumes — the read strategy, the tier-minute derivation algorithm, session identity, the permission flow, the on-device/server split, and the spike checklist. No RN code, no `app.json` edits, no package installs this session; those land in M0/M1.

**Platform:** Android only. No HealthKit code paths (CLAUDE.md). §11 names the seam for a possible iOS later and stops there.

---

## 1. Decisions

**1.1 Raw heart rate never leaves the device.**
T2 §7 already states it; T3 makes it the constraint every section below is built around. The device reads HR samples, buckets them into minutes, assigns tiers, and ships integers. The wire carries `tier1_minutes: 12`, never a BPM. This is what GDD 10 §3.1's onboarding promise — *"Your health data never leaves your device — only summaries (like daily totals) sync to your Traverser profile"* — obliges us to, and it is a promise made to the player on screen 2 of 11 before they have agreed to anything.

**1.2 HR sessions are derived from the heart-rate sample timeline, not from `ExerciseSessionRecord`.**
GDD 11 §8.1 defines a session as *"a continuous block of elevated HR, ending when the player drops below Tier 1 for more than 10 consecutive minutes"* — a definition written in terms of heart rate, not in terms of a workout the player remembered to start. Health Connect does expose `ExerciseSession` records, and anchoring to them would hand us a stable provider-issued session ID for free. We are not taking it. A player who walks briskly uphill for forty minutes without pressing "start workout" has unambiguously earned Tier 1 minutes under GDD 1 §2.2, and an exercise-session-anchored implementation would award them nothing. Deriving from samples matches the spec literally and degrades gracefully — a tracked workout produces HR samples too, so nothing is lost by ignoring the session wrapper.

The cost is that `hr_session.external_session_id` has no provider value to hold. §6 resolves that.

**1.3 Tier minutes come from 1-minute buckets scored on mean BPM.**
Neither GDD section says how to get from discrete samples to the integer minutes the XP table charges. The rule is fixed here: whole local minutes, mean BPM of the samples landing in each, one tier per minute. Integer minutes fall out of the algorithm rather than being rounded into existence at the end, the unit matches the XP rates exactly (GDD 1 §2.2 charges per minute), and every case is deterministic enough to assert against a fixture. §5 is normative.

**1.4 The player's age is collected at onboarding.**
GDD 1 §2.2 requires `HRmax = 220 − age` and GDD 10's eleven-screen flow never asks for it — a genuine gap between two locked specs, not an implementation detail. Resolution: a birth-year field on the Screen 3 character-creation step, alongside the Traverser name. It is one tap on a screen the player is already filling in, it happens before any HR data could be misclassified, and it makes the tier thresholds correct from the first workout. Health Connect has no dependable age or date-of-birth record type, so reading it from the platform is not an option. **This is a deviation from GDD 10 and is logged in `DECISIONS.md`.** The field is editable afterwards in Settings; changing it re-derives thresholds for future reads only and never recomputes past days (XP is never taken back — GDD 1 §1).

**1.5 Health data is read at sync time only.**
On app open and on foreground, in the same pass that builds the sync payload (T2 §4). No `READ_HEALTH_DATA_IN_BACKGROUND` permission is requested, no periodic read job is scheduled, and nothing in the app assumes it can observe health data while backgrounded. This follows the sanctioned trim (*"Sync happens only on app open/foreground"*) and it is also why GDD 11 §3.2's Auto Sync Grace exists at all — the design already accounts for days that were never observed.

**1.6 The spec is normative; the unknowns are a checklist.**
Everything in §2–§9 is implementable as written. What cannot be settled from documentation — real sample density on Matthew's device, provider backfill latency, whether record IDs are stable across re-reads — is enumerated in §12 with a defined fallback each, so a surprising probe result is a note in `DECISIONS.md` rather than a redesign.

---

## 2. Library and Android setup

**Library: `react-native-health-connect`.** It is the maintained RN wrapper over `androidx.health.connect`, MIT, no paid tier, no account, no key — it satisfies the $0 constraint outright. It ships a config plugin, so it works with a local `expo run:android` build and is invisible to the never-used EAS path. It does **not** work in Expo Go; the app must run as a development build, which is already true for this project.

Surface used from it: `getSdkStatus`, `initialize`, `requestPermission`, `getGrantedPermissions`, `openHealthConnectSettings`, `readRecords`, `aggregateGroupByPeriod`. Nothing else. In particular no `insertRecords`, `deleteRecords*`, or `revokeAllPermissions` — Traverser is a read-only consumer of health data and should never hold a write permission it could be blamed for.

**Manifest permissions** — two, both read:

```
android.permission.health.READ_STEPS
android.permission.health.READ_HEART_RATE
```

No `WRITE_*`. No `READ_HEALTH_DATA_IN_BACKGROUND` (§1.5). No `READ_EXERCISE` — §1.2 means we never read exercise sessions, and requesting a permission we don't use is a worse onboarding conversion for no benefit.

**Permission-rationale plumbing.** Health Connect requires the app to expose a screen explaining why it wants the data, and the wiring differs by OS version. Both must be present:

- An activity handling `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` — for Android 13 and below.
- An `<activity-alias android:name="ViewPermissionUsageActivity">` with `android.permission.START_VIEW_PERMISSION_USAGE` and an intent filter for `android.intent.action.VIEW_PERMISSION_USAGE` + `android.intent.category.HEALTH_PERMISSIONS` — for Android 14+.

This is one of the places where mobile diverges sharply from anything web-side: a missing rationale target does not throw, it makes the permission dialog's privacy-policy link dead, and on a Play-distributed app it is a review rejection. Traverser sideloads, so the failure mode here is just a broken link — but it is exactly the kind of thing that silently rots until the day distribution changes.

> **Amended 2026-08-05 (P9, found on the device).** There is a **third** piece of Android setup this
> section omitted, and unlike the rationale plumbing it is not a slow rot — it is a hard crash on the
> first permission request, which is GDD 10 screen 2. `react-native-health-connect` holds its
> `ActivityResultLauncher` in a `lateinit` on an `object` singleton and **never initialises it**;
> `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in `MainActivity.onCreate` is
> documented as the app's job. The library's own config plugin does not do it, so registering the
> library and following its Expo instructions still crashes with
> `UninitializedPropertyAccessException: lateinit property requestPermission has not been initialized`.
> It must be `onCreate` — `registerForActivityResult` throws once the activity has STARTED — and it
> must be a config plugin, because prebuild owns `android/` (tech-04 §1.1). Built as
> `app/plugins/withHealthConnectPermissionDelegate.ts`, alongside the rationale plugin §2 already
> required. **The 2026-07-26 spike could not have caught this**: it ran against a scratch app whose
> `MainActivity` was hand-edited, so it proved the library works and proved nothing about how this
> app wires it — worth remembering for every other spike finding in this document.

**Availability.** Health Connect is part of the OS on Android 14+ and a separately-installable APK on 13 and below. `getSdkStatus` therefore has three outcomes, and `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` is a real state on real devices, not a theoretical one — it means the platform exists but is too old, and the fix is deep-linking the player to the store listing. Treating "not available" as a single state produces an app that is inexplicably dead on some phones.

---

## 3. Permission flow

GDD 10 §3.1 puts this at Screen 2, before any story content, with the copy locked in that section. What follows is the state machine behind the **Continue** button.

**Sequence.** `getSdkStatus()` → if available, `initialize()` → `requestPermission([{accessType:'read', recordType:'Steps'}, {accessType:'read', recordType:'HeartRate'}])` → then, always, `getGrantedPermissions()`.

> **Amended 2026-07-26 (spike):** `initialize()` is **per-process and must precede every read pass**, not just onboarding. Changing permissions in Health Connect settings restarts the app process, after which every call fails with "Health Connect client not initialized" — so `getSdkStatus` → `initialize` joins `getGrantedPermissions` on every foreground (T4 §8.1 wires this).

That last call is not redundant. The player can grant steps and deny heart rate — Health Connect's dialog is per-record-type — and the app must handle a partial grant as a first-class state rather than a binary. **The result of `requestPermission` is never trusted on its own; `getGrantedPermissions` is the authority.**

> **Amended 2026-07-26 (spike):** granting Steps also silently grants `StepsCadence`, a record type never requested. `getGrantedPermissions` can therefore return **more** entries than were asked for — check it by exact `recordType` match, never by array length or index. Partial grant otherwise behaves as specified (probe 7: Steps granted, HeartRate denied, reported independently).

| State | What happens |
|---|---|
| **Both granted** | Normal operation. Steps and HR both read at every sync. |
| **Steps only** | Step XP, streaks, Leagues, daily goals, and travel encounters all work in full. No tier minutes, no HR-session encounter bonus, no overactivity warning. The banner from GDD 10 §3.2 shows, worded for the missing piece. |
| **HR only** | Degenerate but legal. Tier minutes accrue; no step XP, no streak credit (GDD 11 §2.1 gates the active day on steps alone), no Leagues. Banner shows. |
| **Neither granted** | GDD 10 §3.2 exactly: onboarding continues through story and tutorial battle, no hard block, persistent low-key banner on the Character screen, no step/HR XP accrues, **Battle XP still functions normally.** |
| **SDK unavailable / update required** | Same non-blocking treatment as denied, different banner and different deep link — store listing rather than Health Connect settings. |

**Re-checking.** `getGrantedPermissions` runs on every foreground, before the read. Permissions are revocable at any time from OS settings, and revocation is silent from the app's point of view — so the check must be per-foreground, never onboarding-only.

> **Corrected 2026-07-26 (spike, probe 6).** This section originally claimed a revoked read returns an empty result, not an error. **That is wrong: a read without permission throws** — `HealthConnectException: java.lang.SecurityException: Caller requires android.permission.health.READ_STEPS/READ_HEART_RATE`, verified for both record types. The read path therefore needs a catch that maps the exception to the banner state (probe 6's stated fallback; T4 §8.3 owns it). The original worry about conflating empty-and-unpermissioned with empty-and-genuinely-sedentary is now trivially safe: an unpermissioned read cannot produce an empty result at all. *(Tested via denial; revoke-after-grant not separately tested — same native path.)*

**Deep link.** The banner's tap target calls `openHealthConnectSettings()`. Do not attempt to re-trigger `requestPermission` after a denial; Android suppresses repeat prompts and the button would appear broken.

**No wearable connection flow here.** GDD 10 §3.1 is explicit that Apple Watch / Fitbit / Garmin pairing is not requested at this stage. Health Connect aggregates whatever providers the player has already connected at the OS level; Traverser never talks to a vendor SDK.

---

## 4. Read strategy

One read pass per sync, immediately before the payload is assembled.

**4.1 Window.** `[max(watermark, now − 72h), now]`, where `watermark` is the end of the last successfully-consumed read (§8.4).

72 hours is the smallest window that satisfies the design: GDD 11 §3.2's Auto Sync Grace looks back **48 hours** and needs synced totals to evaluate against, and provider backfill (a watch that syncs to the phone hours after a workout) can land data behind the wall clock. The extra 24 hours is that slack. Re-reading days already reported is normal and expected — §8 makes it safe.

If the app has not been opened for longer than the window, days beyond it are simply never credited for streak purposes. That is not a bug: GDD 11 §3.2 caps the grace at 48 hours by design, and steps outside it still credit XP and Leagues if they fall inside the read window.

> **Amended 2026-08-05 (P9, found on the device).** **A device's first read establishes a baseline
> and credits nothing** — it raises the high-water marks (§8.1, §8.2) and advances the watermark
> without minting a single delta.
>
> The 72-hour fallback in this section exists for *backfill and grace*, but a fresh install has no
> watermark, so it also reaches back into whatever history Health Connect already holds. Observed:
> a first sync read four days back, credited 28,663 pre-existing steps, and put the player on **Level
> 6 before taking a step in the game**. Three things break, all the same situation:
>
> 1. Every Traverser is intended to start at Level 1.
> 2. GDD 10 §6's tutorial battle is scripted with verified damage values against Level 1 stats, and
>    enemy level always equals the player's — a Level 6 arrival makes the script wrong.
> 3. **A restored identity double-credits.** The marks live in the device-only tables of tech-04
>    §6.2, which come back empty on a new phone, so the client re-mints *fresh* delta ids for days
>    the server already holds and tech-02 §6.1's additive merge adds them again. The idempotency
>    ledger cannot catch this, because those ids genuinely are new — this is the one hole in the
>    delta protocol that is not closed by `client_delta_id`.
>
> The rule is one line in `commitHealthRead` and covers all three, plus the case where permission is
> granted later (the first *successful* read becomes the baseline). The cost is that steps taken
> before the app existed never count, which is the intended behaviour rather than a compromise.

**4.2 Steps — use aggregation, not raw records.**

```
aggregateGroupByPeriod({
  recordType: 'Steps',
  timeRangeFilter: { operator: 'between', startTime, endTime },
  timeRangeSlicer: { period: 'DAYS', length: 1 },
})
```

Two reasons this is `aggregateGroupByPeriod` rather than `readRecords`:

First, **Health Connect de-duplicates overlapping step contributions from multiple origins during aggregation.** A player wearing a watch while carrying a phone produces two `StepsRecord` streams covering the same wall-clock minutes; summing raw records double-counts the entire day. Reconciling them ourselves would be a real algorithm, and anti-cheat and data-integrity work is explicitly out of sanctioned scope — so the correct move is to let the platform do the thing it already does correctly.

Second, the daily buckets it returns line up with `activity_date` directly, which is what T2 §2 needs: *"`activity_date` is a bare `YYYY-MM-DD` and is always supplied by the client, never derived server-side."* The slicing must be evaluated in the player's local timezone so the bucket boundary is local midnight — §12 has a probe confirming the library's timezone semantics here, because getting it wrong shifts every day boundary by the UTC offset and silently misattributes the last hours of every evening walk.

> **Confirmed 2026-07-26 (spike, probes 4–5):** `aggregateGroupByPeriod` slices on **local** midnight and **does** de-duplicate across origins (phone + watch produced raw 601 vs. aggregate 373 — a ~60% daily inflation avoided). One consequence for the caller: the time range filter must be a **UTC instant string** (`toISOString()`); a local-naive string throws `Text '...' could not be parsed at index 19`. The library does the local conversion itself. Multi-origin is the normal steady state on the spiked device, not an edge case — the phone writes steps independently of Fitbit.

**4.3 Heart rate.**

```
readRecords('HeartRate', { timeRangeFilter: { operator: 'between', startTime, endTime } })
```

Each `HeartRateRecord` carries a `samples[]` array of `{ time, beatsPerMinute }`. Flatten every record's samples into one time-ordered timeline across the whole window and discard the record grouping — provider record boundaries are arbitrary and have nothing to do with GDD 11 §8's session definition. Retain each source record's `metadata.id` for the local dedupe ledger, and `metadata.dataOrigin` for diagnostics only.

> **Amended 2026-07-26 (spike, not anticipated by this spec):** two on-device realities the read must handle. **(1) Reads are paginated** — a 48-hour HeartRate read returned exactly 1,000 records (the default `pageSize` cap) with a `pageToken` present; any read assuming one call returns the window silently truncates. T4 §8.2 owns the page-following helper, and no read of any record type bypasses it. **(2) Fitbit writes HR as ~one record per minute, not one per workout** (median duration 57s, ~26 samples each) — a session is stitched from hundreds of adjacent records, which reinforces §1.2's decision to segment from the sample timeline rather than from provider records. Sampling density is comfortably sufficient for §5.2's whole-minute bucketing (median inter-sample gap 2s; the sample-interval-weighting fallback is not needed).

Aggregation is deliberately **not** used for HR. The available aggregate metrics are min/max/average over a span, and none of them can produce time-in-zone — averaging a 45-minute workout to a single BPM destroys precisely the information GDD 1 §2.2 charges XP against.

---

## 5. Tier-minute derivation

Normative. Everything here runs on-device and every number below traces to GDD 1 §2.2 or GDD 11 §8.1.

**5.1 Thresholds.** `HRmax = 220 − age`, age from §1.4. GDD 1 §2.2's zones are percentages of HRmax; converted to BPM thresholds:

| Tier | Zone (GDD 1 §2.2) | Lower bound, BPM |
|---|---|---|
| Tier 1 — Moderate | 50–69% HRmax | `ceil(HRmax × 0.50)` |
| Tier 2 — Vigorous | 70–84% HRmax | `ceil(HRmax × 0.70)` |
| Tier 3 — Peak | 85%+ HRmax | `ceil(HRmax × 0.85)` |

`ceil` rather than `round` so a minute is never promoted into a tier it is fractionally below. Thresholds are computed once per read pass, not per minute.

GDD 1 §2.2 notes HRmax may be *"refined by wearable data where available"*. Not implemented — no Health Connect record type carries a provider's HRmax estimate, and there is no free path to a vendor SDK. Deferred (§13); `220 − age` stands.

**5.2 Bucketing.** Slice the window into whole local minutes. For each minute, take the mean BPM of all samples whose timestamp falls within it, and assign the minute the tier of that mean.

**A minute containing no samples is untiered** — below Tier 1, contributing nothing. Sparse sampling must never invent minutes. If the player's device only records HR every five minutes at rest, four of every five minutes score zero, which understates a genuinely elevated stretch; §12's first probe exists to find out whether that is the reality on this hardware, and §12 names the fallback if it is.

**5.3 Session segmentation.** Walk the minute timeline in order:

- A session **opens** at the first Tier 1+ minute.
- A session **closes** after **more than 10 consecutive** non-Tier-1+ minutes (GDD 11 §8.1: *"ending when the player drops below Tier 1 for more than 10 consecutive minutes"*). An exactly-10-minute gap does **not** close the session; the 11th consecutive sub-Tier-1 minute does — fixtures §11.3's boundary row pins the strict inequality. *(Wording tightened 2026-07-26; an earlier draft said "after 10 consecutive", leaving the exactly-10 case ambiguous.)* The closed session's `ended_at` is the last Tier 1+ minute, not the end of the gap — the gap is a boundary marker, not part of the session.
- A gap of 10 minutes or fewer does **not** close the session; those minutes are inside the session but contribute to no tier.
- A trailing gap of 10 minutes or fewer at the end of the read window leaves the session **open**. It is uploaded as-is and may grow on the next sync (§6 makes that safe).

**5.4 Totals.** Sum per-tier minutes per session, and independently per `activity_date`. A session crossing local midnight is **one session** whose minutes split across two dates — `hr_session` keeps the whole thing (it is bounded by `started_at`/`ended_at`, not by a date), while the day rollups each receive their own share. This matters for the overactivity warning, which is a per-session rule and must not reset at midnight.

**5.5 The Tier 3 daily cap is NOT applied on-device.**
GDD 1 §2.2 caps Peak XP at *"first 20 cumulative min/day"*, dropping to the Tier 2 rate beyond it. T2 §4 step 4 computes that against the day's **post-merge cumulative** `tier3_minutes` — the client cannot, because it does not know what the server already holds for that day. The client ships raw, uncapped Tier 3 minutes. Applying the cap in both places would charge the discount twice and quietly underpay a hard workout.

Same principle, stated once so it does not need restating: **the client derives minutes, the server derives XP.**

---

## 6. Session identity

§1.2 leaves `hr_session.external_session_id` with no provider value to hold. Tech-01 §7 anticipated this and pre-authorised the fallback: *"if it doesn't, the dedupe key becomes `(player_id, started_at)` and that's a schema note, not a redesign."*

**Taking that fallback: `external_session_id = "hr:{started_at, epoch seconds}"`.**

Expressing it as a string in the existing `text` column means the existing `unique (player_id, external_session_id)` index enforces exactly the `(player_id, started_at)` key tech-01 described. **No schema change, no migration, no change to T2 §4 step 2.**

**6.1 The start instant must be frozen.** The ID is only stable if `started_at` is. A local session ledger, keyed by the ID, persists each session's `started_at` the first time it is observed. On a later read, a session whose minutes overlap a ledger entry adopts that entry's ID and start — even if newly-backfilled earlier samples would now place the start earlier. Without this, a watch syncing late would shift the start, mint a second ID, and the server would hold two sessions for one workout, double-counting encounter rolls and re-arming the overactivity warning.

**6.2 Merging.** Two previously-separate sessions can grow into each other when backfill fills the gap between them below 10 minutes. Rule: **the earlier ID wins.** The later session's minutes fold into it, the later ID is tombstoned locally and never sent again. The server keeps the orphaned row — it is inert once no delta or upsert references it, and deleting server rows from the client is not a capability this protocol has or should have.

**6.3 Set, not add.** T2 §6.3 puts `hr_session` tier minutes under last-write-wins deliberately: *"a re-observed HR session that added its minutes would double the workout."* An open session therefore restates its full absolute totals on every sync until it closes. That is correct and safe **only** because the ID is stable — §6.1 is what makes §6.3 work, and the two must not be reasoned about separately.

---

## 7. On-device vs. server split

| Concern | Owner | Note |
|---|---|---|
| Health Connect permissions, availability, reads | **Device** | §3, §4 |
| Raw HR samples | **Device, exclusively** | Never transmitted (§1.1) |
| HRmax and tier thresholds | **Device** | Needs age, which the server never requires |
| Minute bucketing and tier assignment | **Device** | §5.2 |
| Session segmentation and boundaries | **Device** | §5.3 — needs the sample timeline |
| Local-date assignment (`activity_date`) | **Device** | T2 §2: the client owns local midnight |
| Step de-duplication across providers | **Health Connect** | §4.2 — neither Traverser layer does this |
| Delta minting and the offline queue | **Device** | §8, T2 §5 |
| Whether the overactivity banner renders | **Device** | §9 — liveness is a client fact |
| **Step XP, tier XP, battle XP** | **Server** | T2 §1.1 |
| **Tier 3 20-min/day cap** | **Server** | §5.5 |
| Level curve, Leagues, gates, encounter RNG | **Server** | T2 §1.1 |
| Streaks, rest days, Auto Sync Grace | **Server** | T2 §4 step 9 |
| Overactivity threshold crossing | **Server** | T2 §4 step 11 — reports, does not decide |

The wire between the two carries integers only: step counts, per-tier minute counts, dates, and instants.

---

## 8. Delta minting

The bridge from §5's output into T2 §5's queue. This is the subtlest part of T3, because the read is *cumulative* and the merge is *additive*.

**8.1 Steps — send the difference, never the total.**
T2 §6.1 merges steps with `col = col + delta`, and §4.1 re-reads days already reported. Sending the day's total on every sync would multiply a day's steps by the number of times the app was opened.

The client keeps a per-`activity_date` **high-water mark**: the step count it has already handed to the queue for that date. On each read:

```
delta = observed_total(date) − reported_high_water(date)
if delta > 0:  mint a sync_delta, then set reported_high_water = observed_total
if delta ≤ 0:  mint nothing
```

A **negative** difference means the provider revised a total downward — a duplicate record was removed, or a source was disconnected. Mint nothing and do **not** lower the high-water mark either; XP already granted is never taken back (GDD 1 §1: *"XP is never lost"*), and lowering the mark would re-send the same steps once the count recovered.

**8.2 HR minutes — the day rollup and the session row are different payloads.**
Both `sync_delta` rows and `hr_session` upserts carry tier minutes, and it must be unambiguous which one feeds `activity_day`, or a workout is credited twice.

- **`sync_delta` (`source = 'hr'`, `hr_tier`, `minutes_delta`) is the authoritative path to `activity_day` and therefore to XP.** It follows the same high-water-mark discipline as steps, tracked per `(activity_date, tier)`: mint the increment over what has already been queued for that date and tier.
- **`hr_session` is session bookkeeping only** — absolute totals, set-semantics (§6.3), consumed by the overactivity check and the per-session encounter bonus (T2 §4 step 8). It never rolls up into `activity_day`.

An open session that gains 7 Tier 2 minutes between syncs therefore emits a `sync_delta` of `minutes_delta: 7, hr_tier: 2` **and** an `hr_session` upsert restating the session's full Tier 2 total. Both are correct; they answer different questions.

**8.3 Delta IDs.** Every delta gets a fresh UUIDv7, minted at creation, persisted with it, never regenerated on retry (T2 §5). **Never derived from the content** — not from `(date, source, steps)`, not from a hash. Two legitimately distinct deltas can be identical in value, and a content key would drop one silently. The high-water-mark scheme in §8.1 makes identical-value deltas *likely*, not merely possible, which makes this rule load-bearing here specifically.

**8.4 Watermark advance.** The read watermark advances only after the resulting deltas are **durably queued** — not after a successful read, and not after a successful upload. A crash between read and enqueue must re-read the same window and produce the same deltas; a crash after enqueue is already covered by the queue's own durability and the server's idempotency ledger. Ordering it the other way loses activity in exactly the case the whole delta protocol exists to protect against.

**8.5 Nothing here validates plausibility.** Out of scope by sanctioned trim (tech-01 §6). The client does not sanity-check step counts, does not reject implausible BPM values, and does not reconcile against distance.

---

## 9. Overactivity warning wiring

GDD 11 §8 splits cleanly across the two layers, and T2 §4 step 11 already fixed the split: *"the client decides that by checking whether the session is live, and the server simply reports threshold-crossed."*

- **Device:** derives the session (§5.3), sums cumulative **Tier 1+** minutes across all three tiers, uploads it. Then decides whether to render.
- **Server:** if cumulative Tier 1+ minutes ≥ **90** and `overactivity_warned_at is null`, sets it and returns `warnings: [{ code: "overactivity", session_id }]`. Once per session (T1's column enforces it).
- **Device, on the response:** render the banner **only if the session is live** — meaning the session is still open under §5.3, i.e. its last Tier 1+ minute is within the 10-minute close window as of this read. GDD 11 §8.2: *"If the session ends before the player next opens the app at all, the warning does not fire retroactively."* A closed session's warning is dropped on the floor. The server having set `overactivity_warned_at` for a session that never displayed is fine and intended — it burns the once-per-session eligibility for a session that is already over.
- **Presentation:** in-app banner, never a push (GDD 11 §8.2). Copy is GDD 11 §8.4's, verbatim, and there is no XP, Vigor, or streak consequence.

---

## 10. Fixtures owed to `traverser-test-fixtures.md`

T3 introduces derivation logic with no fixture coverage. These cases must be authored into the fixtures file **before** the code is written — per CLAUDE.md, tests assert against fixtures, and fixtures are never edited to make a test pass:

**DELIVERED** — added as fixtures **§11**, machine-verified 2026-07-26 by executing the §5/§8 algorithms in Node rather than transcribing prose (same method as T5's §10). §11.3 additionally pins the exactly-10-minute gap boundary (does not close — GDD 11 §8.1's "more than 10").

1. **Threshold table** for at least two ages (a younger and an older player), giving `HRmax` and the three `ceil` BPM bounds.
2. **Bucketing** — a minute with several samples straddling a boundary, asserting the mean-BPM tier assignment; a minute with no samples asserting zero.
3. **Segmentation, 9-minute gap** — one session, gap minutes untiered.
4. **Segmentation, 11-minute gap** — two sessions, with both `started_at` values and both IDs.
5. **Midnight-crossing session** — one session, minutes split across two `activity_date`s, with both day totals.
6. **Tier 3 cap interaction** — the client's uncapped output for a day, and separately the server's charged XP, demonstrating they are different numbers. T2 §4's worked case (a delta of 12 Tier 3 minutes into a day already holding 15 → 5 billed at Peak, 7 at Vigorous) is the anchor.
7. **Step high-water mark** — three successive reads of the same day with a rising total, then a downward revision, asserting the minted deltas.
8. **Session merge** — two sessions joined by backfill, asserting the surviving ID is the earlier one.

---

## 11. iOS later

The seam sits at a single `HealthProvider` interface whose output is `{ dailySteps: Map<activity_date, count>, sessions: HrSession[] }` — already bucketed, already tiered, already assigned to local dates. Everything in §2–§4 is Health Connect-specific and lives behind that interface; everything from §5 down — bucketing, segmentation, session identity, delta minting, the watermark, the overactivity liveness rule — is platform-neutral and stays exactly as written. An iOS port is then one new implementation of that interface reading `HKQuantityTypeIdentifierStepCount` and `HKQuantityTypeIdentifierHeartRate`, plus its own permission screen; the derivation, the fixtures, and the entire server contract are untouched. **Nothing is built for this now** — no abstraction layer, no platform branches, no HealthKit dependency. The only obligation this paragraph creates is that §5–§9 must not reach for a Health Connect type directly, which is good hygiene regardless of whether iOS ever happens.

---

## 12. Spike checklist

Run on the physical Android device before M1 code lands. Each item: *probe → what it would change → fallback if it goes badly.*

| # | Probe | Changes what | Fallback |
|---|---|---|---|
| 1 | **HR sample density.** Read a full day and a workout; histogram the inter-sample gaps at rest and under load. | §5.2's viability. If resting sampling is every 5–10 min, whole-minute bucketing scores mostly zeros and understates real sessions. | Switch §5.2 to sample-interval weighting — credit each sample the span until the next, sum per tier, floor to minutes. Cap the span attributable to one sample (~2 min) so a gap can't manufacture minutes. Fixtures change; nothing else does. |
| 2 | **Backfill latency.** Complete a workout on the wearable, then read at +5 min, +1 h, +6 h, +24 h. | §4.1's 72-hour window. | Widen the window. It is a constant, and re-reads are already idempotent by §8. |
| 3 | **`metadata.id` stability.** Read the same HR records across days and app restarts; compare IDs. | Whether the local dedupe ledger can key on record IDs at all. | §6's ledger already keys on derived session identity, not record IDs, so instability costs only diagnostics. Confirms rather than threatens. |
| 4 | **Cross-origin step de-duplication.** Wear the watch and carry the phone for a walk. Compare `aggregateGroupByPeriod` against the sum of raw `readRecords`. | §4.2's central premise. | If aggregation does *not* de-duplicate, pick a single `dataOrigin` per day (highest count) and read raw records filtered to it. Loses some steps; never double-counts. Flag to Matthew before implementing — it is a visible behaviour change. |
| 5 | **Timezone semantics of `aggregateGroupByPeriod`.** Read across a midnight with a non-UTC device timezone; check which instants the returned buckets span. | Whether day boundaries land on local midnight (§4.2). | If buckets come back UTC-sliced, drop to `readRecords('Steps')` and bucket by local date on-device, accepting that the de-duplication from #4 is then lost — which makes #4 and #5 a joint decision, not independent ones. |
| 6 | **Permission revocation.** Grant, read successfully, revoke in OS settings, read again. | §3's claim that revocation yields an empty result rather than an error. | If it throws, the read path needs a catch that maps the exception to the banner state. Small; needs knowing. |
| 7 | **Partial grant.** Accept steps, deny heart rate. | §3's per-record-type table. | Confirms `getGrantedPermissions` reports them independently. If it is all-or-nothing on this device, the table collapses to two rows. |
| 8 | **`getSdkStatus` on the actual device.** Record the OS version and returned status. | §2's three-state handling. | None needed; this is a fact-finding item that determines whether the update-required path can even be tested locally. |
| 9 | **Long gap.** Leave the app closed >48 h with activity happening, then open. | The interaction of §4.1's window with GDD 11 §3.2's grace lookback. | Verifies the grace path end-to-end. If steps outside the window are missing entirely, that is expected — confirm it reads as quiet, not as a loss, per GDD 11 §4. |

Probes 1, 4, and 5 are the ones that can change the spec. The rest confirm it.

> **Status 2026-07-26 — spike executed** (Pixel 9, Android 16, Fitbit as HR source; full findings in `DECISIONS.md`). Probes **1, 3, 4, 5, 7, 8 passed as specified** (probe 1: median 2s sampling, whole-minute bucketing stands; probe 4: aggregation de-duplicates; probe 5: local-midnight slicing). Probe **6 disproved §3's original claim** — reads throw rather than returning empty; §3 amended above. Two findings nothing anticipated: paginated reads and per-minute HR records (§4.3 amendment). Historical depth on this device is **~30 days** — clears §4.1's 72-hour window easily, but the grace lookback must never assume more. Probes **2 (backfill latency) and 9 (long gap) remain uncharacterised** — both are time-elapsed probes whose fallbacks are "widen the constant", re-reads are idempotent by §8, so they are opportunistic M1 checks, not blockers. Directionally observed for probe 2: a read minutes after a walk can understate the day severely (23 of ~373 steps before the watch synced), which §4.1/§8's design already absorbs.

---

## 13. Deferred by design

| Deferred | Why / how it lands |
|---|---|
| Background health reads | Sanctioned trim: sync on open/foreground only. No `READ_HEALTH_DATA_IN_BACKGROUND`. GDD 11 §3.2's grace exists precisely to absorb the consequence. |
| Wearable-refined HRmax (GDD 1 §2.2) | No Health Connect record type exposes it and vendor SDKs cost money or accounts. `220 − age` stands. Revisit only if a free platform path appears. |
| Vendor SDK integrations (Fitbit, Garmin, Wear OS) | GDD 10 §3.1 already defers wearable connection to Settings. Health Connect aggregates whatever the OS has connected; Traverser never talks to a vendor directly. |
| Exercise session / route / calorie reads | §1.2 makes them unnecessary and §2 keeps the permission list minimal. |
| Multi-device health streams | Still open at T2 §1.5 and GDD 11 §11. §4.2 leans on Health Connect's own de-duplication, which is a single-device answer. |
| HealthKit / iOS | §11. Seam named, nothing built. |
| Plausibility validation of health data | Out of scope by sanctioned trim. |

---

## 14. Cross-spec flags

- **T1 (Data Model):** T3 uses `hr_session`, `sync_delta`, and `activity_day` exactly as defined — **no schema change**. Tech-01 §7's open question is now answered: Health Connect has no session identifier we can use (because §1.2 declines to read exercise sessions at all), so the sanctioned `(player_id, started_at)` fallback is taken, encoded as `"hr:{epoch}"` in the existing `external_session_id` column.
- **T2 (API & Sync):** T3 satisfies both contracts T2 §7 asked for — minutes arrive pre-bucketed and the server never sees raw HR, and `external_session_id` is stable across re-observation (§6.1), which is what makes §4 step 2's set-semantics safe. §8.2 fixes which payload feeds `activity_day`, closing the only remaining ambiguity between the two specs.
- **T4 (Client Architecture):** owns the durable storage for two things T3 introduces — the per-date step high-water marks and the session ledger (§6.1). Both must survive process death for the same reason the delta queue must; both are small.
- **GDD 10 (Onboarding):** a birth-year field is added to the Screen 3 character-creation step (§1.4). Screen 2's copy and behaviour are unchanged. Logged as a deviation.
- **Manifest:** T3 introduces no content IDs. Session IDs are runtime-derived, not manifest keys.
