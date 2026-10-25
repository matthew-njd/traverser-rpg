import { seedEmbeddedContent } from '../../content/store';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { markSeen, pendingFirsts } from '../firsts';

const database = (level: number) => {
  const db = registeredDatabase({ level });

  seedEmbeddedContent(db);

  return db;
};

const ids = (db: ReturnType<typeof database>, moves: string[] = []) => pendingFirsts(db, moves).map((first) => first.id);

describe('the type screen (GDD 10 §7.2)', () => {
  it("waits for Thunderer's Wrath's level", () => {
    expect(ids(database(5))).toEqual([]);
    expect(ids(database(6))).toEqual(['type_intro']);
  });

  /** A player already past Level 6 when it shipped sees it once, on the next fight. */
  it('shows once, however far past Level 6 the player is', () => {
    const db = database(21);

    markSeen(db, ['type_intro'], Date.now());

    expect(ids(db)).toEqual([]);
  });
});

describe('the secondary-effect screen (GDD 13 §6.4)', () => {
  it('names the move and what its effect does', () => {
    const [first] = pendingFirsts(database(5), ['move_gatekeepers_snare']);

    expect(first?.text).toMatch(/^Gatekeeper's Snare carries Rend\./);
    expect(first?.text).toMatch(/150%/);
  });

  it('shows only for a move with an effect, and once per effect', () => {
    const db = database(5);

    expect(ids(db, ['move_gatekeepers_ruse', 'skill_basic_attack'])).toEqual([]);
    expect(ids(db, ['move_gatekeepers_snare', 'move_coilbreakers_wrath'])).toEqual(['effect_weaken', 'effect_rend']);

    markSeen(db, ['effect_rend'], Date.now());

    expect(ids(db, ['move_gatekeepers_snare'])).toEqual([]);
  });

  it('comes after the type screen when both are owed', () => {
    expect(ids(database(21), ['move_emberwise_verdict'])).toEqual(['type_intro', 'effect_fortify']);
  });
});
