import type { SqliteDatabase } from '../db/types';

/**
 * UUIDv7 minting for `client_delta_id` (tech-02 §5, tech-03 §8.3).
 *
 * ↯ This id **is** the idempotency mechanism. It is minted once when the delta is created, persisted
 * with it, and never regenerated on retry — a fresh id on a resend double-credits a day. It must
 * also never be derived from the content: two legitimately distinct deltas can be identical in
 * value, and tech-03 §8.1's high-water-mark scheme makes identical-value deltas *likely* rather than
 * merely possible, so a content key would silently drop real steps.
 *
 * ↯ **Why the randomness comes from SQLite.** This runtime has no CSPRNG: React Native 0.86 ships no
 * `crypto.getRandomValues`, Expo SDK 57's runtime polyfills do not add one, and `expo-crypto` is a
 * native module whose install would cross tech-04 §3.2's rebuild boundary. SQLite's `randomblob()`
 * is seeded from the OS entropy pool — it is the source SQLite itself uses — so it is real
 * randomness available through a handle this module is already writing to inside the same
 * transaction. `Math.random` was the other no-dependency option and was rejected: Hermes'
 * implementation is a non-cryptographic PRNG, and "probably no collisions" is not a property to put
 * under the one key that stops steps being double-credited or dropped.
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

  // Layout per RFC 9562 §5.7: tttttttt-tttt-7rrr-vrrr-rrrrrrrrrrrr, where the version nibble is 7
  // and the variant nibble's top two bits are 10. Both are forced rather than drawn, so the id is a
  // well-formed v7 that Postgres' `uuid` column and the server's `Guid` parse identically.
  const variant = ((parseInt(random.charAt(3), 16) & 0b0011) | 0b1000).toString(16);

  return [
    timestamp.slice(0, 8),
    timestamp.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(7, 19),
  ].join('-');
}
