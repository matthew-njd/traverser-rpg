import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { enqueue, peek } from '../../db/outbox';
import { raiseStepHighWater, readWatermark, stepHighWater } from '../../db/watermarks';
import { ApiStatusError } from '../../sync/api';
import { readActivityDays, readBirthYear, readPlayer, readStreak } from '../../sync/mirror';
import {
  PLAYER_ID,
  registeredDatabase,
  wireActivityDay,
  wirePlayer,
  wireProfile,
  wireRegistration,
} from '../../sync/__tests__/fixtures';
import {
  RestoreError,
  deviceTimezone,
  handOverTo,
  isProfileReplaceable,
  parseIdentityDocument,
  registerNewPlayer,
  restoreIdentity,
} from '../registration';

/**
 * GDD 10 screen 4's terminal step and tech-06 §13.1's restore branch beside it.
 *
 * The whole file is about ordering — what is persisted before what. Registration is the one place
 * where a half-finished attempt has consequences that outlive the screen.
 */

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const NOW = Date.parse('2026-08-04T10:00:00Z');
const OPTIONS = { baseUrl: 'http://host/api/v1' };

/**
 * A fetch that answers per path, for the flows that now make more than one call. A `null` body
 * means "this endpoint fails" — the restore must survive a missing activity log.
 */
const routedFetch = (routes: Record<string, unknown>) =>
  jest.fn(async (url: string) => {
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((path) => url.includes(path));

    const body = match === undefined ? null : routes[match];

    return Promise.resolve({
      ok: body !== null,
      status: body === null ? 500 : 200,
      json: async () => Promise.resolve(body),
    } as Response);
  }) as unknown as typeof fetch;

const jsonFetch = (body: unknown, status = 200) =>
  jest.fn(async () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => Promise.resolve(body),
    } as Response),
  ) as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  jest.mocked((jest.requireMock('expo-secure-store') as { setItemAsync: jest.Mock }).setItemAsync).mockImplementation(
    async (key: string, value: string) => {
      mockStore.set(key, value);
    },
  );
});

describe('registering', () => {
  it('writes the mirror, the credential and the queued birth year', async () => {
    const db = memoryDatabase();
    const fetchImpl = jsonFetch(wireRegistration());

    const identity = await registerNewPlayer(
      db,
      { ...OPTIONS, fetchImpl },
      { traverserName: 'Matthew', birthYear: 1990 },
      NOW,
    );

    expect(identity.token).toBe('tok-from-server');
    expect(mockStore.get('traverser.bearer_token')).toBe('tok-from-server');

    expect(readPlayer(db)).toMatchObject({ playerId: PLAYER_ID, level: 11 });
    expect(readStreak(db)).toMatchObject({ current: 8 });
    expect(readBirthYear(db)).toBe(1990);

    // Not part of `POST /players` — T3 §1.4 puts it on `PATCH /settings`, so it queues normally.
    const queued = peek(db, 10);

    expect(queued[0]?.kind).toBe('settings');
    expect(JSON.parse(queued[0]?.payload ?? '{}')).toMatchObject({ birthYear: 1990 });
  });

  it('sends the client-minted id, the name and a timezone', async () => {
    const db = memoryDatabase();
    const fetchImpl = jsonFetch(wireRegistration());

    await registerNewPlayer(
      db,
      { ...OPTIONS, fetchImpl },
      { traverserName: 'Matthew', birthYear: 1990 },
      NOW,
    );

    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(url).toBe('http://host/api/v1/players');
    expect(body.traverser_name).toBe('Matthew');
    expect(body.player_id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(typeof body.timezone).toBe('string');
  });

  it('sends no bearer token, because registration is where the token comes from', async () => {
    const db = memoryDatabase();
    const fetchImpl = jsonFetch(wireRegistration());

    await registerNewPlayer(db, { ...OPTIONS, fetchImpl }, { traverserName: 'M', birthYear: 1990 }, NOW);

    const [, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect(init.headers).not.toHaveProperty('authorization');
  });

  /**
   * The id is persisted **before** the request, or a crash orphans an unclaimable profile — and a
   * fresh id per retry would do it again on every attempt.
   */
  it('persists the player id before the request is made', async () => {
    const db = memoryDatabase();
    let idAtRequestTime: string | null = null;

    const fetchImpl = jest.fn(async () => {
      idAtRequestTime = mockStore.get('traverser.player_id') ?? null;

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => Promise.resolve(wireRegistration()),
      } as Response);
    }) as unknown as typeof fetch;

    await registerNewPlayer(db, { ...OPTIONS, fetchImpl }, { traverserName: 'M', birthYear: 1990 }, NOW);

    expect(idAtRequestTime).not.toBeNull();
  });

  it('reuses the stored id after a failed attempt rather than minting a second profile', async () => {
    const db = memoryDatabase();

    await expect(
      registerNewPlayer(
        db,
        { ...OPTIONS, fetchImpl: jsonFetch({ code: 'nope' }, 500) },
        { traverserName: 'M', birthYear: 1990 },
        NOW,
      ),
    ).rejects.toBeInstanceOf(ApiStatusError);

    const firstId = mockStore.get('traverser.player_id');
    const retry = jsonFetch(wireRegistration());

    await registerNewPlayer(db, { ...OPTIONS, fetchImpl: retry }, { traverserName: 'M', birthYear: 1990 }, NOW);

    const [, init] = (retry as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect((JSON.parse(init.body as string) as { player_id: string }).player_id).toBe(firstId);
  });

  it('falls back to the default name when the field is left empty', async () => {
    const db = memoryDatabase();
    const fetchImpl = jsonFetch(wireRegistration());

    await registerNewPlayer(db, { ...OPTIONS, fetchImpl }, { traverserName: '   ', birthYear: 1990 }, NOW);

    const [, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect((JSON.parse(init.body as string) as { traverser_name: string }).traverser_name).toBe(
      'Traverser',
    );
  });

  /**
   * The failure that proves why the token is saved before the mirror: a player row *is* the
   * registered signal the boot router reads, so a mirror without a credential launches into the
   * tabs and 401s forever. An empty mirror is recoverable; that state is not.
   */
  it('writes no mirror when the credential cannot be stored', async () => {
    const db = memoryDatabase();
    const secureStore = jest.requireMock('expo-secure-store') as {
      setItemAsync: jest.Mock;
    };

    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      if (key === 'traverser.bearer_token') {
        throw new Error('keystore unavailable');
      }

      mockStore.set(key, value);
    });

    await expect(
      registerNewPlayer(
        db,
        { ...OPTIONS, fetchImpl: jsonFetch(wireRegistration()) },
        { traverserName: 'M', birthYear: 1990 },
        NOW,
      ),
    ).rejects.toThrow('keystore unavailable');

    expect(readPlayer(db)).toBeNull();
  });

  it('leaves no credential behind when the server refuses', async () => {
    const db = memoryDatabase();

    await expect(
      registerNewPlayer(
        db,
        { ...OPTIONS, fetchImpl: jsonFetch({ code: 'validation_failed' }, 400) },
        { traverserName: 'M', birthYear: 1990 },
        NOW,
      ),
    ).rejects.toBeInstanceOf(ApiStatusError);

    expect(mockStore.get('traverser.bearer_token')).toBeUndefined();
    expect(readPlayer(db)).toBeNull();
  });
});

describe('restoring an exported identity (tech-06 §13.1)', () => {
  it('proves the credentials, then saves them and the profile', async () => {
    const db = memoryDatabase();
    const fetchImpl = jsonFetch(wireProfile());

    await restoreIdentity(db, { ...OPTIONS, fetchImpl }, { playerId: PLAYER_ID, token: 'tok' });

    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect(url).toBe('http://host/api/v1/players/me');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(mockStore.get('traverser.bearer_token')).toBe('tok');
    expect(readPlayer(db)?.playerId).toBe(PLAYER_ID);
  });

  /** An unverified token strands the device — the restore screen only exists where there is no identity. */
  it('saves nothing when the token is rejected', async () => {
    const db = memoryDatabase();

    await expect(
      restoreIdentity(
        db,
        { ...OPTIONS, fetchImpl: jsonFetch({ code: 'invalid_bearer_token' }, 401) },
        { playerId: PLAYER_ID, token: 'wrong' },
      ),
    ).rejects.toBeInstanceOf(ApiStatusError);

    expect(mockStore.get('traverser.bearer_token')).toBeUndefined();
    expect(readPlayer(db)).toBeNull();
  });

  it('rejects a token that belongs to a different profile', async () => {
    const db = memoryDatabase();
    const other = wireProfile({ player: wirePlayer({ player_id: '018f0000-0000-7000-8000-00000000ffff' }) });

    await expect(
      restoreIdentity(db, { ...OPTIONS, fetchImpl: jsonFetch(other) }, { playerId: PLAYER_ID, token: 'tok' }),
    ).rejects.toBeInstanceOf(RestoreError);

    expect(mockStore.get('traverser.bearer_token')).toBeUndefined();
  });
});

/**
 * The Settings hand-over (T6 §13.1, amended 2026-08-16). Distinct from the restore above in the one
 * way that matters: the device is not empty, so this is a *replacement* and the local wipe is the
 * substance of it.
 */
describe('handing a device over to a different identity', () => {
  const OTHER = '018f0000-0000-7000-8000-0000000012ab';

  /** A device mid-life: queued deltas, watermarks, and a day of history under the outgoing player. */
  const usedDatabase = (overrides: Record<string, unknown> = {}) => {
    const db = registeredDatabase({ player_id: OTHER, ...overrides });

    enqueue(db, {
      clientOpId: 'op-1',
      kind: 'sync_delta',
      payload: { steps_delta: 900 },
      createdAt: '2026-08-04T09:00:00Z',
    });
    raiseStepHighWater(db, '2026-08-04', 4_200);
    db.runSync(
      `INSERT INTO activity_day (player_id, activity_date, steps, step_goal_snapshot)
       VALUES (?, '2026-08-04', 4200, 7000)`,
      [OTHER],
    );

    return db;
  };

  it('replaces the mirror, and clears the queue and the watermarks', async () => {
    const db = usedDatabase();

    await handOverTo(db, { ...OPTIONS, fetchImpl: jsonFetch(wireProfile()) }, {
      playerId: PLAYER_ID,
      token: 'tok',
    });

    expect(readPlayer(db)?.playerId).toBe(PLAYER_ID);
    expect(mockStore.get('traverser.bearer_token')).toBe('tok');

    // The outgoing player's history goes with the player row rather than being left dangling.
    expect(db.getAllSync('SELECT 1 FROM activity_day')).toHaveLength(0);
    expect(peek(db, 10)).toHaveLength(0);

    // ↯ The point of the whole exercise: cleared watermarks are what make the next pass re-read the
    // last 72h from Health Connect and re-mint it for the restored player, instead of treating
    // today's steps as already reported and losing them.
    expect(stepHighWater(db, '2026-08-04')).toBe(0);
    expect(readWatermark(db)).toBeNull();
  });

  it('touches nothing when the token is rejected', async () => {
    const db = usedDatabase();

    await expect(
      handOverTo(
        db,
        { ...OPTIONS, fetchImpl: jsonFetch({ code: 'invalid_bearer_token' }, 401) },
        { playerId: PLAYER_ID, token: 'wrong' },
      ),
    ).rejects.toBeInstanceOf(ApiStatusError);

    expect(readPlayer(db)?.playerId).toBe(OTHER);
    expect(peek(db, 10)).toHaveLength(1);
    expect(stepHighWater(db, '2026-08-04')).toBe(4_200);
    expect(mockStore.get('traverser.bearer_token')).toBeUndefined();
  });

  /**
   * The defect found on the device after the first successful hand-over: the profile came back and
   * the activity log was empty. `GET /players/me` carries no days, and `activity_day` is otherwise
   * only ever written by a sync response — so a device that did not live through those days has no
   * way to learn about them. Pre-existing since M1: the onboarding restore had the same hole.
   */
  it('backfills the activity log, which the profile response does not carry', async () => {
    const db = usedDatabase();
    const history = [
      wireActivityDay({ activity_date: '2026-08-14', steps: 9_100 }),
      wireActivityDay({ activity_date: '2026-08-15', steps: 7_400 }),
    ];

    const fetchImpl = routedFetch({
      '/players/me': wireProfile(),
      '/players/me/activity': history,
    });

    await handOverTo(db, { ...OPTIONS, fetchImpl }, { playerId: PLAYER_ID, token: 'tok' });

    expect(readActivityDays(db, 90).map((day) => day.activityDate)).toEqual([
      '2026-08-15',
      '2026-08-14',
    ]);
  });

  /** A restore that reached the server is a success; the log is the least of what it delivered. */
  it('restores anyway when the history cannot be fetched', async () => {
    const db = usedDatabase();

    const fetchImpl = routedFetch({
      '/players/me': wireProfile(),
      '/players/me/activity': null,
    });

    await handOverTo(db, { ...OPTIONS, fetchImpl }, { playerId: PLAYER_ID, token: 'tok' });

    expect(readPlayer(db)?.playerId).toBe(PLAYER_ID);
    expect(readActivityDays(db, 90)).toHaveLength(0);
  });

  /**
   * The token pasted on its own, which is the form a player actually has to hand and the one the
   * first version rejected while telling them it was accepted. The credential is the token; the
   * server names the profile it belongs to.
   */
  it('accepts a token with no player id and takes the identity from the server', async () => {
    const db = usedDatabase();

    await handOverTo(db, { ...OPTIONS, fetchImpl: jsonFetch(wireProfile()) }, {
      playerId: null,
      token: 'tok',
    });

    expect(readPlayer(db)?.playerId).toBe(PLAYER_ID);
    expect(mockStore.get('traverser.player_id')).toBe(PLAYER_ID);
  });

  it('refuses a token that belongs to a different profile, before wiping anything', async () => {
    const db = usedDatabase();
    const other = wireProfile({ player: wirePlayer({ player_id: OTHER }) });

    await expect(
      handOverTo(db, { ...OPTIONS, fetchImpl: jsonFetch(other) }, {
        playerId: PLAYER_ID,
        token: 'tok',
      }),
    ).rejects.toBeInstanceOf(RestoreError);

    expect(db.getAllSync('SELECT 1 FROM activity_day')).toHaveLength(1);
  });
});

/**
 * The guard is the whole safety model for the Settings control, so it is asserted on the two things
 * that have no undo (a spent point, a finished tutorial) rather than on activity, which is
 * recoverable by the watermark clear.
 */
describe('whether a profile may be replaced', () => {
  it('allows a fresh profile, steps and all', () => {
    const db = registeredDatabase({ level: 1, lifetime_steps: 30_000 });

    expect(isProfileReplaceable(db)).toBe(true);
  });

  /**
   * The regression that made the control useless in practice: level is arithmetic on steps, not a
   * decision, and a throwaway profile that syncs one ordinary walk is Level 2 within minutes. Found
   * on the device — the card had already disappeared by the time it was looked for.
   */
  it('allows a profile that has levelled up, because levelling is not a choice', () => {
    expect(isProfileReplaceable(registeredDatabase({ level: 2, xp_current: 69 }))).toBe(true);
    expect(isProfileReplaceable(registeredDatabase({ level: 11 }))).toBe(true);
  });

  it('refuses a profile with a point spent', () => {
    const db = registeredDatabase();

    db.runSync('UPDATE player SET alloc_might = 1');

    expect(isProfileReplaceable(db)).toBe(false);
  });

  it('refuses a profile that has finished the tutorial', () => {
    const db = registeredDatabase();

    db.runSync("UPDATE player SET tutorial_completed_at = '2026-08-04T10:00:00Z'");

    expect(isProfileReplaceable(db)).toBe(false);
  });

  /** Onboarding owns the empty-device case and has its own screen; this control must not appear. */
  it('refuses a device with no profile at all', () => {
    expect(isProfileReplaceable(memoryDatabase())).toBe(false);
  });
});

describe('deviceTimezone', () => {
  it('returns an IANA zone, or UTC where Intl is unavailable', () => {
    expect(deviceTimezone()).toEqual(expect.stringMatching(/^[A-Za-z_/+-]+$/));
  });
});

/**
 * What a player can paste into the restore field (T6 §13.1, amended 2026-08-16).
 *
 * This block exists because of a device failure, not a hypothesis: the first version accepted only
 * the exported JSON, so pasting the bare token left the button disabled with no explanation and the
 * restore silently did nothing. Every case below is a form the file or the token can actually take
 * on the way through a phone's clipboard.
 */
describe('parsing a pasted identity', () => {
  const TOKEN = 'HXTsFbBUUBoOI1KOnGYm5HHzXaR0iBBjRxUYT9tLZ9E';

  it('takes the exported document whole', () => {
    const document = JSON.stringify({
      player_id: PLAYER_ID,
      token: TOKEN,
      exported_at: '2026-08-16T21:47:52.529Z',
      note: 'Traverser identity. Restore with this on first launch after a reinstall.',
    });

    expect(parseIdentityDocument(document)).toEqual({ playerId: PLAYER_ID, token: TOKEN });
  });

  /** The failure that started this. The token is the credential; the id is only a cross-check. */
  it('takes a bare token, with no player id', () => {
    expect(parseIdentityDocument(TOKEN)).toEqual({ playerId: null, token: TOKEN });
  });

  /** A token pasted out of a wrapped field arrives with the wrapping in it. */
  it('strips whitespace and line breaks out of a bare token', () => {
    expect(parseIdentityDocument(`  ${TOKEN.slice(0, 20)}\n${TOKEN.slice(20)}  `)).toEqual({
      playerId: null,
      token: TOKEN,
    });
  });

  it('takes a document that carries no player id', () => {
    expect(parseIdentityDocument(JSON.stringify({ token: TOKEN }))).toEqual({
      playerId: null,
      token: TOKEN,
    });
  });

  it('refuses an empty paste', () => {
    expect(parseIdentityDocument('')).toBeNull();
    expect(parseIdentityDocument('   \n  ')).toBeNull();
  });

  /**
   * A truncated file is the dangerous one: it looks like a document, so it must not fall through to
   * the bare-token branch and be sent as a credential made of JSON.
   */
  it('refuses a document that was cut short', () => {
    expect(parseIdentityDocument(`{"player_id": "${PLAYER_ID}", "tok`)).toBeNull();
  });

  it('refuses a document with no token in it', () => {
    expect(parseIdentityDocument(JSON.stringify({ player_id: PLAYER_ID }))).toBeNull();
    expect(parseIdentityDocument(JSON.stringify({ player_id: PLAYER_ID, token: '' }))).toBeNull();
  });
});
