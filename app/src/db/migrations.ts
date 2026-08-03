import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * Forward-only schema migrations under `PRAGMA user_version` (tech-04 §6.3).
 *
 * ↯ There is no `dotnet ef database update` here and no migration runner you can re-run by hand.
 * The database is on a device you may not be holding, and **a migration that throws at boot is an
 * app that cannot start** — the only recovery is `adb uninstall`, which per tech-04 §6.5 destroys
 * `player_id`, the bearer token, and the whole mirror with no path back to the server-side profile.
 *
 * Rules, all of them load-bearing:
 *
 * 1. **Append only.** Never edit a shipped migration — a device that already applied version N will
 *    never see the edit, so the two devices diverge silently. Add N+1 instead.
 * 2. **No down-migrations.** A rollback in dev is an uninstall.
 * 3. **The `user_version` bump lives inside the same transaction as the DDL.** That is what makes a
 *    crash mid-apply safe to re-run: either both landed or neither did. SQLite keeps
 *    `user_version` in the database header and it is fully transactional, so a rollback takes the
 *    version with it.
 */
export interface Migration {
  readonly version: number;
  readonly statements: readonly string[];
}

/**
 * Version 1 — the M1 schema.
 *
 * Mirror tables are the M1 subset of tech-01 §4, named exactly as the server names them so a sync
 * response maps column-for-column with no translation layer (tech-02 §2). Content tables (tech-01
 * §3) are deliberately absent: M1 plan decision §3.2 defers the content bundle to M2, and M1's
 * client reads no seeded content at all.
 */
const V1_MIRROR: readonly string[] = [
  // ↯ `one_row` rather than a bare uuid primary key. On the server `player` is keyed by uuid because
  // it will one day hold many; on a device there is exactly one, forever (tech-04 §6.5), and a
  // second row would be a silently split mirror rather than a visible error. `id` stays UNIQUE so
  // the child tables' foreign keys still target it.
  `CREATE TABLE player (
     one_row               INTEGER PRIMARY KEY CHECK (one_row = 1),
     id                    TEXT    NOT NULL UNIQUE,
     traverser_name        TEXT    NOT NULL,
     timezone              TEXT    NOT NULL,
     created_at            TEXT    NOT NULL,
     level                 INTEGER NOT NULL DEFAULT 1,
     xp_current            INTEGER NOT NULL DEFAULT 0,
     -- Mirrored from the server's snapshot rather than derived: the level curve is seeded
     -- server-side and M1 ships no content bundle, so the device has no curve to look it up in.
     -- Null at level 60, which is how the XP bar knows to render MAX (GDD 1 §4).
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
     -- Stored as text, matching the wire (tech-02 §2 — decimal strings, never floats). SQLite has
     -- no exact decimal type and REAL would be the float this project spent a spec paragraph
     -- avoiding.
     music_volume        TEXT NOT NULL DEFAULT '1.00',
     sfx_volume          TEXT NOT NULL DEFAULT '1.00',
     -- Null means *not yet collected*, not "unknown age" (tech-03 §1.4). Tier minutes are not
     -- charged at all without it, which is correct behaviour rather than a silent default.
     birth_year          INTEGER
   )`,

  `CREATE TABLE activity_day (
     player_id            TEXT    NOT NULL REFERENCES player(id) ON DELETE CASCADE,
     -- Bare YYYY-MM-DD, the client's own local date. Never derived from an instant (tech-02 §2).
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
  // tech-04 §6.2 — **one** outbox, not one per write type. tech-02 §3's progression writes and §5's
  // activity deltas share the same durability, ordering and retry requirements, and splitting them
  // would mean two drain loops that can disagree about order.
  `CREATE TABLE outbox (
     client_op_id TEXT    PRIMARY KEY NOT NULL,
     kind         TEXT    NOT NULL,
     payload      TEXT    NOT NULL,
     created_at   TEXT    NOT NULL,
     attempts     INTEGER NOT NULL DEFAULT 0
   )`,

  // FIFO by created_at, tie-broken by the id. The tie-break is not cosmetic: two deltas minted in
  // the same millisecond would otherwise drain in whatever order SQLite happened to return, and a
  // drain that is not a total order cannot be resumed deterministically after a crash.
  `CREATE INDEX ix_outbox_fifo ON outbox (created_at, client_op_id)`,

  // tech-03 §8.1 — the per-date step high-water mark. What has already been handed to the queue,
  // never the observed total.
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

  // tech-03 §6.1 — the session ledger exists to **freeze `started_at`**. The session id is
  // "hr:{started_at epoch seconds}", so if the start moves the id moves: a watch syncing late would
  // shift the start, mint a second id, and the server would hold two sessions for one workout,
  // double-counting encounter rolls and re-arming the overactivity warning.
  `CREATE TABLE hr_session_ledger (
     session_id      TEXT PRIMARY KEY NOT NULL,
     started_at      TEXT NOT NULL,
     ended_at        TEXT NOT NULL,
     -- tech-03 §6.2's merge: when backfill closes the gap between two sessions the **earlier id
     -- wins**, and the later one is tombstoned locally and never sent again. The server keeps its
     -- orphaned row, which is inert once nothing references it — deleting server rows from the
     -- client is not a capability this protocol has.
     tombstoned_into TEXT REFERENCES hr_session_ledger(session_id)
   )`,

  // tech-03 §4.1 / §8.4 — the end instant of the last successfully-consumed read. One row.
  `CREATE TABLE read_watermark (
     one_row         INTEGER PRIMARY KEY CHECK (one_row = 1),
     consumed_through TEXT NOT NULL
   )`,
];

/**
 * Version 2 — tech-04 §8.4's provisional flag.
 *
 * ↯ Added as a second migration rather than folded into V1, per rule 1 above: V1 has already been
 * applied on this device, so an edit to it would never run and the two databases would diverge
 * silently. That is the whole discipline, and it starts costing something the first time it is
 * inconvenient.
 *
 * The flag says *the player row currently holds an optimistic projection* (§8.4). A sync response
 * replaces those values and clears it. It is one flag rather than one per column because the
 * projection is written as a set and replaced as a set — a half-provisional row is not a state this
 * design has.
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

      // ↯ Interpolated, not bound — PRAGMA does not accept bound parameters, and this is the one
      // place in the app where SQL is built by concatenation. The value is a number literal from
      // the array above and never touches anything a user or a server can influence.
      //
      // ↯ Inside the transaction, which is the entire crash-safety guarantee: SQLite keeps
      // `user_version` in the database header and it participates in the transaction, so a crash
      // between the DDL and the bump rolls back both and the next boot re-applies cleanly.
      db.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  return currentVersion(db);
}
