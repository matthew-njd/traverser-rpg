import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * Forward-only schema migrations under `PRAGMA user_version` (tech-04 §6.3).
 *
 * A migration that throws at boot is an app that cannot start, and the only recovery is
 * `adb uninstall` — which destroys `player_id`, the token and the mirror (tech-04 §6.5).
 *
 * 1. **Append only** — a device that applied version N never sees an edit to it. Add N+1.
 * 2. **No down-migrations.** A rollback in dev is an uninstall.
 * 3. **The `user_version` bump goes inside the DDL's transaction**, so a crash mid-apply re-runs.
 */
export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

/**
 * Version 1 — the M1 schema. Mirror tables are named exactly as the server names them, so a sync
 * response maps column-for-column (tech-02 §2). Content tables are M2 (plan §3.2).
 */
const V1_MIRROR: readonly string[] = [
  // `one_row`, not a bare uuid PK: a device holds exactly one player forever (tech-04 §6.5), and
  // a second row would be a silently split mirror. `id` stays UNIQUE for the child foreign keys.
  `CREATE TABLE player (
     one_row               INTEGER PRIMARY KEY CHECK (one_row = 1),
     id                    TEXT    NOT NULL UNIQUE,
     traverser_name        TEXT    NOT NULL,
     timezone              TEXT    NOT NULL,
     created_at            TEXT    NOT NULL,
     level                 INTEGER NOT NULL DEFAULT 1,
     xp_current            INTEGER NOT NULL DEFAULT 0,
     -- Mirrored, not derived — M1 ships no curve. Null at level 60, which renders MAX (GDD 1 §4).
     xp_to_next            INTEGER,
     xp_lifetime           INTEGER NOT NULL DEFAULT 0,
     unspent_stat_points   INTEGER NOT NULL DEFAULT 0,
     alloc_vigor           INTEGER NOT NULL DEFAULT 0,
     alloc_might           INTEGER NOT NULL DEFAULT 0,
     alloc_resolve         INTEGER NOT NULL DEFAULT 0,
     alloc_favor           INTEGER NOT NULL DEFAULT 0,
     alloc_aegis           INTEGER NOT NULL DEFAULT 0,
     alloc_stride          INTEGER NOT NULL DEFAULT 0,
     vigor_current         INTEGER NOT NULL DEFAULT 20,
     lifetime_steps        INTEGER NOT NULL DEFAULT 0,
     daily_step_goal       INTEGER NOT NULL DEFAULT 7000,
     tutorial_completed_at TEXT
   )`,

  `CREATE TABLE player_settings (
     player_id           TEXT PRIMARY KEY NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     daily_reminder_time TEXT,
     -- Text, matching the wire (tech-02 §2 — decimal strings, never floats).
     music_volume        TEXT NOT NULL DEFAULT '1.00',
     sfx_volume          TEXT NOT NULL DEFAULT '1.00',
     -- Null means not yet collected (tech-03 §1.4). Tier minutes are not charged without it.
     birth_year          INTEGER
   )`,

  `CREATE TABLE activity_day (
     player_id            TEXT    NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     -- Bare YYYY-MM-DD, client-local. Never derived from an instant (tech-02 §2).
     activity_date        TEXT    NOT NULL,
     steps                INTEGER NOT NULL DEFAULT 0,
     tier1_minutes        INTEGER NOT NULL DEFAULT 0,
     tier2_minutes        INTEGER NOT NULL DEFAULT 0,
     tier3_minutes        INTEGER NOT NULL DEFAULT 0,
     xp_awarded           INTEGER NOT NULL DEFAULT 0,
     step_goal_snapshot   INTEGER NOT NULL,
     goal_met             INTEGER NOT NULL DEFAULT 0,
     streak_credit_method TEXT,
     PRIMARY KEY (player_id, activity_date)
   )`,

  `CREATE TABLE streak_state (
     player_id           TEXT PRIMARY KEY NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     current_streak      INTEGER NOT NULL DEFAULT 0,
     longest_streak      INTEGER NOT NULL DEFAULT 0,
     last_credited_date  TEXT
   )`,

  `CREATE TABLE player_zone_progress (
     player_id   TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     zone_id     TEXT NOT NULL,
     unlocked_at TEXT NOT NULL,
     PRIMARY KEY (player_id, zone_id)
   )`,
];

const V1_DEVICE: readonly string[] = [
  // tech-04 §6.2 — one outbox, not one per write type: two drain loops can disagree about order.
  `CREATE TABLE outbox (
     client_op_id TEXT    PRIMARY KEY NOT NULL,
     kind         TEXT    NOT NULL,
     payload      TEXT    NOT NULL,
     created_at   TEXT    NOT NULL,
     attempts     INTEGER NOT NULL DEFAULT 0
   )`,

  // The id tie-break is not cosmetic — without a total order a drain cannot be resumed
  // deterministically after a crash, and two deltas can share a millisecond.
  `CREATE INDEX ix_outbox_fifo ON outbox (created_at, client_op_id)`,

  // tech-03 §8.1 — what has already been queued, never the observed total.
  `CREATE TABLE step_watermark (
     activity_date       TEXT PRIMARY KEY NOT NULL,
     reported_high_water INTEGER NOT NULL
   )`,

  // tech-03 §8.2 — same discipline, per (date, tier).
  `CREATE TABLE hr_minute_watermark (
     activity_date    TEXT    NOT NULL,
     tier             INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
     reported_minutes INTEGER NOT NULL,
     PRIMARY KEY (activity_date, tier)
   )`,

  // tech-03 §6.1 — this ledger exists to freeze `started_at`. The id is "hr:{started_at}", so a
  // late-syncing watch that shifts the start would mint a second id for one workout.
  `CREATE TABLE hr_session_ledger (
     session_id      TEXT PRIMARY KEY NOT NULL,
     started_at      TEXT NOT NULL,
     ended_at        TEXT NOT NULL,
     -- tech-03 §6.2 — on merge the earlier id wins; the later is tombstoned and never re-sent.
     tombstoned_into TEXT REFERENCES hr_session_ledger(session_id)
   )`,

  // tech-03 §4.1 / §8.4 — the end instant of the last successfully-consumed read. One row.
  `CREATE TABLE read_watermark (
     one_row         INTEGER PRIMARY KEY CHECK (one_row = 1),
     consumed_through TEXT NOT NULL
   )`,
];

/**
 * Version 2 — tech-04 §8.4's provisional flag: the player row holds an optimistic projection, which
 * a sync response replaces and clears. Separate migration per rule 1, not folded into V1.
 *
 * One flag rather than one per column — the projection is written and replaced as a set.
 */
const V2_PROVISIONAL: readonly string[] = [
  'ALTER TABLE player ADD COLUMN provisional INTEGER NOT NULL DEFAULT 0',
];

/**
 * Version 3 — the content bundle (T4 §5.1), as tables mirroring tech-01 §3 one-for-one.
 *
 * Read-only after the write that lands them: the whole set is replaced in one transaction when the
 * server's `content_version` moves, and nothing else ever writes here. That is why there are no
 * `player_id` columns, no timestamps, and no indexes beyond the primary keys — every read is either
 * by key or a full table scan of a few dozen rows.
 *
 * ↯ No foreign keys **between** content tables, unlike the server's schema. `PRAGMA foreign_keys`
 * is ON (`open.ts`), so a delete-then-insert replacement would have to order 16 tables by
 * dependency in both directions, and one wrong step fails the swap on a device with no recovery
 * path but reinstalling. The bundle arrives whole and consistent or not at all; the references are
 * already proven by the server's constraints and by the seed tests before it is ever served.
 *
 * Decimals are TEXT, matching the wire (tech-02 §2) and `player_settings`'s volumes — parsed at the
 * point of use, never stored as SQLite REALs.
 */
const V3_CONTENT: readonly string[] = [
  // One row, mirroring `content_version`. Its absence is what makes a bundle "not yet loaded".
  `CREATE TABLE content_version (
     one_row      INTEGER PRIMARY KEY CHECK (one_row = 1),
     version      INTEGER NOT NULL,
     generated_at TEXT    NOT NULL
   )`,

  `CREATE TABLE game_type (
     id            TEXT PRIMARY KEY NOT NULL,
     display_name  TEXT NOT NULL,
     cycle_ordinal INTEGER NOT NULL
   )`,

  `CREATE TABLE type_effectiveness (
     attacker_type_id TEXT NOT NULL,
     defender_type_id TEXT NOT NULL,
     multiplier       TEXT NOT NULL,
     PRIMARY KEY (attacker_type_id, defender_type_id)
   )`,

  `CREATE TABLE zone (
     id           TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     ordinal      INTEGER NOT NULL,
     is_released  INTEGER NOT NULL
   )`,

  `CREATE TABLE zone_gate (
     id               TEXT PRIMARY KEY NOT NULL,
     zone_id          TEXT NOT NULL,
     enemy_id         TEXT NOT NULL,
     gate_kind        TEXT NOT NULL,
     league_threshold INTEGER NOT NULL,
     unlocks_zone_id  TEXT,
     is_hard_gate     INTEGER NOT NULL
   )`,

  // zone_id and type_id are null for enemy_waystone_wisp, which belongs to no zone and has no type.
  `CREATE TABLE enemy (
     id           TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     zone_id      TEXT,
     type_id      TEXT,
     role         TEXT NOT NULL
   )`,

  `CREATE TABLE enemy_stat_scaling (
     enemy_id TEXT NOT NULL,
     stat     TEXT NOT NULL,
     base     TEXT NOT NULL,
     rate     TEXT NOT NULL,
     PRIMARY KEY (enemy_id, stat)
   )`,

  // type_id is null for Physical moves, which never take a multiplier in either direction (T5 §3.3).
  `CREATE TABLE enemy_move (
     id           TEXT PRIMARY KEY NOT NULL,
     enemy_id     TEXT NOT NULL,
     display_name TEXT NOT NULL,
     category     TEXT NOT NULL,
     type_id      TEXT,
     power        INTEGER NOT NULL,
     ai_weight    INTEGER NOT NULL
   )`,

  `CREATE TABLE enemy_drop_pool (
     enemy_id       TEXT NOT NULL,
     encounter_kind TEXT NOT NULL,
     item_def_id    TEXT NOT NULL,
     weight         INTEGER NOT NULL,
     PRIMARY KEY (enemy_id, encounter_kind, item_def_id)
   )`,

  `CREATE TABLE player_skill_def (
     id           TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     category     TEXT NOT NULL,
     type_id      TEXT,
     power        INTEGER NOT NULL,
     uses         INTEGER,
     unlock_level INTEGER NOT NULL
   )`,

  `CREATE TABLE gear_move (
     id           TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     type_id      TEXT NOT NULL,
     power        INTEGER NOT NULL,
     uses         INTEGER NOT NULL,
     effect       TEXT
   )`,

  `CREATE TABLE gear_def (
     id             TEXT PRIMARY KEY NOT NULL,
     display_name   TEXT NOT NULL,
     slot           TEXT NOT NULL,
     tier           TEXT NOT NULL,
     zone_id        TEXT,
     grants_move_id TEXT,
     flavor         TEXT
   )`,

  `CREATE TABLE gear_tier_bonus (
     tier          TEXT PRIMARY KEY NOT NULL,
     rate          TEXT NOT NULL,
     flat          INTEGER NOT NULL,
     trinket_split TEXT NOT NULL
   )`,

  `CREATE TABLE item_def (
     id           TEXT PRIMARY KEY NOT NULL,
     display_name TEXT NOT NULL,
     category     TEXT NOT NULL,
     rarity       TEXT NOT NULL,
     type_id      TEXT,
     heal_pct     INTEGER,
     effect       TEXT,
     max_stack    INTEGER NOT NULL,
     battle_only  INTEGER NOT NULL,
     flavor       TEXT NOT NULL
   )`,

  `CREATE TABLE drop_rate (
     encounter_kind TEXT NOT NULL,
     reward_kind    TEXT NOT NULL,
     chance         TEXT NOT NULL,
     qty_min        INTEGER NOT NULL,
     qty_max        INTEGER NOT NULL,
     tier           TEXT,
     PRIMARY KEY (encounter_kind, reward_kind)
   )`,

  `CREATE TABLE level_milestone (
     level       INTEGER NOT NULL,
     reward_kind TEXT NOT NULL,
     item_def_id TEXT,
     gear_tier   TEXT,
     PRIMARY KEY (level, reward_kind)
   )`,

  `CREATE TABLE streak_milestone (
     day  INTEGER PRIMARY KEY NOT NULL,
     slot TEXT NOT NULL,
     tier TEXT NOT NULL
   )`,

  // xp_to_next is null at level 60 — the curve's terminus, not a missing row (GDD 1 §4).
  `CREATE TABLE xp_curve (
     level      INTEGER PRIMARY KEY NOT NULL,
     xp_to_next INTEGER,
     cumulative INTEGER NOT NULL
   )`,
];

/**
 * Version 4 — `ordinal` on the two content tables whose row order is load-bearing (T5 §5, amended
 * 2026-08-17). Both weighted scans — enemy move selection and the drop pool — run in the GDD's own
 * table order, which the primary key does not encode: Cerberus's key order puts Death Breath first,
 * and the cumulative boundaries T5 §11.6 pins only hold for the GDD's order.
 *
 * Defaulted to 0 rather than backfilled. A device on the old bundle has every row at ordinal 0 until
 * its next sync, which sorts them by the SQLite scan order — but `content_version` moved with this
 * change, so that device fetches the new bundle on its next foreground and replaces the whole set
 * before a battle can read it.
 */
const V4_CONTENT_ORDINALS: readonly string[] = [
  'ALTER TABLE enemy_move ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE enemy_drop_pool ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 0',
];

/**
 * Version 5 — what a battle reads and writes: the durable snapshot slot (T4 §5.3), the satchel, and
 * the bestiary counters.
 *
 * ↯ **The sync response carries none of these three back** (T2 §4's response block). They are not
 * cached server state — they are the local half of a ledger the server keeps in step from the same
 * battle payload, and the `client_battle_id` idempotency key is what makes both halves move exactly
 * once. Nothing here is reconciled on sync, so nothing here may be written by anything other than a
 * settled battle or a grant that also enters the outbox.
 */
const V5_BATTLE: readonly string[] = [
  // Device-only, so no `player_id`: at most one row, replaced after every resolved turn and deleted
  // in the transaction that queues the battle (T5 §8).
  `CREATE TABLE battle_snapshot (
     one_row          INTEGER PRIMARY KEY CHECK (one_row = 1),
     client_battle_id TEXT NOT NULL,
     snapshot         TEXT NOT NULL,
     updated_at       TEXT NOT NULL
   )`,

  // One row per held item, not a stack count — `items_consumed` in the battle payload names
  // individual `player_item_id`s (T5 §10.3), which a quantity column could not supply.
  `CREATE TABLE player_item (
     id          TEXT NOT NULL PRIMARY KEY,
     player_id   TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     item_def_id TEXT NOT NULL,
     acquired_at TEXT NOT NULL
   )`,

  `CREATE TABLE player_bestiary (
     player_id       TEXT    NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     enemy_id        TEXT    NOT NULL,
     encounter_count INTEGER NOT NULL DEFAULT 0,
     defeat_count    INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (player_id, enemy_id)
   )`,
];

/**
 * Version 6 — owned gear (tech-01 §4), which arrives with GDD 10 §5.2's starter Blade.
 *
 * ↯ Unlike v5's three tables, `player_gear` and `player_item` **are** reconciled: the profile
 * response carries both lists whole, so a repair replaces them rather than merging. That is why the
 * ids here are the server's — the row is the same physical object on both tiers, and
 * `items_consumed` names it by that id.
 *
 * `bonus_primary` is stored, never recomputed (GDD 8 §3.2). Recomputing it from the tier and level
 * would be wrong by design the moment a rebalance changes the rate.
 */
const V6_GEAR: readonly string[] = [
  `CREATE TABLE player_gear (
     id             TEXT    NOT NULL PRIMARY KEY,
     player_id      TEXT    NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     gear_def_id    TEXT    NOT NULL,
     equipped_slot  TEXT,
     level_at_drop  INTEGER NOT NULL,
     bonus_primary  INTEGER NOT NULL,
     bonus_secondary INTEGER,
     acquired_at    TEXT    NOT NULL
   )`,

  // One equipped piece per slot, in the schema rather than in a function (tech-01 §4). A partial
  // index, so the many unequipped rows do not collide with each other on a NULL slot.
  `CREATE UNIQUE INDEX ux_player_gear_slot
     ON player_gear (player_id, equipped_slot)
     WHERE equipped_slot IS NOT NULL`,
];

/**
 * Version 7 — `vigor_anchor_at` (GDD 2 §6), the instant `vigor_current` was last set. Recovery is
 * derived from it on read; nothing accumulates and nothing ticks (T4 §7.2).
 *
 * Nullable rather than defaulted: a device that has not synced since this migration has no anchor,
 * and no anchor means no regen. Defaulting to the migration's own instant would hand every existing
 * device a bar that starts filling from whenever it happened to upgrade.
 */
const V7_VIGOR_ANCHOR: readonly string[] = [
  'ALTER TABLE player ADD COLUMN vigor_anchor_at TEXT',

  // GDD 11 §3.1's tag, mirrored from `ActivityDayResponse` like every other column here. Written
  // locally first by the tag itself, then reconciled — a restore keeps the player's rest days.
  'ALTER TABLE activity_day ADD COLUMN rest_tagged_at TEXT',
];

/**
 * Version 8 — the encounter grants sync issues (T2 §1.3, GDD 9 §5).
 *
 * ↯ **Durable because sync reports each grant exactly once.** The server charges it against the
 * day's cap the moment it is issued, so a grant this device fails to store is an encounter the
 * player walked for and can never be handed again. "Spent" stays derived server-side — a battle
 * row naming the grant — so nothing here records it.
 */
const V8_ENCOUNTER_GRANT: readonly string[] = [
  `CREATE TABLE encounter_grant (
     grant_id      TEXT PRIMARY KEY NOT NULL,
     player_id     TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     zone_id       TEXT NOT NULL,
     enemy_id      TEXT NOT NULL,
     source        TEXT NOT NULL,
     activity_date TEXT NOT NULL
   )`,
];

/**
 * Version 9 — the chosen skill loadout (GDD 2 §5, T1 `player_equipped_skill`).
 *
 * Holds a `player_skill_def` or a `gear_move` id (GDD 3 §4.1), so no foreign key to either. Empty
 * until the player chooses; `loadoutFor` fills unchosen slots.
 */
const V9_EQUIPPED_SKILL: readonly string[] = [
  `CREATE TABLE equipped_skill (
     player_id TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     slot      INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 4),
     skill_id  TEXT NOT NULL,
     PRIMARY KEY (player_id, slot),
     UNIQUE (player_id, skill_id)
   )`,
];

/**
 * Version 10 — step 10's rewards the player has not seen yet (device-only, tech-04 §6.2).
 *
 * A daily-goal item waits here until Items is viewed (GDD 13 §5.2's road find); every other reward
 * waits until its Reveal Card is dismissed (§6.3). Sync arrives while any screen is open, so the
 * queue is durable rather than session state.
 */
const V10_FRESH_REWARD: readonly string[] = [
  `CREATE TABLE fresh_reward (
     id     TEXT PRIMARY KEY NOT NULL,
     kind   TEXT NOT NULL,
     def_id TEXT NOT NULL,
     source TEXT NOT NULL
   )`,
];

/**
 * Version 11 — step 10's rewards parked past a cap (T1 `pending_reward`), mirrored whole from every
 * sync response so the keep/discard prompt can open with the API off (GDD 4 §5.2).
 */
const V11_PENDING_REWARD: readonly string[] = [
  `CREATE TABLE pending_reward (
     id              TEXT PRIMARY KEY NOT NULL,
     kind            TEXT NOT NULL,
     def_id          TEXT NOT NULL,
     level_at_drop   INTEGER,
     bonus_primary   INTEGER,
     bonus_secondary INTEGER,
     created_at      TEXT NOT NULL
   )`,
];

/** Version 12 — GDD 12's lore, carried on the content rows it describes (T1, amended at M5/P5). */
const V12_LORE: readonly string[] = [
  'ALTER TABLE enemy ADD COLUMN flavor TEXT',
  'ALTER TABLE enemy ADD COLUMN intro TEXT',
  'ALTER TABLE enemy ADD COLUMN defeat_first TEXT',
  'ALTER TABLE enemy ADD COLUMN defeat_repeat TEXT',
  // A JSON array of strings, one per screen.
  'ALTER TABLE zone ADD COLUMN entry_narrative TEXT',
];

/**
 * Version 13 — the one-time screens already shown (GDD 10 §7.2, GDD 13 §6.4). Device-only, and keyed
 * to the player so a restore onto this device starts them fresh.
 */
const V13_SEEN_SCREEN: readonly string[] = [
  `CREATE TABLE seen_screen (
     player_id TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     id        TEXT NOT NULL,
     seen_at   TEXT NOT NULL,
     PRIMARY KEY (player_id, id)
   )`,
];

/** Version 14 — GDD 13 §7's Mute All, mirrored like the two volumes beside it. */
const V14_AUDIO_MUTED: readonly string[] = [
  'ALTER TABLE player_settings ADD COLUMN audio_muted INTEGER NOT NULL DEFAULT 0',
];

/** Version 15 — GDD 13 §3.1's figure choice, mirrored like the other synced settings. */
const V15_AVATAR_FIGURE: readonly string[] = [
  "ALTER TABLE player_settings ADD COLUMN avatar_figure TEXT NOT NULL DEFAULT 'male'",
];

/**
 * Version 16 — the Leagues the Waymarker was last shown at, so the Road walks it forward from there
 * (GDD 9 §5, GDD 14 §3.8). Device-only, like `seen_screen`.
 */
const V16_WAYMARKER_SEEN: readonly string[] = [
  `CREATE TABLE waymarker_seen (
     player_id TEXT PRIMARY KEY REFERENCES player(id) ON DELETE CASCADE,
     leagues   INTEGER NOT NULL
   )`,
];

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, statements: [...V1_MIRROR, ...V1_DEVICE] },
  { version: 2, statements: [...V2_PROVISIONAL] },
  { version: 3, statements: [...V3_CONTENT] },
  { version: 4, statements: [...V4_CONTENT_ORDINALS] },
  { version: 5, statements: [...V5_BATTLE] },
  { version: 6, statements: [...V6_GEAR] },
  { version: 7, statements: [...V7_VIGOR_ANCHOR] },
  { version: 8, statements: [...V8_ENCOUNTER_GRANT] },
  { version: 9, statements: [...V9_EQUIPPED_SKILL] },
  { version: 10, statements: [...V10_FRESH_REWARD] },
  { version: 11, statements: [...V11_PENDING_REWARD] },
  { version: 12, statements: [...V12_LORE] },
  { version: 13, statements: [...V13_SEEN_SCREEN] },
  { version: 14, statements: [...V14_AUDIO_MUTED] },
  { version: 15, statements: [...V15_AVATAR_FIGURE] },
  { version: 16, statements: [...V16_WAYMARKER_SEEN] },
];

/** The version a fully-migrated database reports. */
export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

export function currentVersion(db: SqliteDatabase): number {
  return db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/**
 * Applies every migration newer than the database's current version, each in its own transaction,
 * and returns the version arrived at. Called at boot **before anything reads** (tech-04 §6.3).
 */
export function runMigrations(db: SqliteDatabase): number {
  const from = currentVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) {
      continue;
    }

    transact(db, () => {
      for (const statement of migration.statements) {
        db.execSync(statement);
      }

      // Interpolated, not bound — PRAGMA takes no parameters. The one concatenated SQL in the
      // app; the value is a number literal from the array above, never external input.
      //
      // Inside the transaction: `user_version` lives in the header and participates, so a crash
      // between the DDL and the bump rolls back both.
      db.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  return currentVersion(db);
}
