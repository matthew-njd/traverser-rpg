# Traverser Tech Spec — T1: Data Model & Schema

**Status:** locked. **Amended 2026-08-01** with four schema additions that later locked specs require and this one does not provide — `player_settings.birth_year` (T3 §1.4), `encounter_grant` + `battle.grant_id` (T2 §1.3/§6.2), `auth_token` (T2 §1.4), `client_operation` (T2 §3/§6.2). All four are §4 player-schema additions; the content schema (§3) and its seed plan (§5) are unchanged. Discovery record in `DECISIONS.md`. Inputs: GDD Sections 1, 4, 8, 9, 11 · `traverser-data-manifest.md` · `traverser-test-fixtures.md` · sanctioned scope trims.
**Scope:** the Postgres schema and its seed plan. No EF project, migrations, or seed SQL are written this session — those land in M0.

---

## 1. Decisions

**1.1 Content lives in seeded Postgres tables; the client caches a versioned bundle.**
Every stat table, formula coefficient, drop rate, and threshold in the GDD becomes real rows keyed by manifest IDs. The API serves them as one bundle stamped with `content_version`; the client caches it locally and re-fetches only when the version changes. This matters because the battle engine is client-side (sanctioned trim) and must work with the API off — but keeping the numbers in the database rather than in the RN bundle means there is exactly one place a GDD table is transcribed, it can be asserted against the fixtures by a real test, and player rows can carry foreign keys to it.

**1.2 Activity history = daily rollup + append-only sync-delta ledger.**
`activity_day` is the queryable rollup (one row per local calendar date). `sync_delta` is the raw append-only record of every contribution that produced it, carrying a client-generated ID. T2's additive merge needs this: XP and steps are additive values where last-write-wins is unacceptable, so a re-sync must be a no-op rather than a double-count, and Section 11 §3.2's 48-hour grace lookback must be replayable. The ledger is the dedupe key and the audit trail; the rollup is what everything else reads.

**1.3 Strictly normalized. No JSONB catch-alls.**
Quests, classes, and currency arrive later as new tables with FKs to `player`, changing nothing that already exists. A JSONB `extra` column would buy a migration today and cost type safety forever, and EF Core maps normalized columns far more cleanly.

**1.4 One row per inventory instance; no persisted slot index.**
GDD 4 §5.1 is explicit that each of the 20 item slots holds one individual item, not a stack — so a row per physical item *is* the model, with the cap enforced by count at acquisition. Gear is the same, with the equipped slot as a nullable column rather than a separate table. Persisting a UI grid position would add gap-compaction logic to every add and discard for no gameplay benefit.

---

## 2. Conventions

- **snake_case throughout.** EF Core maps it via `EFCore.NamingConventions` → `UseSnakeCaseNamingConvention()` on the `DbContext` options. Without this, EF silently creates `PlayerItem`/`ItemDefId` tables and columns and every hand-written query below breaks. Set it in M0 before the first migration.
- **Keys.** Player-owned rows use `uuid` PKs (UUIDv7 where available, so inserts stay index-friendly). **Content rows use `text` PKs holding the manifest ID verbatim** — `enemy_harpy`, `item_pale_ash`, `gear_weapon_mortal`. Manifest rule 2 guarantees keys never change once shipped, so they are safe natural keys, and every FK is self-documenting in a raw query.
- **Closed sets** (tier, slot, category, rarity, encounter kind, streak credit method, effect) are `text` + a `CHECK` constraint, mapped through an EF value converter. Not Postgres `ENUM` types: adding a value to those requires a migration and they interact badly with EF's model snapshot.
- **Time.** All instants are `timestamptz`. The single exception is `activity_date date`, a *local calendar date* per Section 11 §2.2's local-midnight rollover; `player.timezone` holds the IANA zone used to derive it.
- **Numbers.** Every fractional game value (`0.25`, `1.5`, `0.6`, type multipliers) is `numeric`, never `float`. The fixtures assume exact `floor()` and `round()` behaviour; binary floating point will eventually produce an off-by-one at a tier boundary.
- **Derived values are not stored.** Leagues (`lifetime_steps / 1000`), effective stats (base + allocation + gear), enemy stats at level, and XP-to-next are all computed. Only *rolled* values — anything with RNG or a point-in-time snapshot — are persisted.

---

## 3. Content schema

Seeded, read-only at runtime. Together these tables are the client's content bundle.

```sql
create table content_version (
  id            int primary key default 1 check (id = 1),
  version       int         not null,
  generated_at  timestamptz not null default now()
);
```
Single-row table. Any seed change bumps `version`; the client compares and re-downloads. This is the whole cache-invalidation story.

```sql
create table game_type (
  id             text primary key,          -- storm, war, trickery, underworld, sea, wisdom
  display_name   text not null,
  cycle_ordinal  int  not null unique       -- 0..5, Section 2 cycle order
);

create table type_effectiveness (
  attacker_type_id text not null references game_type,
  defender_type_id text not null references game_type,
  multiplier       numeric(3,2) not null,
  primary key (attacker_type_id, defender_type_id)
);
```
36 rows seeded **verbatim from fixtures §1**, not computed from `cycle_ordinal` at seed time. The cycle is stored for UI ordering only; deriving the chart from it would put a second implementation of the rule in the seeder, where a bug would be invisible.

> The chart applies **only to the player's own typed attacks**. Enemy Divine moves never look up this table, and Physical moves never do in either direction. This is a lookup table, not a rule — the rule lives in the battle engine (T5).

```sql
create table zone (
  id           text primary key,            -- olympion, valheon, imperion, egypt_tbd
  display_name text not null,
  ordinal      int  not null unique,
  is_released  boolean not null default true
);
```
`egypt_tbd` seeds with `is_released = false` so the Map's locked terminus (GDD 9 §3.1) is data, not a hardcoded special case.

```sql
create table enemy (
  id           text primary key,            -- enemy_harpy ...
  display_name text not null,
  zone_id      text references zone,        -- null for enemy_waystone_wisp
  type_id      text references game_type,   -- null for enemy_waystone_wisp
  role         text not null check (role in ('wild','mid_boss','zone_boss','tutorial'))
);

create table enemy_stat_scaling (
  enemy_id text not null references enemy,
  stat     text not null check (stat in ('vigor','might','resolve','favor','aegis','stride')),
  base     numeric(6,2) not null,
  rate     numeric(6,3) not null,
  primary key (enemy_id, stat)
);
```
Sections 5–7 give every enemy stat as `floor(base + rate × L)` (e.g. Harpy Vigor `8 + 3L`, Might `5 + 0.25L`). Storing base and rate — rather than a stat block per level — is what makes "enemy level always equals player level at encounter time" fall out for free: there is no enemy level to persist anywhere, ever. 13 enemies × 6 stats = 78 rows.

```sql
create table enemy_move (
  id        text primary key,               -- emove_gust_strike ...
  enemy_id  text not null references enemy,
  display_name text not null,
  category  text not null check (category in ('physical','divine')),
  type_id   text references game_type,      -- null for physical moves
  power     int  not null,
  ai_weight int  not null check (ai_weight between 0 and 100)
);
```
28 rows. Weights sum to 100 per enemy — assert it in a seed test rather than a constraint, since a per-group CHECK isn't expressible. `emove_savage_bite_cerberus` and `emove_savage_bite_fenrir` are separate rows sharing a display name, exactly as the manifest specifies.

```sql
create table player_skill_def (
  id           text primary key,            -- skill_basic_attack, skill_iron_advance ...
  display_name text not null,
  category     text not null check (category in ('physical','divine')),
  type_id      text references game_type,   -- null for physical
  power        int  not null,
  uses         int,                         -- null = unlimited (basic attack only)
  unlock_level int  not null                -- 1 for basic attack
);

create table gear_move (
  id            text primary key,           -- move_gatekeepers_ruse ...
  display_name  text not null,
  source_gear_id text not null,             -- FK added after gear_def (circular; see note)
  type_id       text not null references game_type,
  power         int  not null,
  uses          int  not null,
  effect        text check (effect in ('weaken','fortify','swift','rend'))
);
```
10 skill rows, 6 gear-move rows. `gear_move.source_gear_id` and `gear_def.grants_move_id` are mutually referential — declare `source_gear_id` as a deferred FK, or drop it and treat `gear_def.grants_move_id` as the single direction. **Recommend the latter**: one direction, and `source_gear_id` becomes a redundant reverse-lookup. Kept above only to make the manifest's own table shape recognisable.

```sql
create table item_def (
  id           text primary key,            -- item_travelers_salve ...
  display_name text not null,
  category     text not null check (category in ('heal','buff','surge','breach')),
  rarity       text not null check (rarity in ('common','uncommon','rare')),
  type_id      text references game_type,   -- surge/breach only
  heal_pct     int,                         -- heal only: 20, 40, 100
  effect       text check (effect in ('weaken','fortify','swift','rend')),  -- buff only
  max_stack    int  not null,               -- per-type acquisition cap
  battle_only  boolean not null,            -- false for the three heals (GDD 4 §4)
  flavor       text not null
);
```
18 rows. `max_stack` is the per-*type* maximum from GDD 4 §5.1 (5 heal / 3 buff / 3 charm), enforced at acquisition — not a stack size, since slots hold single items.

```sql
create table gear_def (
  id              text primary key,         -- gear_weapon_mortal, gear_gatekeepers_snare ...
  display_name    text not null,
  slot            text not null check (slot in ('weapon','armor','accessory','trinket')),
  tier            text not null check (tier in ('mortal','heroic','mythic','divine')),
  zone_id         text references zone,     -- trinkets only; null for W/A/A
  grants_move_id  text references gear_move,-- mythic/divine trinkets only
  flavor          text
);

create table gear_tier_bonus (
  tier          text primary key check (tier in ('mortal','heroic','mythic','divine')),
  rate          numeric(4,3) not null,      -- 0.05 / 0.10 / 0.17 / 0.25
  flat          int          not null,      -- 1 / 2 / 3 / 4
  trinket_split numeric(3,2) not null       -- 0.60, all tiers
);
```
21 gear rows (12 Weapon/Armor/Accessory + 9 Trinkets), 4 bonus rows. Bonus at drop = `round(rate × L) + flat`; a Trinket instead grants `round(0.6 × that)` to **both** Favor and Aegis.

> **Stride never appears here.** There is no slot that governs Stride and no way to add one without a schema change — GDD 8 §3.1's exclusion is enforced structurally, not by convention.

```sql
create table zone_gate (
  id               text primary key,        -- gate_cyclops ...
  zone_id          text not null references zone,
  enemy_id         text not null references enemy,
  gate_kind        text not null check (gate_kind in ('mid_boss','final_boss')),
  league_threshold int  not null,
  unlocks_zone_id  text references zone,    -- final bosses only
  is_hard_gate     boolean not null         -- false = mid-boss, walkable past
);
```
6 rows from GDD 9 §3 / fixtures §8. Both unlock conditions are expressed here: `league_threshold` against the Waymarker, and `unlocks_zone_id` requiring this gate's boss defeated.

```sql
create table drop_rate (
  encounter_kind text not null check (encounter_kind in
                   ('wild','mini_boss','zone_boss_first','zone_boss_repeat','daily_goal')),
  reward_kind    text not null check (reward_kind in ('item','gear','trinket')),
  chance         numeric(4,3) not null,     -- 0.35, 0.20, 1.000 ...
  qty_min        int not null,
  qty_max        int not null,
  tier           text,                      -- gear/trinket tier granted, null for items
  primary key (encounter_kind, reward_kind)
);

create table enemy_drop_pool (
  enemy_id       text not null references enemy,
  encounter_kind text not null,
  item_def_id    text not null references item_def,
  weight         int  not null default 1,
  primary key (enemy_id, encounter_kind, item_def_id)
);
```
`drop_rate` holds the rate *structure* (GDD 4 §6.1, GDD 8 §5.1/§5.2/§5.3) — the three independent dice per encounter. `enemy_drop_pool` holds the per-enemy thematic subsets from Sections 5–7, which take precedence over the generic common pool. An enemy with no pool rows falls back to the generic pool; `enemy_waystone_wisp` deliberately has none (fixtures §3: no drops).

```sql
create table streak_milestone (
  day   int  primary key,                   -- 3, 7, 14, 25, 40, 60, 90, 120
  slot  text not null check (slot in ('weapon','armor','accessory')),
  tier  text not null check (tier in ('mortal','heroic','mythic'))
);

create table level_milestone (
  level       int  not null,
  reward_kind text not null check (reward_kind in ('item','gear')),
  item_def_id text references item_def,     -- item track
  gear_tier   text,                         -- gear track
  primary key (level, reward_kind)
);
```
8 streak rows (fixtures §7). Level milestones are two interleaved tracks deliberately offset from each other (GDD 8 §5.4): items at 10/20/30/40/50/60, gear at 15/25/35/45/55. The CHECK on `streak_milestone.tier` excludes `divine` structurally — Section 11 §5.1's rule that a streak can never grant Divine or a Trinket is enforced by the schema, not by remembering it.

```sql
create table xp_curve (
  level      int primary key check (level between 1 and 60),
  xp_to_next int,                           -- null at level 60
  cumulative int not null
);
```
**Seeded, not computed at runtime.** `round(100 × L^1.05)` is trivial to evaluate, but .NET's banker's rounding and JS's `Math.round` disagree at exact halves, and the client and server must never disagree about whether the player levelled. 60 rows, asserted against fixtures §4. `xp_to_next` is null at 60, which is also the schema's statement that XP accrual stops there — there is nowhere for banked overflow to go.

---

## 4. Player schema

```sql
create table player (
  id                    uuid primary key,
  traverser_name        text not null,
  timezone              text not null,        -- IANA, e.g. America/New_York
  created_at            timestamptz not null default now(),

  level                 int not null default 1 check (level between 1 and 60),
  xp_current            int not null default 0,   -- toward next level
  xp_lifetime           bigint not null default 0,
  unspent_stat_points   int not null default 0,

  alloc_vigor           int not null default 0,
  alloc_might           int not null default 0,
  alloc_resolve         int not null default 0,
  alloc_favor           int not null default 0,
  alloc_aegis           int not null default 0,
  alloc_stride          int not null default 0,

  vigor_current         int not null,
  vigor_anchor_at       timestamptz not null,  -- last point regen was settled from
  lifetime_steps        bigint not null default 0,
  daily_step_goal       int not null default 7000 check (daily_step_goal >= 3000),
  tutorial_completed_at timestamptz
);
```
- Stores **allocated points only**. Effective stat = L1 base (Vigor 20, others 10) + allocation + equipped gear. Base values stay code constants so a rebalance is a deploy, not a data migration.
- `lifetime_steps` **is** the Waymarker. Leagues are `lifetime_steps / 1000`, derived on read (GDD 9 §2.1) — storing them would create two numbers that can disagree.
- Vigor regen (1% per 10 min) is computed lazily from `vigor_anchor_at` on read and settled on write. No background job, which fits the sync-on-open-only architecture.
- `daily_step_goal`'s CHECK is Section 11 §2.1's hard floor of 3,000.
- Guest-only profile per the sanctioned trim: no auth columns, no email, no provider IDs. The table is nonetheless keyed by `uuid` rather than a singleton, so adding accounts later is additive.

```sql
create table player_settings (
  player_id             uuid primary key references player on delete cascade,
  daily_reminder_time   time,               -- null = off; fixed-time local notification
  music_volume          numeric(3,2) not null default 1.0,
  sfx_volume            numeric(3,2) not null default 1.0,
  birth_year            int check (birth_year between 1900 and 2100)
);
```
Split from `player` so UI preference writes never contend with progression writes during a sync transaction.

> **Amended 2026-08-01:** `birth_year` added. GDD 1 §2.2 requires `HRmax = 220 − age` and GDD 10's eleven-screen onboarding never collects it — T3 §1.4 closes that gap with a birth-year field on Screen 3 and T4 §6.4 places it here, in the mirrored `player_settings` row, rather than in a second preferences store. This spec had no column for it.
>
> **Nullable, deliberately:** the row is created at registration, which precedes Screen 3, and T3 §1.4 makes the field editable in Settings afterwards. Null means *not yet collected* — HR tier thresholds cannot be derived and tier minutes are not charged, which is the correct behaviour rather than a silent default age. It is **not** a "0 XP" state: Step XP is unaffected.
>
> Last-write-wins per T2 §6.3, like every other field in this table. Changing it re-derives thresholds for future reads only and never recomputes past days — XP is never taken back (GDD 1 §1), so no historical `activity_day` or `hr_session` row is touched.
>
> The CHECK is a **data-sanity bound with no GDD source**, present only so a typo cannot produce a negative or absurd HRmax. Real validation (a plausible minimum age) belongs on the client at Screen 3.

```sql
create table auth_token (
  token_hash   bytea primary key,           -- sha256 of the opaque token; the token itself is never stored
  player_id    uuid not null references player on delete cascade,
  issued_at    timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index on auth_token (player_id);
```

> **Added 2026-08-01.** T2 §1.4 makes guest identity a device-generated `player_id` plus an opaque long-lived bearer token, and T6 §4 puts the API on a tailnet rather than localhost — which is what makes the token load-bearing rather than ceremonial. This spec described the guest profile (§4, `player`) but gave the token nowhere to live.
>
> **The token is stored hashed, not plaintext.** It is a credential with no expiry and no refresh flow, and T6 §10.5 puts `pg_dump` output in an already-synced cloud folder — a plaintext bearer token would be replicated off-machine on a nightly schedule. SHA-256 with no salt is correct here precisely because the token is server-minted high-entropy random, not a user-chosen secret: there is no dictionary to attack and per-row salting would only prevent the O(1) lookup the auth path needs.
>
> `revoked_at` rather than a delete, so "this device was de-authorised" stays distinguishable from "this token never existed" when something 401s unexpectedly. `last_used_at` is diagnostics only — nothing reads it to make a decision, and it must not become a session-expiry mechanism without a spec change.
>
> Multiple live rows per player are allowed. T2 §1.4 registers once, so the normal count is one; the table does not enforce that, because re-registration after a reinstall (T6 §13.1's identity-restore path) legitimately mints a second. **This is not the multi-device seam** (T2 §1.5) — it is one device that got a new token.
>
> Real auth remains additive exactly as §6 says: `auth_identity` arrives alongside this table, not instead of it.

```sql
create table player_equipped_skill (
  player_id uuid not null references player on delete cascade,
  slot      int  not null check (slot between 1 and 4),
  skill_id  text not null references player_skill_def,
  primary key (player_id, slot),
  unique (player_id, skill_id)
);
```
The 1–4 slot range is the "max 4 equipped skills" rule. *Unlocked* skills are not stored — they are derivable from `level >= unlock_level`, so there is nothing to keep in sync.

```sql
create table player_item (
  id          uuid primary key,
  player_id   uuid not null references player on delete cascade,
  item_def_id text not null references item_def,
  acquired_at timestamptz not null default now(),
  source      text not null check (source in
                ('wild_drop','miniboss_drop','boss_drop','daily_goal','level_milestone',
                 'streak_overflow','zone_entry','tutorial'))
);
create index on player_item (player_id, item_def_id);
```
One row per physical item. The 20-slot cap and the per-type `max_stack` are enforced in application logic at acquisition (GDD 4 §5.1's "enforced at acquisition, not at use"), because milestone grants deliberately bypass the cap and route through `pending_reward` instead.

```sql
create table player_gear (
  id            uuid primary key,
  player_id     uuid not null references player on delete cascade,
  gear_def_id   text not null references gear_def,
  level_at_drop int  not null,
  bonus_primary int  not null,              -- Might/Resolve/Vigor, or Favor on a trinket
  bonus_secondary int,                      -- Aegis on a trinket; null otherwise
  equipped_slot text check (equipped_slot in ('weapon','armor','accessory','trinket')),
  acquired_at   timestamptz not null default now(),
  source        text not null
);
create unique index on player_gear (player_id, equipped_slot) where equipped_slot is not null;
```
**The rolled bonus is frozen at drop time** (GDD 8 §3.2) — persisted, never recomputed. `level_at_drop` is stored alongside it purely so the value can be re-derived for verification. The partial unique index is what makes "one item equipped per slot" true in the database rather than in a service method.

```sql
create table activity_day (
  player_id            uuid not null references player on delete cascade,
  activity_date        date not null,       -- player-local calendar date
  steps                int  not null default 0,
  tier1_minutes        int  not null default 0,
  tier2_minutes        int  not null default 0,
  tier3_minutes        int  not null default 0,
  xp_awarded           int  not null default 0,
  step_goal_snapshot   int  not null,
  goal_met             boolean not null default false,
  streak_credit_method text check (streak_credit_method in
                         ('goal_hit','rest_day_tag','auto_sync_grace')),
  rest_tagged_at       timestamptz,
  encounters_used      int not null default 0 check (encounters_used <= 5),
  daily_item_claimed_at timestamptz,
  daily_gear_rolled    boolean not null default false,
  primary key (player_id, activity_date)
);
```
- `step_goal_snapshot` records the goal in force *that day*. Without it, raising the goal would retroactively un-hit past days and break a streak that was legitimately earned.
- `encounters_used` is Section 9 §5.3's hard cap of 5/day, resetting for free because the row is per local date.
- `streak_credit_method` is the whole grace system: Section 11 §3.2's cap of 3 auto-credits per rolling 30 days is a `COUNT(*) WHERE streak_credit_method = 'auto_sync_grace' AND activity_date > now() - 30 days`. No separate counter table, nothing to keep consistent.
- A null `streak_credit_method` on a past date is a break (Section 11 §3.3) — and the schema holds no "streak lost" flag or notification queue, matching the non-punitive rule.

```sql
create table sync_delta (
  id              uuid primary key,
  player_id       uuid not null references player on delete cascade,
  client_delta_id uuid not null,            -- generated on-device
  activity_date   date not null,
  source          text not null check (source in ('steps','hr','battle','manual')),
  steps_delta     int not null default 0,
  minutes_delta   int not null default 0,
  hr_tier         int check (hr_tier between 1 and 3),
  xp_delta        int not null default 0,
  recorded_at     timestamptz not null,     -- device clock, when the activity happened
  applied_at      timestamptz not null default now(),
  unique (player_id, client_delta_id)
);
create index on sync_delta (player_id, activity_date);
```
Append-only. **The unique constraint on `(player_id, client_delta_id)` is the entire idempotency mechanism** T2 builds on: the client resends freely, `ON CONFLICT DO NOTHING` drops duplicates, and `activity_day` is only incremented for rows that actually inserted. This is what makes the merge additive-and-safe rather than last-write-wins.

```sql
create table client_operation (
  player_id    uuid not null references player on delete cascade,
  operation_id uuid not null,               -- client-generated, per T2 §2
  endpoint     text not null,               -- diagnostics only; never switched on
  applied_at   timestamptz not null default now(),
  primary key (player_id, operation_id)
);
```

> **Added 2026-08-01.** T2 §2 requires that *every* write carry a client-generated ID and be safe to retry — "if a new write endpoint can't state its idempotency key, it isn't finished." `sync_delta` provides that for `POST /sync` and `client_battle_id` for battles, but T2 §3's progression writes had no ledger, and T2 §6.2 lists stat-point allocation among the idempotent-once operations. This is the same mechanism as `sync_delta`'s unique constraint, for the endpoints that are not a sync.
>
> **Only the endpoints that actually need it write here.** Most of T2 §3 is already safe without a ledger: `PUT /skills` and the equip toggle are last-write-wins (T2 §6.3), and `pending-rewards/{id}` is idempotent on the reward's own `resolved_at`. The genuinely dangerous ones are the **additive or effectful** writes — `POST /allocations` above all, where a replayed request that already applied would silently re-add stat points, plus item discard, rest-day tagging, and Explore requests.
>
> `INSERT ... ON CONFLICT DO NOTHING RETURNING *` and act only on returned rows, exactly as T2 §4 step 1 does for deltas. **Zero rows means already-applied, which is a success, not an error** — the response is the player's current state, and T2 §3's word "rejected" for allocations means the points are not added twice, not that the client sees a failure.
>
> No response body is stored. The mirror is repairable from `GET /players/me` in one shot (T2 §7), so a replay returning current state is always sufficient and a response cache would be a second copy of the truth.
>
> `endpoint` is for reading the table during debugging. Nothing branches on it — an operation ID is unique on its own, and making behaviour depend on this column would let a client change the outcome of a replay by relabelling it.

```sql
create table hr_session (
  id                   uuid primary key,
  player_id            uuid not null references player on delete cascade,
  external_session_id  text,                -- Health Connect record id, for dedupe
  started_at           timestamptz not null,
  ended_at             timestamptz,
  tier1_minutes        int not null default 0,
  tier2_minutes        int not null default 0,
  tier3_minutes        int not null default 0,
  overactivity_warned_at timestamptz,
  encounter_rolls_granted int not null default 0 check (encounter_rolls_granted <= 2),
  unique (player_id, external_session_id)
);
```
Sessions are first-class because two rules need session boundaries, not daily totals: the 90-cumulative-minute overactivity warning that fires **at most once per session** (Section 11 §8.3 — `overactivity_warned_at` is that flag), and Section 9 §5.1's one encounter roll per 15 continuous minutes, **max 2 per session**. T3 owns what populates this.

```sql
create table streak_state (
  player_id           uuid primary key references player on delete cascade,
  current_streak      int  not null default 0,
  longest_streak      int  not null default 0,
  last_credited_date  date
);
```
Cached counters derivable from `activity_day`, kept because the Character screen reads them on every open. `longest_streak` is Section 11 §4's permanent personal best — it never decreases, so a break erases the counter but not the record.

```sql
create table encounter_grant (
  id            uuid primary key,           -- `grant_id` on the wire
  player_id     uuid not null references player on delete cascade,
  zone_id       text not null references zone,
  enemy_id      text not null references enemy,
  source        text not null check (source in ('travel','workout','explore')),
  activity_date date not null,              -- the day it was charged against encounters_used
  issued_at     timestamptz not null default now(),
  foreign key (player_id, activity_date) references activity_day (player_id, activity_date)
);

create index on encounter_grant (player_id, activity_date);
```

> **Added 2026-08-01.** T2 §1.3 is the seam that makes offline battles possible: sync does not deliver battles, it delivers **grants** with the zone and enemy already resolved server-side and already charged against `activity_day.encounters_used`. The client holds them and spends them whenever. T2's sync response returns `encounter_grants[]`, its battle payload carries `grant_id`, and its error vocabulary includes `grant_already_spent` — none of which had a table here.
>
> `source` is GDD 9 §5.1's three trigger sources. It is recorded because the 5/day cap counts all three against one pool but only `explore` is player-initiated, so a support question about "where did my encounters go" is otherwise unanswerable.
>
> The composite FK to `activity_day` is what stops a grant existing on a day that was never charged. `encounters_used` stays the authoritative counter — GDD 9 §5.3's cap is enforced by its own CHECK, not by counting rows here.

Grant redemption is expressed on the battle rather than here:

```sql
create table battle (
  id               uuid primary key,
  player_id        uuid not null references player on delete cascade,
  client_battle_id uuid not null,
  grant_id         uuid references encounter_grant,   -- null for boss and tutorial battles
  enemy_id         text not null references enemy,
  encounter_kind   text not null check (encounter_kind in
                     ('wild','mini_boss','zone_boss','tutorial','explore')),
  enemy_level      int  not null,           -- == player level at encounter time
  outcome          text not null check (outcome in ('win','loss','flee')),
  xp_awarded       int  not null default 0,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  unique (player_id, client_battle_id)
);

create unique index on battle (grant_id) where grant_id is not null;
```
The engine runs client-side, so results arrive as sync payloads — `client_battle_id` gives them the same replay safety as `sync_delta`. `enemy_level` is recorded as history (it equals the player's level at that moment, but the player's level moves on). A loss awards 0 XP with no penalty, per GDD 1 §2.3.

> **Amended 2026-08-01:** `grant_id` and its partial unique index added.
>
> **A grant carries no `spent_at`.** "Spent" is derived — a grant is spent iff a battle references it — because §2's rule is that derived values are not stored, and a `spent_at` alongside a `battle.grant_id` would be two places holding one fact that can disagree. The partial unique index makes double-spend *structurally* impossible rather than a check someone has to remember, which is the same move as `player_gear`'s one-per-slot index and `milestone_grant`'s permission slip.
>
> T2 §6.2's "replay is a no-op, not a repeat" therefore falls out of the constraint: a replayed battle is already swallowed by `unique (player_id, client_battle_id)`, and a *different* battle claiming a spent grant raises the unique violation T2 surfaces as `grant_already_spent`.
>
> **Nullable, and null is the common case for bosses.** Mid-boss and zone-boss encounters are fixed gate fights (GDD 9 §4.2), not rolls from the daily pool, and the tutorial battle predates any grant. Only `wild` and `explore` battles must carry one. This is not enforced by a CHECK because `encounter_kind` and `grant_id` are supplied by the client in the same payload; T6 §5.2-style validation is the wrong tool and the engine (T5) owns the pairing.
>
> T5 §8.1's abandoned battle returns its grant unspent, which needs nothing here: no battle row is written, so the grant stays underived-unspent and the client can re-spend it.

```sql
create table player_bestiary (
  player_id      uuid not null references player on delete cascade,
  enemy_id       text not null references enemy,
  first_seen_at  timestamptz not null,
  encounter_count int not null default 0,
  defeat_count   int not null default 0,
  primary key (player_id, enemy_id)
);
```
Backs the bestiary screen and — more load-bearing — `defeat_count = 0` versus `> 0` is the first-kill-vs-repeat distinction that decides Divine or Mythic boss loot (GDD 8 §5.2).

```sql
create table player_zone_progress (
  player_id   uuid not null references player on delete cascade,
  zone_id     text not null references zone,
  unlocked_at timestamptz not null default now(),
  primary key (player_id, zone_id)
);
```
Only entry to a *zone* is recorded. Gate state is derived: a gate is Available when `lifetime_steps / 1000 >= league_threshold`, Defeated when `player_bestiary.defeat_count > 0` for its enemy. `olympion` is inserted at profile creation.

```sql
create table milestone_grant (
  player_id      uuid not null references player on delete cascade,
  milestone_kind text not null check (milestone_kind in
                   ('level_item','level_gear','streak_day','zone_entry','tutorial')),
  milestone_key  text not null,             -- '30', '120', 'valheon', ...
  granted_at     timestamptz not null default now(),
  overflow_fallback boolean not null default false,
  primary key (player_id, milestone_kind, milestone_key)
);
```
One row per one-time grant. This is what makes every deterministic reward exactly-once across re-syncs and offline replays — without it, a client that syncs twice across a level-up boundary grants the L30 Warhex twice. `overflow_fallback` records Section 11 §5.3's 2× Herald's Draft substitution when all three slots already exceed the milestone tier.

```sql
create table pending_reward (
  id              uuid primary key,
  player_id       uuid not null references player on delete cascade,
  kind            text not null check (kind in ('item','gear')),
  item_def_id     text references item_def,
  gear_def_id     text references gear_def,
  level_at_drop   int,
  bonus_primary   int,
  bonus_secondary int,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolution      text check (resolution in ('kept','discarded'))
);
```
Backs two flows that both require a reward to survive the app closing mid-prompt: the "road find" daily-goal item collected on next open (GDD 4 §6.2), and the keep/discard overflow prompt when inventory is full (GDD 4 §5.2, GDD 8 §5.5). The rolled gear bonus is captured here at creation so a reward accepted three days later isn't silently re-rolled at a higher level.

---

## 5. Seed-data plan

Every seed row is keyed by a manifest ID. **No ID is invented.** If a GDD table needs a key the manifest lacks (e.g. the `gate_*` and `gear_weapon_{tier}` keys used above), the manifest is amended first and the addition recorded in `docs/DECISIONS.md`.

| Seed source | Target table(s) | Rows |
|---|---|---|
| Manifest §Types + fixtures §1 | `game_type`, `type_effectiveness` | 6, 36 |
| Manifest §Enemies + GDD 5/6/7 stat-scaling tables | `enemy`, `enemy_stat_scaling` | 13, 78 |
| Manifest §Enemy Moves | `enemy_move` | 28 |
| Manifest §Player Skills | `player_skill_def` | 10 |
| Manifest §Gear-Granted Moves + GDD 8 §4.3 | `gear_move` | 6 |
| Manifest §Battle Items + GDD 4 §2 | `item_def` | 18 |
| Manifest §Gear + GDD 8 §7 | `gear_def` | 21 |
| GDD 8 §3.2 | `gear_tier_bonus` | 4 |
| GDD 9 §3 (+ manifest zones) | `zone`, `zone_gate` | 4, 6 |
| GDD 4 §6.1 + GDD 8 §5.1/§5.2/§5.3 | `drop_rate` | ~10 |
| GDD 5/6/7 per-enemy drop tables | `enemy_drop_pool` | ~40 |
| GDD 11 §5.2 / fixtures §7 | `streak_milestone` | 8 |
| GDD 4 §6.3 + GDD 8 §5.4 | `level_milestone` | 11 |
| Fixtures §4 | `xp_curve` | 60 |

**Mechanism:** EF Core `HasData`, so every content change arrives as a reviewable migration with a diff, and `dotnet ef database update` is the only command needed. `content_version` is bumped in the same migration.

**Seed tests (M0 deliverable, delegated to Claude Code):** assert the seeded tables directly against `traverser-test-fixtures.md` —
`xp_curve` vs §4 · `type_effectiveness` vs §1 · `gear_tier_bonus` reproducing §5's eight reference levels for all four tiers and the Trinket split · `enemy_stat_scaling` reproducing all 36 rows of §6 · `streak_milestone` vs §7 · `zone_gate.league_threshold` vs §8. Plus one structural test that every `enemy_move.ai_weight` group sums to 100.

If a test fails, **the seed is wrong** — fixtures are not edited to make tests pass.

---

## 6. Deferred by design

Not built now; each lands as new tables with no change to the above.

| Deferred | How it lands later |
|---|---|
| **Analytics** (Section 15, trim: Sentry only) | A single `analytics_event` table (`player_id`, `name`, `occurred_at`, typed columns per §9's schema). Nothing above references it. |
| **Accounts / auth** (trim: guest-only) | `player` already has a `uuid` PK, not a singleton — add `auth_identity (player_id, provider, subject)` and nothing else changes. *(Amended 2026-08-01: `auth_token` is the guest bearer credential, not accounts — it is built now and stays afterwards; `auth_identity` arrives alongside it.)* |
| **Quests** (Phase 2) | `quest_def` content table + `player_quest` progress table, FK to `player`. |
| **Classes** | `class_def` content table + a `class_id` column on `player`. |
| **Currency / salvage** (GDD 8 §9) | A balance column on `player` + `currency_ledger`; gear discard becomes its sink. |
| **Levels 61–80 / Egyptian zone** | `xp_curve` gains rows; `zone.is_released` flips. Neither is a schema change. |
| **Anti-cheat / data integrity** (trim: skipped) | Deliberately absent. `sync_delta` is an idempotency ledger, not an audit trail — do not let it drift into one. |

---

## 7. Cross-spec flags

> **Amended 2026-08-01.** The flags below were written before T2–T6 existed and read as *this spec asking questions of them*. Four of the answers turned out to need schema this spec didn't have, and those are now built (§4): `encounter_grant` + `battle.grant_id` for T2 §1.3's grant seam, `auth_token` for T2 §1.4's bearer token, `client_operation` for T2 §2/§3's progression-write idempotency, and `player_settings.birth_year` for T3 §1.4's `HRmax = 220 − age`. The flags are left as originally written — they are the record of what was asked — and none of the answers below changed.

- **T2 (API & Sync):** owns the merge semantics over `sync_delta` → `activity_day`. The contract this spec provides is `unique (player_id, client_delta_id)` + `ON CONFLICT DO NOTHING`; T2 must define what the client generates that ID from so it's stable across retries. T2 also owns the ordering inside the sync transaction (steps → XP → level-up → Leagues → gate checks → encounter checkpoints) and must make `milestone_grant` the gate on every deterministic reward.
- **T3 (Health Integration):** owns what populates `hr_session` and the `source = 'hr'` deltas. `hr_session.external_session_id` exists for Health Connect record dedupe — T3 must confirm Health Connect exposes a stable per-session identifier; if it doesn't, the dedupe key becomes `(player_id, started_at)` and that's a schema note, not a redesign. Tier-minute derivation happens on-device; the server stores the result.
- **T4 (Client Architecture):** the client caches the content bundle keyed on `content_version` and must handle the bundle being newer than the app. Asset lookup is by the same manifest key that is the content row's PK — `enemy_harpy` → `enemy_harpy.png` — so no filename ever appears in logic.
- **T5 (Battle Engine):** consumes `enemy_stat_scaling`, `enemy_move`, `player_skill_def`, `gear_move`, `item_def`, `type_effectiveness`, `enemy_drop_pool`, `drop_rate` from the cached bundle and writes back a `battle` row + `sync_delta`. Two rules the schema deliberately does **not** encode, because they're engine behaviour: the type chart applying only to the player's typed attacks, and the tutorial battle bypassing crit and the random factor entirely.
- **M0:** `UseSnakeCaseNamingConvention()` must be configured before the first migration is generated.
