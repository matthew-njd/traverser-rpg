import type { SqliteDatabase } from '../db/types';

/**
 * UUIDv7 minting for `client_delta_id` (tech-02 §5, tech-03 §8.3).
 *
 * This id **is** the idempotency mechanism: minted once, persisted with the delta, never
 * regenerated on retry, and never derived from content — §8.1's marks make identical-value deltas
 * likely, so a content key would silently drop real steps.
 *
 * ↯ The randomness comes from SQLite because this runtime has no CSPRNG: RN 0.86 ships no
 * `crypto.getRandomValues`, SDK 57's polyfills add none, and `expo-crypto` would cross tech-04
 * §3.2's rebuild boundary. `randomblob()` draws from the OS entropy pool. `Math.random` is a
 * non-cryptographic PRNG on Hermes and was rejected for the key that stops double-credit.
 */

/** 48 bits of millisecond timestamp, so the layout is good until the year 10889. */
const MAX_TIMESTAMP_MS = 2 ** 48 - 1;

/** 10 bytes = 20 hex characters; the layout needs 74 random bits and uses 76. */
const RANDOM_BYTES = 10;

export function mintUuidV7(db: SqliteDatabase, atMs: number): string {
  if (!Number.isInteger(atMs) || atMs < 0 || atMs > MAX_TIMESTAMP_MS) {
    throw new Error(`Cannot mint a UUIDv7 at ${atMs}: outside the 48-bit millisecond range.`);
  }

  const row = db.getFirstSync<{ bytes: string }>(`SELECT hex(randomblob(${RANDOM_BYTES})) AS bytes`);
  const random = row?.bytes.toLowerCase() ?? '';

  if (random.length !== RANDOM_BYTES * 2) {
    throw new Error('randomblob() returned no entropy; refusing to mint a delta id.');
  }

  const timestamp = atMs.toString(16).padStart(12, '0');

  // RFC 9562 §5.7: tttttttt-tttt-7rrr-vrrr-rrrrrrrrrrrr. Version and variant nibbles are forced,
  // not drawn, so Postgres' `uuid` and the server's `Guid` parse it identically.
  const variant = ((parseInt(random.charAt(3), 16) & 0b0011) | 0b1000).toString(16);

  return [
    timestamp.slice(0, 8),
    timestamp.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(7, 19),
  ].join('-');
}
