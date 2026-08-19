import { readEquippedGear, readSatchel } from '../../battle/mirror';
import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { parseProfile } from '../dto';
import { writeProfile } from '../mirror';
import { WIRE_BLADE, wireProfile, wireSalve } from './fixtures';

/**
 * The satchel and the gear rack, mirrored from the authoritative document (T2 §4's response, §3's
 * repair path, and registration — all the same write).
 *
 * ↯ The ids are the **server's**, and carrying them is the whole reason these two lists are on the
 * wire at all: `items_consumed` names a `player_item.id`, so a client that minted its own would
 * name rows the server never had and every consumption would delete nothing (T5 §10.3).
 */
const profile = (overrides: Record<string, unknown> = {}) =>
  parseProfile(wireProfile(overrides), 'response');

describe('writing the inventory', () => {
  it('stores the server ids verbatim', () => {
    const db = memoryDatabase();

    writeProfile(db, profile());

    expect(readSatchel(db).map((item) => item.playerItemId)).toEqual([
      wireSalve(1).id,
      wireSalve(2).id,
      wireSalve(3).id,
    ]);
  });

  /** One row per physical item (GDD 4 §5.1) — three Salves are three rows, not a quantity of three. */
  it('keeps three Salves as three separately spendable rows', () => {
    const db = memoryDatabase();

    writeProfile(db, profile());

    const satchel = readSatchel(db);

    expect(satchel).toHaveLength(3);
    expect(new Set(satchel.map((item) => item.playerItemId)).size).toBe(3);
  });

  it('stores the frozen bonus rather than re-deriving it', () => {
    const db = memoryDatabase();

    writeProfile(db, profile());

    expect(readEquippedGear(db)).toEqual([{ equippedSlot: 'weapon', bonusPrimary: 1 }]);
  });

  /**
   * ↯ **Replace, not merge** — the mirror mirrors. The lists arrive whole, so a row the server no
   * longer has is a row this device must lose: a Salve spent on another install, or gear discarded.
   * Merging would resurrect it, and the resurrected id would then be sent in `items_consumed` for a
   * row that no longer exists anywhere.
   */
  it('drops rows the server no longer has', () => {
    const db = memoryDatabase();

    writeProfile(db, profile());
    writeProfile(db, profile({ items: [wireSalve(1)] }));

    expect(readSatchel(db).map((item) => item.playerItemId)).toEqual([wireSalve(1).id]);
  });

  /**
   * The equipped-slot index is unique, so re-writing the same weapon has to clear the old row first.
   * A repair that ran twice would otherwise fail on the second write, on a device, at boot.
   */
  it('rewrites the same equipped weapon without tripping the one-per-slot index', () => {
    const db = memoryDatabase();

    writeProfile(db, profile());

    expect(() => writeProfile(db, profile())).not.toThrow();
    expect(readEquippedGear(db)).toHaveLength(1);
  });

  it('refuses two pieces claiming the same slot', () => {
    const db = memoryDatabase();

    expect(() =>
      writeProfile(
        db,
        profile({ gear: [WIRE_BLADE, { ...WIRE_BLADE, id: '018f3a9c-0000-7000-8000-00000000a002' }] }),
      ),
    ).toThrow();
  });

  it('accepts a profile carrying nothing at all', () => {
    const db = memoryDatabase();

    writeProfile(db, profile({ gear: [], items: [] }));

    expect(readSatchel(db)).toEqual([]);
    expect(readEquippedGear(db)).toEqual([]);
  });
});
