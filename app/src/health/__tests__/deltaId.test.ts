import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { mintUuidV7 } from '../deltaId';

/**
 * tech-02 §5 / tech-03 §8.3 — the id that is the entire idempotency mechanism.
 *
 * Format matters beyond tidiness: the server parses this into a `Guid` and stores it in a Postgres
 * `uuid` column, and the ledger's `ON CONFLICT (player_id, client_delta_id)` is what stops a replayed
 * batch double-crediting a day. A malformed id fails at the API boundary; a colliding one fails
 * silently and takes real steps with it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const AT = Date.parse('2026-08-03T10:00:00.000Z');

describe('mintUuidV7', () => {
  it('produces a well-formed UUID with version 7 and the RFC variant', () => {
    const id = mintUuidV7(memoryDatabase(), AT);

    expect(id).toMatch(UUID);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
  });

  /** The 48-bit millisecond prefix is what makes v7 sort by mint time. */
  it('encodes the mint instant in the leading 48 bits', () => {
    const id = mintUuidV7(memoryDatabase(), AT);
    const timestamp = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);

    expect(timestamp).toBe(AT);
  });

  it('sorts by mint time', () => {
    const db = memoryDatabase();
    const earlier = mintUuidV7(db, AT);
    const later = mintUuidV7(db, AT + 1000);

    expect(earlier < later).toBe(true);
  });

  /**
   * ↯ The property the whole design rests on. Two deltas minted in the same millisecond with the
   * same value must still differ — the high-water scheme makes identical-value deltas likely, so
   * anything derived from content or from the clock alone would collide and drop a real delta.
   */
  it('never repeats, even minting in a tight loop at one instant', () => {
    const db = memoryDatabase();
    const ids = new Set(Array.from({ length: 2000 }, () => mintUuidV7(db, AT)));

    expect(ids.size).toBe(2000);
  });

  it('refuses an instant outside the 48-bit range rather than truncating it', () => {
    expect(() => mintUuidV7(memoryDatabase(), 2 ** 48)).toThrow(/48-bit/);
    expect(() => mintUuidV7(memoryDatabase(), -1)).toThrow(/48-bit/);
  });
});
