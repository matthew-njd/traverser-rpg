import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { peek } from '../../db/outbox';
import { ApiStatusError } from '../../sync/api';
import { readBirthYear, readPlayer, readStreak } from '../../sync/mirror';
import {
  PLAYER_ID,
  wirePlayer,
  wireProfile,
  wireRegistration,
} from '../../sync/__tests__/fixtures';
import { RestoreError, deviceTimezone, registerNewPlayer, restoreIdentity } from '../registration';

/**
 * GDD 10 screen 4's terminal step and tech-06 §13.1's restore branch beside it.
 *
 * ↯ The whole file is about *ordering*: what is persisted before what, and why each step guards the
 * one before it. Registration is one of only three things that genuinely need the server (tech-02
 * §3), so it is also the one place where a half-finished attempt has consequences that outlive the
 * screen.
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

    // ↯ The birth year is not part of `POST /players` — T3 §1.4's deviation lands on
    // `PATCH /settings`, so it goes through the ordinary queued-write path like any other change.
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
   * ↯ The `player_id` is persisted **before** the request. A crash between the server inserting the
   * row and the token reaching storage would otherwise orphan a profile nobody can claim — and
   * minting a fresh id on retry would do it again on every attempt. Reusing the stored id is exactly
   * what makes `POST /players` idempotent worth having.
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
   * ↯ The token is saved **before** the mirror, and this is the failure that proves why. If secure
   * storage refuses the write, the device has no credential — and a mirror written anyway would make
   * the player row exist, which is the whole registered/not-registered signal the boot router reads.
   * The app would then launch straight into the tabs holding no token, 401 on every sync forever,
   * and never show onboarding again. An empty mirror is recoverable; that state is not.
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

  /**
   * ↯ Saving an unverified token would strand the device permanently: the app boots straight into
   * the tabs, 401s on every sync, and never shows the restore screen again — because that screen
   * only exists where there is no identity.
   */
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

describe('deviceTimezone', () => {
  it('returns an IANA zone, or UTC where Intl is unavailable', () => {
    expect(deviceTimezone()).toEqual(expect.stringMatching(/^[A-Za-z_/+-]+$/));
  });
});
