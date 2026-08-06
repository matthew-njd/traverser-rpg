import { ApiStatusError, ApiUnreachableError, createApi } from '../api';
import { wireSyncResponse } from './fixtures';

/**
 * ↯ The distinction this module exists to draw: `fetch` **rejects** on a network error and
 * **resolves** on a 500. One means "the PC is off, try later, nothing is wrong" — the normal case
 * per tech-02 §1.2 — and the other means the server has an opinion. Collapsing them would either
 * put an error in front of the player for the app working as designed, or hide a real server fault
 * as offline.
 */

async function rejection(call: Promise<unknown>): Promise<ApiStatusError> {
  try {
    await call;
  } catch (error) {
    return error as ApiStatusError;
  }

  throw new Error('the call was expected to reject');
}

const BASE = 'http://192.168.1.10:8080/api/v1';

const api = (fetchImpl: typeof fetch, timeoutMs?: number) =>
  createApi({ baseUrl: BASE, token: 'tok', fetchImpl, timeoutMs });

const ok = (body: unknown): typeof fetch =>
  jest.fn(async () =>
    Promise.resolve({ ok: true, status: 200, json: async () => Promise.resolve(body) } as Response),
  ) as unknown as typeof fetch;

describe('requests', () => {
  it('joins the base url and sends the bearer token', async () => {
    const fetchImpl = ok({ content_version: 7 });

    await api(fetchImpl).contentVersion();

    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${BASE}/content/version`);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('posts the sync batch as JSON', async () => {
    const fetchImpl = ok(wireSyncResponse());

    await api(fetchImpl).sync(
      [
        {
          clientDeltaId: 'd1',
          activityDate: '2026-08-02',
          source: 'steps',
          stepsDelta: 2000,
          minutesDelta: 0,
          hrTier: null,
          recordedAt: '2026-08-03T12:00:00.000Z',
        },
      ],
      0,
    );

    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${BASE}/sync`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      content_version: 0,
      deltas: [
        {
          client_delta_id: 'd1',
          activity_date: '2026-08-02',
          source: 'steps',
          steps_delta: 2000,
          minutes_delta: 0,
          hr_tier: null,
          recorded_at: '2026-08-03T12:00:00.000Z',
        },
      ],
    });
  });

  it('sends no content-type on a GET', async () => {
    const fetchImpl = ok({ content_version: 1 });

    await api(fetchImpl).contentVersion();

    const [, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];

    expect(init.headers).not.toHaveProperty('content-type');
  });
});

describe('failure modes', () => {
  it('reports a rejected fetch as unreachable', async () => {
    const fetchImpl = jest.fn(async () =>
      Promise.reject(new TypeError('Network request failed')),
    ) as unknown as typeof fetch;

    await expect(api(fetchImpl).contentVersion()).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  /** A host that accepts the connection and never answers is the same condition to the player. */
  it('reports a timeout as unreachable', async () => {
    const hanging = jest.fn(
      async (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    ) as unknown as typeof fetch;

    await expect(api(hanging, 10).contentVersion()).rejects.toBeInstanceOf(ApiUnreachableError);
  });

  it('reports a non-2xx as a status error carrying the RFC 9457 code', async () => {
    const fetchImpl = jest.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: async () => Promise.resolve({ code: 'validation_failed', title: 'Bad request' }),
      } as Response),
    ) as unknown as typeof fetch;

    const error = await rejection(api(fetchImpl).contentVersion());

    expect(error).toBeInstanceOf(ApiStatusError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('validation_failed');
  });

  it('survives an error body that is not JSON', async () => {
    const fetchImpl = jest.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 502,
        json: async () => Promise.reject(new Error('not json')),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const error = await rejection(api(fetchImpl).contentVersion());

    expect(error.status).toBe(502);
    expect(error.code).toBeNull();
  });

  /** A 200 with an unreadable body is a broken server, not an offline one — a retry will not fix it. */
  it('reports an unreadable success body as a status error, not as unreachable', async () => {
    const fetchImpl = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => Promise.reject(new Error('truncated')),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    await expect(api(fetchImpl).contentVersion()).rejects.toBeInstanceOf(ApiStatusError);
  });
});
