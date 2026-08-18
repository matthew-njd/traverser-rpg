import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * The durable write queue (tech-02 §5, tech-04 §6.2).
 *
 * Entries survive process death, drain FIFO, and are removed only once the server names the id in
 * `accepted_delta_ids` or `duplicate_delta_ids` — both mean "stop resending" to this queue.
 */
export type OutboxKind = 'sync_delta' | 'allocation' | 'settings' | 'battle';

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
 * `client_op_id` is the server's idempotency key (tech-02 §5): **never regenerated on retry**, or a
 * resend double-credits, and **never derived from the payload**, because two distinct deltas can be
 * identical in value and §8.1's marks make that likely.
 *
 * `INSERT OR IGNORE` — re-enqueueing after an ambiguous failure is correct, not an error.
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
 * One transaction: a partially written batch would leave the watermark describing activity that was
 * never queued (tech-03 §8.4).
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

/**
 * The oldest `limit` entries, FIFO. Does not remove them — see {@link acknowledge}.
 *
 * One table for every kind (tech-04 §6.2), but kinds do not share an endpoint, so `kind` narrows
 * the drain rather than posting a mixed batch somewhere that understands part of it.
 */
export function peek(db: SqliteDatabase, limit: number, kind?: OutboxKind): OutboxEntry[] {
  const where = kind === undefined ? '' : 'WHERE kind = ?';
  const params = kind === undefined ? [limit] : [kind, limit];

  return db
    .getAllSync<OutboxRow>(
      `SELECT client_op_id, kind, payload, created_at, attempts
       FROM outbox
       ${where}
       ORDER BY created_at, client_op_id
       LIMIT ?`,
      params,
    )
    .map(toEntry);
}

export function count(db: SqliteDatabase): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')?.n ?? 0;
}

/**
 * Removes entries the server has accounted for.
 *
 * Called with `accepted ∪ duplicate`, never "everything we sent" — an entry the server did not name
 * must survive to be resent.
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

/** Records a failed drain attempt. Diagnostic only — nothing decides on it yet (tech-02 §5). */
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
