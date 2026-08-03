import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * The durable write queue (tech-02 §5, tech-04 §6.2).
 *
 * The contract T2 §5 fixes: an entry survives process death, entries drain FIFO, and an entry is
 * removed **only** after the server names its id in `accepted_delta_ids` or `duplicate_delta_ids`.
 * Both of those lists mean the same thing to this queue — stop resending — which is why
 * {@link acknowledge} takes them together.
 */
export type OutboxKind = 'sync_delta' | 'allocation' | 'settings';

export interface OutboxEntry {
  readonly clientOpId: string;
  readonly kind: OutboxKind;
  /** JSON. Parsed by the drain loop (P7), never by this module. */
  readonly payload: string;
  readonly createdAt: string;
  readonly attempts: number;
}

interface OutboxRow {
  client_op_id: string;
  kind: OutboxKind;
  payload: string;
  created_at: string;
  attempts: number;
}

const toEntry = (row: OutboxRow): OutboxEntry => ({
  clientOpId: row.client_op_id,
  kind: row.kind,
  payload: row.payload,
  createdAt: row.created_at,
  attempts: row.attempts,
});

/**
 * ↯ `client_op_id` is minted by the caller and **never regenerated on retry** (tech-02 §5) — it is
 * the server's idempotency key, so a fresh id on a resend is a double-credit. It must also never be
 * derived from the payload: two legitimately distinct deltas can be identical in value, and
 * tech-03 §8.1's high-water-mark scheme makes identical-value deltas *likely* rather than merely
 * possible, so a content-derived key would silently drop real steps.
 *
 * `INSERT OR IGNORE`, so enqueueing the same id twice is a no-op rather than a crash — the caller
 * that re-enqueues after an ambiguous failure is doing the right thing.
 */
export function enqueue(
  db: SqliteDatabase,
  entry: { clientOpId: string; kind: OutboxKind; payload: unknown; createdAt: string },
): void {
  db.runSync(
    `INSERT OR IGNORE INTO outbox (client_op_id, kind, payload, created_at, attempts)
     VALUES (?, ?, ?, ?, 0)`,
    [entry.clientOpId, entry.kind, JSON.stringify(entry.payload), entry.createdAt],
  );
}

/**
 * Enqueues a batch in one transaction. Used by delta minting (P6), where the whole point of
 * tech-03 §8.4's ordering is that the deltas are durable *before* the watermark moves — a partially
 * written batch would leave the watermark describing activity that was never queued.
 */
export function enqueueAll(
  db: SqliteDatabase,
  entries: readonly { clientOpId: string; kind: OutboxKind; payload: unknown; createdAt: string }[],
): void {
  if (entries.length === 0) {
    return;
  }

  transact(db, () => {
    for (const entry of entries) {
      enqueue(db, entry);
    }
  });
}

/** The oldest `limit` entries, FIFO. Does not remove them — see {@link acknowledge}. */
export function peek(db: SqliteDatabase, limit: number): OutboxEntry[] {
  return db
    .getAllSync<OutboxRow>(
      `SELECT client_op_id, kind, payload, created_at, attempts
       FROM outbox
       ORDER BY created_at, client_op_id
       LIMIT ?`,
      [limit],
    )
    .map(toEntry);
}

export function count(db: SqliteDatabase): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')?.n ?? 0;
}

/**
 * Removes entries the server has accounted for.
 *
 * ↯ Called with `accepted ∪ duplicate` from the sync response, never with "everything we sent".
 * An entry the server did not name has not been accounted for and must survive to be resent — that
 * is the difference between at-least-once delivery and losing a day's steps to a truncated response.
 */
export function acknowledge(db: SqliteDatabase, clientOpIds: readonly string[]): number {
  if (clientOpIds.length === 0) {
    return 0;
  }

  let removed = 0;

  transact(db, () => {
    for (const id of clientOpIds) {
      removed += db.runSync('DELETE FROM outbox WHERE client_op_id = ?', [id]).changes;
    }
  });

  return removed;
}

/**
 * Records a failed drain attempt. Nothing reads this to make a decision yet — tech-02 §5's backoff
 * is time-based and lives in the drain loop (P7) — but a queue that cannot say how many times it
 * has tried is a queue you cannot diagnose when it stops moving.
 */
export function recordAttempt(db: SqliteDatabase, clientOpIds: readonly string[]): void {
  if (clientOpIds.length === 0) {
    return;
  }

  transact(db, () => {
    for (const id of clientOpIds) {
      db.runSync('UPDATE outbox SET attempts = attempts + 1 WHERE client_op_id = ?', [id]);
    }
  });
}
