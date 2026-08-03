import { registeredDatabase, wirePlayer, wireSyncResponse } from '../../sync/__tests__/fixtures';
import { parseSyncResponse } from '../../sync/dto';
import { applySyncResponse, writeProjection } from '../../sync/mirror';
import { EMPTY_PLAYER, usePlayerStore } from '../playerStore';

/**
 * tech-04 §5.2 — the store is a **cache of a cache**, and may be stale in exactly one direction.
 * These tests are about that direction: every one of them writes SQLite and then reads the store.
 */

beforeEach(() => {
  usePlayerStore.getState().reset();
});

describe('hydration', () => {
  it('reads the mirror into the hot slice', () => {
    const db = registeredDatabase();

    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState()).toMatchObject({
      registered: true,
      traverserName: 'Traverser',
      level: 11,
      xpCurrent: 400,
      xpToNext: 1240,
      lifetimeSteps: 205_000,
      leagues: 205,
      provisional: false,
    });
  });

  it('derives Leagues rather than storing them', () => {
    const db = registeredDatabase({ lifetime_steps: 219_200 });

    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState().leagues).toBe(219);
  });

  /** ↯ The first-launch signal the router reads — an empty mirror is a device that never registered. */
  it('reports an unregistered device rather than inventing a player', () => {
    const db = registeredDatabase();

    db.runSync('DELETE FROM player', []);
    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState()).toMatchObject({ registered: false, level: 1 });
  });

  it('carries the streak through', () => {
    const db = registeredDatabase();

    applySyncResponse(
      db,
      parseSyncResponse(
        wireSyncResponse({ streak: { current: 9, longest: 22, last_credited_date: '2026-08-03' } }),
      ),
    );
    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState().streak).toEqual({
      current: 9,
      longest: 22,
      lastCreditedDate: '2026-08-03',
    });
  });

  it('keeps xpToNext null at Level 60 so the bar can render MAX', () => {
    const db = registeredDatabase({ level: 60, xp_to_next: null });

    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState().xpToNext).toBeNull();
  });
});

describe('projections and corrections', () => {
  it('shows a projection, then the server value that replaces it', () => {
    const db = registeredDatabase({ xp_current: 400, lifetime_steps: 205_000 });

    writeProjection(db, { xpCurrent: 800, xpLifetime: 12_800, lifetimeSteps: 213_000 });
    usePlayerStore.getState().hydrate(db);

    expect(usePlayerStore.getState()).toMatchObject({
      xpCurrent: 800,
      leagues: 213,
      provisional: true,
    });

    applySyncResponse(
      db,
      parseSyncResponse(
        wireSyncResponse({ player: wirePlayer({ xp_current: 795, lifetime_steps: 213_000 }) }),
      ),
    );
    usePlayerStore.getState().hydrate(db);

    // ↯ Down from 800 to 795, and the slice carries no indicator of that having happened. tech-04
    // §8.4: a correction that reduces a displayed number is applied with no annotation whatsoever.
    expect(usePlayerStore.getState()).toMatchObject({ xpCurrent: 795, provisional: false });
  });

  it('resets to the empty slice', () => {
    const db = registeredDatabase();

    usePlayerStore.getState().hydrate(db);
    usePlayerStore.getState().reset();

    expect(usePlayerStore.getState()).toMatchObject(EMPTY_PLAYER);
  });
});
