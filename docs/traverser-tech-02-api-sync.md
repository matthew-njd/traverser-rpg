# Traverser Tech Spec — T2: API Surface & Sync Protocol

**Status:** locked. Inputs: GDD Sections 1, 9, 11 · `traverser-tech-01-data-model.md` · `traverser-data-manifest.md` · `traverser-test-fixtures.md` · sanctioned scope trims.
**Scope:** the HTTP surface, the sync-on-open transaction, the offline queue contract, and the merge rules. No controllers, DTOs, or EF code are written this session — those land in M0/M1.

---

## 1. Decisions

**1.1 The server is the progression authority; the client is the battle authority.**
The client uploads *raw activity* only — steps, HR tier-minutes, battle outcomes. The server applies the Section 1 XP formula, walks the seeded `xp_curve`, moves the Waymarker, evaluates gates, and rolls encounter checkpoints. This is not a reversal of the sanctioned trim: battle *resolution* stays client-side exactly as specified, because it needs to run with the API off and it consumes only cached content. Progression is different — it is cumulative, irreversible, and the one thing the player would notice being wrong. Splitting it this way means the level curve is implemented once, in the place that also owns `xp_curve`, and a client bug can never mint XP.

**1.2 The client plays fully offline against a durable local mirror.**
The API runs in Docker Compose on a PC that is deliberately off between sessions (CLAUDE.md, hosting constraint), so "server unreachable" is the *normal* state, not an error path. The client therefore keeps a complete local mirror of player state, plays off the cached content bundle, and queues deltas. A sync is a reconciliation, not a prerequisite. Any design where the app is inert without the server is wrong for this project specifically.

**1.3 Sync issues encounter grants; the client consumes them.**
This is the seam between 1.1 and 1.2 — the server owns the encounter RNG and the 5/day cap (GDD 9 §5.1/§5.3), but battles must be playable offline. Resolution: sync does not deliver battles, it delivers **grants**. Each granted roll arrives with its zone and enemy already resolved server-side and already counted against `activity_day.encounters_used`. The client holds them and spends them whenever, online or not, returning `battle` rows on the next sync. Explore taps made offline queue as *requests* that the following sync resolves against the cap. The player's offline experience is bounded by grants they already hold, which is honest: the encounters were earned by steps that were themselves already synced.

**1.4 Guest identity is a device-generated `player_id` plus an opaque bearer token.**
The client mints the UUID at first launch and registers once; the server returns a long-lived opaque token held in Android secure storage and sent on every request. No accounts, no passwords, no refresh flow — the guest-only trim stands. The token exists because T6 puts this API on Tailscale rather than localhost, and an unauthenticated write surface reachable from anything on the tailnet is not acceptable even for a single-player app. `player.id` already being a `uuid` rather than a singleton (tech-01 §4) means adding real auth later is `auth_identity` plus a login endpoint, with no change to anything below.

**1.5 Single-device by design, structurally safe by accident.**
GDD 11 §11 leaves multi-device sync open. This spec assumes one device and does not solve it. It is worth stating what falls out anyway: because the merge is additive over an idempotency ledger rather than last-write-wins, a second device would not *corrupt* steps, XP, or Leagues — each device's deltas carry their own IDs and simply add. What would misbehave is per-day evaluation ordering (grace lookback, streak crediting) and the local mirror on the quieter device. That is the seam; do not build for it now.

---

## 2. Conventions

- **JSON, `snake_case` on the wire**, so payload fields match tech-01's column names 1:1 and a request body can be read against the schema without a mental mapping. `JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower` — built into `System.Text.Json`, no custom converter.
- **Instants are ISO-8601 with offset. `activity_date` is a bare `YYYY-MM-DD`** and is *always supplied by the client*, never derived server-side from a timestamp. The client owns the local-midnight boundary because it owns the live timezone (tech-01 §2); a server deriving the date from `recorded_at` would put the day boundary in the wrong place for any player who travels.
- **Every write carries a client-generated ID and is safe to retry.** There is no endpoint on this surface that is only *usually* safe to replay. If a new write endpoint can't state its idempotency key, it isn't finished.
- **Errors are RFC 9457 `ProblemDetails`** (first-class in ASP.NET Core) with a `code` extension member the client switches on — `content_version_stale`, `inventory_full`, `encounter_cap_reached`, `grant_already_spent`.
- **`/api/v1` path prefix.** API version and `content_version` are negotiated independently: a content reseed must never look like an API break.
- **Numbers on the wire are integers or decimal strings**, never floats, for the same reason tech-01 §2 uses `numeric` — the fixtures assume exact `floor()`/`round()`.

---

## 3. Endpoint list

`•` = works offline against the local mirror. `▲` = requires the server.

### Identity
| Method | Path | Notes |
|---|---|---|
| ▲ `POST` | `/api/v1/players` | Creates the guest profile. Body carries the client-minted `player_id`, `traverser_name`, `timezone`. Idempotent on `player_id` — re-registering returns the existing profile and token rather than 409, so a lost response doesn't strand the device. Inserts `player_zone_progress` for `olympion`. |
| ▲ `GET` | `/api/v1/players/me` | Full authoritative state snapshot. This is the mirror's repair path — if the client ever suspects drift, it refetches rather than reconciling field-by-field. |
| • `PATCH` | `/api/v1/players/me/settings` | Step goal, reminder time, volumes. Last-write-wins (§6.3). |

### Content
| Method | Path | Notes |
|---|---|---|
| ▲ `GET` | `/api/v1/content/version` | Cheap poll; single integer. Called at the start of every sync. |
| ▲ `GET` | `/api/v1/content/bundle` | The whole seeded content set (tech-01 §3) as one gzip response with an `ETag` of `content_version`. `If-None-Match` → 304. Fetched only when the version moved. |

### Sync
| Method | Path | Notes |
|---|---|---|
| ▲ `POST` | `/api/v1/sync` | The transaction (§4). One batch call. The only endpoint that advances progression. |

### Progression writes
All of these apply optimistically to the mirror and replay to the server; all are idempotent on a client-generated operation ID.

| Method | Path | Notes |
|---|---|---|
| • `POST` | `/api/v1/players/me/allocations` | Spend unspent stat points. Body is a per-stat delta map; server validates the sum against `unspent_stat_points`. Additive on the six `alloc_*` columns, so a replayed request that already applied is rejected on the operation ID, not silently re-added. |
| • `PUT` | `/api/v1/players/me/skills` | The full 1–4 slot loadout, sent whole. Point-in-time state → last-write-wins is correct here (§6.3). |
| • `PUT` | `/api/v1/players/me/gear/{player_gear_id}/equipped` | Equip/unequip. Server enforces the one-per-slot partial unique index. |
| • `POST` | `/api/v1/players/me/items/{player_item_id}/discard` | Consumption happens inside a battle and arrives as part of the battle payload; this is the inventory-screen discard. |
| • `POST` | `/api/v1/players/me/pending-rewards/{id}` | Resolve a `pending_reward` as `kept` or `discarded`. Idempotent on the reward ID — once `resolved_at` is set, a replay returns the existing resolution. |
| • `POST` | `/api/v1/players/me/rest-days` | Tag a date as a Rest Day. Accepts today or, per GDD 11 §3.1, a date within 24h of its local midnight; the server rejects anything older with `rest_day_window_expired`. Triggers the 100% Vigor restore. |
| • `POST` | `/api/v1/players/me/explore` | Queue an Explore request against a zone. Offline this records intent only; the grant is issued by the next sync (§1.3). |

### Reads
| Method | Path | Notes |
|---|---|---|
| • `GET` | `/api/v1/players/me/activity?from=&to=` | Paged `activity_day` rows for the Character screen's activity log. |
| • `GET` | `/api/v1/players/me/bestiary` | `player_bestiary` joined to `enemy`. |
| • `GET` | `/api/v1/players/me/map` | Derived map state: Leagues, per-gate `locked｜available｜defeated`, unlocked zones. Nothing here is stored (tech-01 §4) — it is computed from `lifetime_steps`, `zone_gate`, and `player_bestiary` on every read. |

Only three things genuinely require the server: registration, the content bundle, and sync itself. Everything else has a mirror answer.

---

## 4. The sync-on-open transaction

Fired on app open and on foreground, never in the background (GDD 9 §2.3, GDD 11 §10). One `POST /api/v1/sync`, one Postgres transaction, `READ COMMITTED`, opening with `SELECT ... FROM player WHERE id = $1 FOR UPDATE` so two overlapping syncs from a retrying client serialize rather than interleave.

**Request** carries: the queued `sync_delta` rows, completed `battle` rows **with their client-rolled drops** (§4.1), `hr_session` upserts, queued Explore requests, the client's `content_version`, and its local date + timezone.

#### 4.1 The battle payload — amended by T5

T5 §1.6 establishes that **the client rolls loot and the server records it**. `drop_rate` and `enemy_drop_pool` are already client-cached content (tech-01 §7), and rolling server-side on ingest would leave a boss drop nonexistent until the next sync — days, with the API off by design (§1.2) — breaking GDD 13 §6.3's victory-screen Reveal Card. Each `battle` row therefore carries what it produced:

```
{ "client_battle_id": "...", "grant_id": "...", "enemy_id": "enemy_harpy",
  "encounter_kind": "wild", "enemy_level": 15, "outcome": "win",
  "started_at": "...", "ended_at": "...",
  "vigor_after": 13,
  "items_consumed": [ "<player_item_id>", ... ],
  "drops": [ { "kind": "item",  "def_id": "item_stormveil" },
             { "kind": "gear",  "def_id": "gear_weapon_mortal",
               "level_at_drop": 15, "bonus_primary": 2 } ] }
```

`kind` is one of `item` \| `gear` \| `trinket`. Gear and trinket drops carry their **frozen** rolled bonus and `level_at_drop` (tech-01 §4 — the bonus is persisted, never recomputed); items carry neither. This is the only place in the API where the client supplies a value the server would otherwise derive, and it is deliberate: the bonus is frozen at drop time by design, so re-deriving it server-side would be the bug, not the check. `level_at_drop` is stored alongside purely so it *can* be re-derived for verification.

**Trust boundary.** This does widen what a tampered client can mint — to items and gear, and no further. XP, levels, Leagues, gates, and encounter grants all stay server-derived (§1.1), so the ceiling on abuse is cosmetic-plus-stats in a single-player game, which the sanctioned no-anti-cheat trim already accepts. Stated here so the boundary is explicit rather than incidental.

The order below is normative. It is the order tech-01 §7 asked T2 to fix, and steps 3–6 in particular cannot be reordered without changing outcomes.

**1. Ingest deltas.**
`INSERT INTO sync_delta ... ON CONFLICT (player_id, client_delta_id) DO NOTHING RETURNING *`.
**Everything downstream is computed only from the returned rows.** This single line is the entire double-count defence — a replayed batch returns zero rows and the rest of the transaction has nothing to do. If any later step ever reads the *request* rather than the *returned set*, idempotency is gone.

**2. Ingest battles, their drops, and sessions.**
`battle` rows on `ON CONFLICT (player_id, client_battle_id) DO NOTHING`, likewise `RETURNING`. `hr_session` upserts on `(player_id, external_session_id)` — tier minutes here are **set, not added**, because a session is a point-in-time snapshot that grows as it's re-observed (T3 owns what fills it; §6.3). `player_bestiary` `encounter_count` / `defeat_count` increment **only for newly-inserted battles**. `enemy_level` is recorded as sent; it equals the player's level at encounter time and is history, not a live value.

**Drops are materialised only for newly-inserted battles** — the same `RETURNING` set that gates the bestiary increment, for the same reason and in the same statement's shadow. A replayed battle returns no row, so its `drops` array is never read and no duplicate `player_item` / `player_gear` is written. Deriving this from an "already granted?" lookup instead of from the returned set is how a boss's Divine drop gets granted twice. `vigor_after` is applied to `player.vigor_current` and `vigor_anchor_at` is reset to the battle's `ended_at`, likewise only for newly-inserted battles; `items_consumed` deletes those `player_item` rows, idempotent by primary key.

Drops do **not** pass through `milestone_grant` (step 10's permission slip) — `client_battle_id` is already their idempotency key, and routing them through a second ledger would give one event two conflicting sources of truth.

**3. Roll up to `activity_day`.**
Group the returned deltas by `activity_date` and upsert:
```
INSERT INTO activity_day (player_id, activity_date, steps, tier1_minutes, ..., step_goal_snapshot)
VALUES (...)
ON CONFLICT (player_id, activity_date) DO UPDATE
  SET steps = activity_day.steps + EXCLUDED.steps,
      tier1_minutes = activity_day.tier1_minutes + EXCLUDED.tier1_minutes,
      ...
```
Always `+ EXCLUDED`, never `= EXCLUDED`. `step_goal_snapshot` is captured from `player.daily_step_goal` **on insert only** and never updated — raising the goal must not retroactively un-hit a day that was legitimately earned (tech-01 §4).

**4. Derive XP.** Per GDD 1 §2, referenced not restated; expected values in fixtures §4.
- Step XP: 1 per 20 steps, uncapped.
- HR tier XP: Tier 1 and Tier 2 at their flat per-minute rates. **Tier 3's 20-minute cap is per calendar day, not per delta** — compute it against the day's *post-merge cumulative* `tier3_minutes`, then charge minutes beyond 20 at the Tier 2 rate. A delta carrying 12 Tier 3 minutes into a day that already had 15 must be billed 5 at the Peak rate and 7 at the Vigorous rate. Evaluating the cap on the delta in isolation is the single easiest way to get this transaction wrong, and it fails silently in the player's favour, so no bug report will surface it.
- Battle XP: `15 + level × 2` per **win** only, at the level held when the battle was fought. Losses award 0 with no penalty (GDD 1 §2.3).
- Add the total to `activity_day.xp_awarded` for the relevant date.

**5. Apply XP and level-ups.**
Add to `player.xp_current` and `xp_lifetime`, then loop the seeded `xp_curve`: while `xp_current >= xp_to_next(level)`, subtract, `level++`, `unspent_stat_points += 3`. **Hard stop at 60** — `xp_to_next` is null there and the remainder is discarded, not banked (GDD 1 §4). `xp_lifetime` keeps accruing for display; the level bar retires. Allocation is manual and happens later via its own endpoint; sync never allocates.

**6. Leagues.**
`lifetime_steps += (sum of newly-merged steps)`. Leagues are `lifetime_steps / 1000`, derived on read, never stored (GDD 9 §2.1, tech-01 §4). Monotonic by construction — there is no code path that subtracts.

**7. Gate evaluation.**
Recompute gate state from the new Waymarker: a gate is *available* at `leagues >= zone_gate.league_threshold`, *defeated* at `player_bestiary.defeat_count > 0` for its enemy. A final-boss gate whose `unlocks_zone_id` is set inserts `player_zone_progress` for that zone once its boss is defeated — the dual gate (distance AND prior boss) from GDD 9 §3. Mid-boss gates are soft and block nothing.

**8. Encounter checkpoints.**
Three sources, one pool (GDD 9 §5.1):
- **Forward travel:** one 25% roll per newly-crossed 1,000-step League — i.e. `floor(new_total/1000) - floor(old_total/1000)` rolls, each against the zone segment that League falls within.
- **Session bonus:** 1 guaranteed roll per 15 continuous Tier 1+ minutes in a session, max 2 per session, tracked on `hr_session.encounter_rolls_granted` so a re-observed session can't re-grant.
- **Explore:** each queued request consumes one roll from the same pool.

Hard cap of 5/day enforced against `activity_day.encounters_used`, incremented as grants are issued; once at 5, further rolls are skipped entirely and steps/XP/Leagues continue normally (GDD 9 §5.3). Successful rolls resolve their enemy server-side and return as grants (§1.3).

**9. Streak evaluation.**
For each touched date plus the 48-hour lookback window:
- Goal met → `streak_credit_method = 'goal_hit'`.
- Otherwise, if the date is inside the 48h window, was never synced at the time, and *actually met the goal* once these deltas merged → `'auto_sync_grace'`, **subject to** `COUNT(*) WHERE streak_credit_method = 'auto_sync_grace' AND activity_date > now() - interval '30 days' < 3` (GDD 11 §3.2). Over the cap, the steps and XP still credit in full — only the streak repair stops.
- A `rest_tagged_at` date is `'rest_day_tag'` and needs nothing here.
- Recompute `streak_state.current_streak` from the contiguous run; `longest_streak` only ever rises.

A null `streak_credit_method` on a past date is a break, and that is *all* it is: no flag is written, no notification is queued, no field records that a streak was lost (GDD 11 §4). The quiet reset copy is the client's business.

**10. Deterministic rewards.**
Daily-goal item, level milestones, streak milestones, zone-entry grants. **Every one is gated by an `INSERT INTO milestone_grant ... ON CONFLICT DO NOTHING` that must report a row before the reward is materialised.** No reward in this step is allowed to key off "did this sync already run" or off the delta set — the grant table is the only permission slip. Streak milestones apply GDD 11 §5.3's overlap rule (skip to the slot's next available tier) and its all-slots-Mythic fallback (2× Herald's Draft, recorded as `overflow_fallback = true`); they never grant Trinket or Divine, which tech-01's CHECK enforces structurally anyway. If a grant would exceed the 20-slot inventory cap it becomes a `pending_reward` instead of being dropped.

**11. Overactivity check.**
For each session in the payload, if cumulative Tier 1+ minutes ≥ 90 and `overactivity_warned_at is null`, set it and flag the warning in the response. At most once per session (GDD 11 §8.3). In-app banner only, never a push. Sessions that ended before the player opened the app do not fire it retroactively (GDD 11 §8.2) — the client decides that by checking whether the session is live, and the server simply reports threshold-crossed.

### Response

```
{
  "server_time": "...",
  "content_version": 7,
  "player": { ...authoritative state: level, xp_current, xp_lifetime,
              unspent_stat_points, lifetime_steps, vigor_current, ... },
  "leagues": 214,
  "level_ups": [ { "level": 12, "stat_points_awarded": 3 } ],
  "activity_days": [ { "activity_date": "...", "steps": ..., "xp_awarded": ...,
                       "goal_met": true, "streak_credit_method": "goal_hit" } ],
  "streak": { "current": 9, "longest": 22 },
  "encounter_grants": [ { "grant_id": "...", "enemy_id": "enemy_harpy",
                          "zone_id": "olympion", "source": "travel" } ],
  "rewards_granted": [ ... ],
  "pending_rewards": [ ... ],
  "map": { "gates": [ { "gate_id": "gate_cyclops", "state": "available" } ] },
  "warnings": [ { "code": "overactivity", "session_id": "..." } ],
  "accepted_delta_ids": [ ... ],
  "duplicate_delta_ids": [ ... ]
}
```

`accepted_delta_ids` / `duplicate_delta_ids` are what let the client dequeue safely: both lists mean "stop resending this", and the split exists only so a duplicate-heavy sync is visible in logs rather than invisible.

### Worked example

Two days offline, then one open. Day 1: 8,000 steps, 45 min Vigorous. Day 2: 6,200 steps, no workout. Player at L11, 400/1,240 XP, 205,000 lifetime steps, goal 7,000, streak 8.

| Step | Result |
|---|---|
| 1–3 | 2 deltas insert; `activity_day` for both dates created |
| 4 | Day 1: 8,000/20 = 400 step XP + 45×5 = 225 tier XP = **625**. Day 2: 6,200/20 = **310**. Total **935** |
| 5 | 400 + 935 = 1,335 ≥ 1,240 → **L12**, +3 points, 95 XP carried into L12 |
| 6 | `lifetime_steps` 205,000 → **219,200**; Leagues 205 → **219** |
| 7 | Cerberus gate at 220 Leagues — still 1 short, stays `locked` |
| 8 | 14 new Leagues → 14 rolls at 25%; 3 bonus session rolls capped to 2. Day 1 issues 5 and hits the cap; Day 2's rolls are skipped |
| 9 | Day 1 goal met → `goal_hit`, streak 9. Day 2 at 6,200 misses; inside the 48h window but the goal wasn't actually met, so no grace and no repair — steps and XP credited in full regardless |
| 10 | No level milestone at 12; no streak milestone at 9 |
| 11 | 45 min < 90 → no warning |

**Now replay the identical payload.** Step 1 returns zero rows. Step 2 returns no `battle` rows, so no drops are materialised, no bestiary counter moves, and `vigor_current` is not re-applied. Steps 3–9 have an empty working set. Step 10's `milestone_grant` inserts conflict. Result: **0 XP, 0 Leagues, 0 encounters, 0 duplicate grants, 0 duplicate drops**, and a response whose `player` block is byte-identical to the first. That property is the point of the whole design; if a future change breaks it, it breaks here.

---

## 5. Offline queue design

**Storage.** An append-only, crash-durable local queue. T4 chooses the engine; T2 fixes the contract: an entry survives process death, entries drain FIFO, and an entry is removed only after the server names its ID in `accepted_delta_ids` or `duplicate_delta_ids`.

**`client_delta_id` derivation** — tech-01 §7's explicit ask. **A UUIDv7 minted at the moment the delta is created on-device, persisted with it, and never regenerated.** Retries resend the same ID; that is the whole mechanism.

> **It must not be a hash of the payload, and it must not be derived from `(date, source, steps)` or any other content tuple.** Two legitimately distinct deltas can be identical in content — the same step count, from the same source, in the same minute — and a content-derived key would collide, `ON CONFLICT DO NOTHING` would drop the second, and the player would silently lose real steps. The failure is invisible, unrecoverable, and directly violates the core promise that effort is never wasted. The ID identifies the *record*, not the *value*.

**Retry.** Capped exponential backoff (1s → 60s), full jitter. The queue drains completely before the response is applied to the mirror; a partial upload is never partially reconciled.

**Optimistic preview.** The client projects XP and Leagues locally the instant a delta is created and shows them immediately — waiting for a PC that may be off is not an option. On response, **the server's numbers replace the projection outright.** The client never adds the server's result to its own; never treats a lower server value as an error to correct; never re-queues to "make up" a difference. If a projection was optimistic, the display corrects quietly. Server wins for all progression, unconditionally.

**Long offline stretches.** Deltas are tiny (~100 bytes) and bounded by real activity — a month offline is a few hundred entries, single-digit KB. Cap the queue at **5,000 entries**; on reaching it, coalesce the oldest entries *within the same `activity_date` and `source`* into one delta with a fresh ID, which preserves every step and minute and loses only per-delta granularity. Never drop an entry.

---

## 6. Conflict rules

### 6.1 Additive merge — never last-write-wins
Applies to `steps`, `tier{1,2,3}_minutes`, `xp_awarded`, `xp_current`, `xp_lifetime`, `lifetime_steps`.

**Invariant:** these values are monotonically non-decreasing on the server, and no sync response may ever return one lower than it returned before. There is no code path that assigns them; every write is `col = col + delta`. Last-write-wins would mean a client that computed a smaller total — from a partial read, a stale mirror, a reinstall — could erase real effort. GDD 1 §1 and GDD 9 §2.1 both make that unacceptable, and it is the reason this whole protocol is delta-shaped rather than state-shaped.

### 6.2 Idempotent-once
Applies to `battle`, `milestone_grant`, `pending_reward` resolution, stat-point allocation, encounter grant redemption. Replay is a **no-op, not a repeat**. Each has a unique key on a client-generated ID and each conflict is swallowed with `DO NOTHING`. Deriving these from "has this already happened?" logic rather than a constraint is how a level-30 milestone gets granted twice.

### 6.3 Last-write-wins — correct, and used deliberately
Applies to `player_settings` (step goal, reminder time, volumes), `player_equipped_skill`, `player_gear.equipped_slot`, and `hr_session` tier minutes. These are point-in-time state or genuine preferences: the newest value *is* the truth, and adding them would be nonsense. Called out explicitly so the additive rule from §6.1 doesn't get cargo-culted onto fields where it does damage — a step goal that accumulated would climb to absurdity, and a re-observed HR session that added its minutes would double the workout.

### 6.4 Retroactive days
A delta arriving for an already-closed `activity_date` merges additively into that day and re-evaluates **only that day's** goal, credit method, and streak position. It never rewrites days after it, never re-grants a milestone that day already produced, and never re-rolls encounters for a day whose `encounters_used` is already set. Steps landing late still count toward `lifetime_steps` and therefore toward Leagues, which is correct — the Waymarker tracks lifetime distance, not when it was recorded.

### 6.5 The single-device seam
Per §1.5: one device assumed. Concurrent devices would not corrupt totals — additive merge over per-device delta IDs is safe by construction — but per-day streak evaluation, the 3-per-30-days grace cap, and the quieter device's mirror would all misbehave. Noted, not solved (GDD 11 §11).

---

## 7. Cross-spec flags

- **T3 (Health Integration):** owns everything that populates `sync_delta` with `source in ('steps','hr')` and everything that fills `hr_session`. Two contracts it must satisfy: tier-minute derivation happens on-device and arrives already bucketed (the server never sees raw HR), and `hr_session.external_session_id` must be stable across re-observations — §4 step 2 sets session minutes rather than adding them, which only works if the same session keeps the same key. If Health Connect can't provide one, the fallback `(player_id, started_at)` key keeps this transaction valid unchanged.
- **T4 (Client Architecture):** owns the queue's storage engine, the local mirror, and the optimistic-preview UI. Three requirements from here: the queue must survive process death, the mirror must be repairable from `GET /players/me` in one shot, and the reconciliation must be visibly *quiet* — a corrected projection is not an error state and must not render as one.
- **T5 (Battle Engine):** owns the `battle` payload shape and produces a `client_battle_id` under the same never-derive-from-content rule as §5. Consumes encounter grants rather than rolling its own encounters (§1.3). Item consumption and Vigor changes ride along with the battle payload, not as separate writes. **Amended 2026-07-26 by T5 §1.6:** the payload also carries a `drops` array (§4.1) — the client rolls loot so it exists offline, and step 2 materialises it only for newly-inserted battles. This is the one place the client supplies a value the server would otherwise derive, and the trust boundary it moves is stated in §4.1.
- **T5 — grant return on abandonment.** T5 §8.1 abandons a battle whose `content_version` or snapshot schema moved underneath it and returns the encounter grant unspent. Because grants are held client-side until spent (§1.3), "return" is a local no-op and nothing in this spec changes — the `grant_already_spent` path is simply never reached for that battle. Named because the failure mode is otherwise invisible from the server's side.
- **T6 (Deployment):** the API being unreachable is the normal case, not an outage — health checks and any future alerting must not treat it as one. Tailscale reachability is what makes §1.4's token load-bearing rather than ceremonial.
- **M1 (The Walk):** §4 is M1's spine — steps → XP → level-up, with §4 steps 7–11 stubbed until their milestones. The replay property from §4's worked example is the first integration test worth writing.
- **Manifest:** T2 introduces no new content IDs. `grant_id` and the operation IDs on progression writes are runtime UUIDs, not manifest keys.

---

## 8. Deferred by design

| Deferred | Why / how it lands |
|---|---|
| Multi-device sync | GDD 11 §11 leaves it open. Additive merge means it can't corrupt totals; per-day evaluation would need a design pass. |
| Real auth | `POST /auth/*` plus `auth_identity`; the bearer token slot already exists, so no endpoint changes. |
| Push notifications | Local-only per the trim. Nothing in this surface sends or schedules a push. |
| Server-side analytics ingest | Sentry only per the trim. No `POST /events`. |
| Anti-cheat / delta validation | Explicitly out of scope (tech-01 §6). The server does not validate that step counts are physically plausible, and `sync_delta` must not drift into an audit trail. |
| Conditional/partial sync | The batch is small enough that partial-payload negotiation would be complexity without a payoff. Revisit only if a real payload gets large. |
