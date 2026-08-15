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

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, statements: [...V1_MIRROR, ...V1_DEVICE] },
  { version: 2, statements: [...V2_PROVISIONAL] },
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
