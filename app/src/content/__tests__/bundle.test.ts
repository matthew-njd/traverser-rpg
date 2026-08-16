import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { SPRITES } from '../../assets/registry.generated';
import { parseBundle, readContentRows, readContentVersion } from '../bundle';
import { EMBEDDED_BUNDLE } from '../embedded.generated';
import { adoptBundle, seedEmbeddedContent } from '../store';
import { CONTENT_TABLES, CONTENT_TABLE_NAMES } from '../schema';

/**
 * The content bundle (T4 §5.1).
 *
 * Deliberately not a second copy of the seed tests: the API suite already asserts the rows against
 * `traverser-test-fixtures.md`, and the served payload against the rows. What is unproven on this
 * side is the round trip — that what the server sends survives parsing, storage and a read back
 * unchanged — and the negotiation rule.
 */

const bundle = parseBundle(EMBEDDED_BUNDLE);

const ids = (table: keyof typeof CONTENT_TABLES, column: string) =>
  new Set(bundle.tables[table].map((row) => row[column]));

describe('the embedded bundle', () => {
  it('parses, and carries every table', () => {
    expect(bundle.contentVersion).toBeGreaterThan(0);

    for (const table of CONTENT_TABLE_NAMES) {
      expect(bundle.tables[table].length).toBeGreaterThan(0);
    }
  });

  it('is stored whole and reads back row for row', () => {
    const db = memoryDatabase();

    expect(seedEmbeddedContent(db)).toBe(bundle.contentVersion);
    expect(readContentVersion(db)).toBe(bundle.contentVersion);

    for (const table of CONTENT_TABLE_NAMES) {
      const stored = readContentRows(db, table);

      expect(stored.length).toBe(bundle.tables[table].length);
    }
  });

  /**
   * Booleans and decimals are where a round trip actually loses something: SQLite has no boolean,
   * and a decimal stored as a REAL would come back 0.5 instead of "0.50".
   */
  it('keeps decimals as strings and booleans as 0/1 through storage', () => {
    const db = memoryDatabase();

    seedEmbeddedContent(db);

    const chart = readContentRows(db, 'type_effectiveness');

    expect(chart.every((row) => typeof row.multiplier === 'string')).toBe(true);
    expect(chart.map((row) => row.multiplier)).toContain('0.50');

    const zones = readContentRows(db, 'zone');

    expect(zones.map((row) => row.is_released).sort()).toEqual([0, 1, 1, 1]);
  });

  /** A payload that stopped honouring tech-02 §2 must fail loudly, not silently lose precision. */
  it('rejects a decimal that arrives as a JSON number', () => {
    expect(() =>
      parseBundle({
        ...EMBEDDED_BUNDLE,
        type_effectiveness: [
          { attacker_type_id: 'storm', defender_type_id: 'war', multiplier: 2 },
        ],
      }),
    ).toThrow(/multiplier/);
  });

  it('rejects a table that arrived empty', () => {
    expect(() => parseBundle({ ...EMBEDDED_BUNDLE, enemies: [] })).toThrow(/enemies/);
  });
});

describe('version negotiation', () => {
  it('adopts a newer bundle and ignores an older one', () => {
    const db = memoryDatabase();

    seedEmbeddedContent(db);

    const newer = parseBundle({
      ...EMBEDDED_BUNDLE,
      content_version: bundle.contentVersion + 1,
      zones: [{ id: 'olympion', display_name: 'Renamed', ordinal: 0, is_released: true }],
    });

    expect(adoptBundle(db, newer)).toBe(bundle.contentVersion + 1);
    expect(readContentRows(db, 'zone')).toHaveLength(1);

    // Same version and older are both refused — an API rolled back to an earlier seed must not
    // overwrite content the device already holds.
    expect(adoptBundle(db, parseBundle(EMBEDDED_BUNDLE))).toBe(bundle.contentVersion + 1);
    expect(adoptBundle(db, newer)).toBe(bundle.contentVersion + 1);
    expect(readContentRows(db, 'zone')).toHaveLength(1);
  });

  /** Replacement, not merge: a row dropped by a content release must not survive the upgrade. */
  it('replaces the whole set rather than merging into it', () => {
    const db = memoryDatabase();

    seedEmbeddedContent(db);

    const before = readContentRows(db, 'enemy').length;

    adoptBundle(
      db,
      parseBundle({
        ...EMBEDDED_BUNDLE,
        content_version: bundle.contentVersion + 1,
        enemies: [EMBEDDED_BUNDLE.enemies[0]],
      }),
    );

    expect(before).toBeGreaterThan(1);
    expect(readContentRows(db, 'enemy')).toHaveLength(1);
  });
});

describe('what the bundle references', () => {
  /**
   * The client half of "every ID resolves". The API's seed tests check the rows against the
   * manifest; this checks that the art registry knows the same IDs — a content ID with no sprite
   * renders as a missing image on the battle screen and nowhere else.
   */
  it('has a sprite for every enemy, item and gear id', () => {
    const registered = new Set(Object.keys(SPRITES));

    for (const table of ['enemy', 'item_def', 'gear_def'] as const) {
      for (const row of bundle.tables[table]) {
        expect(registered.has(String(row.id))).toBe(true);
      }
    }
  });

  /**
   * There are no foreign keys between the content tables on the device (migration V3), so the
   * references are checked here instead of by SQLite. A dangling `type_id` is a battle that cannot
   * look up its own multiplier.
   */
  it('resolves every reference within itself', () => {
    const types = ids('game_type', 'id');
    const zones = ids('zone', 'id');
    const enemies = ids('enemy', 'id');
    const items = ids('item_def', 'id');
    const gearMoves = ids('gear_move', 'id');

    const resolves = (
      table: keyof typeof CONTENT_TABLES,
      column: string,
      target: Set<unknown>,
    ) => {
      for (const row of bundle.tables[table]) {
        if (row[column] !== null) {
          expect({ table, column, value: row[column], known: true }).toEqual({
            table,
            column,
            value: row[column],
            known: target.has(row[column]),
          });
        }
      }
    };

    resolves('type_effectiveness', 'attacker_type_id', types);
    resolves('type_effectiveness', 'defender_type_id', types);
    resolves('enemy', 'zone_id', zones);
    resolves('enemy', 'type_id', types);
    resolves('enemy_move', 'enemy_id', enemies);
    resolves('enemy_move', 'type_id', types);
    resolves('enemy_stat_scaling', 'enemy_id', enemies);
    resolves('enemy_drop_pool', 'enemy_id', enemies);
    resolves('enemy_drop_pool', 'item_def_id', items);
    resolves('player_skill_def', 'type_id', types);
    resolves('gear_move', 'type_id', types);
    resolves('gear_def', 'zone_id', zones);
    resolves('gear_def', 'grants_move_id', gearMoves);
    resolves('item_def', 'type_id', types);
    resolves('level_milestone', 'item_def_id', items);
    resolves('zone_gate', 'zone_id', zones);
    resolves('zone_gate', 'enemy_id', enemies);
    resolves('zone_gate', 'unlocks_zone_id', zones);
  });
});
