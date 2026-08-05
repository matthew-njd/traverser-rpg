import type { MintedDelta } from '../health/deltas';
import {
  type AllocationPayload,
  type PlayerProfile,
  type Registration,
  type SettingsPayload,
  type SyncResponse,
  parseContentVersion,
  parseProfile,
  parseRegistration,
  parseSyncResponse,
  toWireAllocation,
  toWireRegistration,
  toWireSettings,
  toWireSyncRequest,
} from './dto';

/**
 * The HTTP client for everything the app asks of the server.
 *
 * ↯ **An unreachable server is the normal case, not the error case** (tech-02 §1.2, tech-04 §8.1).
 * The API runs in Docker on a PC that is off between sessions by design, so this module's job is to
 * fail *fast and quietly* and let the caller carry on. Everything a sync pass earns is already
 * durable in the outbox before a request is ever made.
 *
 * ↯ And note the shape of the failure: `fetch` **rejects** on a network error, it does not resolve
 * with `ok: false`. Only an HTTP response — including a 500 — comes back as a resolved promise. The
 * two are different conditions here and get different error types, because one means "try again
 * later, nothing is wrong" and the other means the server has an opinion.
 */

/** No response at all: host down, DNS, connection refused, or the timeout below. */
export class ApiUnreachableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiUnreachableError';
  }
}

/** A response the server chose to send. `code` is tech-02 §2's RFC 9457 extension member. */
export class ApiStatusError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiStatusError';
  }
}

/**
 * ↯ Deliberately short. tech-04 §7.1 makes "the PC is off" a startup requirement rather than only a
 * networking one — a sync that hangs for thirty seconds against a dead host is thirty seconds of an
 * app that looks like it is doing something. Nothing is lost by giving up early: the queue is
 * durable and the next foreground retries.
 */
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface ApiOptions {
  /** Includes the `/api/v1` prefix, no trailing slash. */
  readonly baseUrl: string;
  /** Null only for registration, which is where the token comes from. */
  readonly token: string | null;
  readonly timeoutMs?: number;
  /** Injected in tests; production uses the global. */
  readonly fetchImpl?: typeof fetch;
}

export interface TraverserApi {
  contentVersion(): Promise<number>;
  sync(deltas: readonly MintedDelta[], contentVersion: number): Promise<SyncResponse>;
  /** tech-02 §3's one-shot repair path, and what a restore uses to prove its credentials. */
  profile(): Promise<PlayerProfile>;
  allocate(payload: AllocationPayload): Promise<void>;
  updateSettings(payload: SettingsPayload): Promise<void>;
}

async function problemCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'code' in body) {
      const code = (body as { code: unknown }).code;

      return typeof code === 'string' ? code : null;
    }
  } catch {
    // A body that is not JSON tells us nothing beyond the status, which the caller already has.
  }

  return null;
}

async function request(options: ApiOptions, path: string, init?: RequestInit): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await doFetch(`${options.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(options.token === null ? {} : { authorization: `Bearer ${options.token}` }),
        accept: 'application/json',
        ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch (cause) {
    throw new ApiUnreachableError(`No response from ${path}.`, { cause });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiStatusError(
      response.status,
      await problemCode(response),
      `${path} returned ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    // A 2xx whose body will not parse is a broken server, not an unreachable one — but it is also
    // not something a retry fixes, so it is reported rather than swallowed as offline.
    throw new ApiStatusError(response.status, null, `${path} returned an unreadable body.`);
  }
}

export function createApi(options: ApiOptions): TraverserApi {
  return {
    async contentVersion() {
      return parseContentVersion(await request(options, '/content/version'));
    },

    async sync(deltas, contentVersion) {
      return parseSyncResponse(
        await request(options, '/sync', {
          method: 'POST',
          body: JSON.stringify(toWireSyncRequest(deltas, contentVersion)),
        }),
      );
    },

    async profile() {
      return parseProfile(await request(options, '/players/me'), 'response');
    },

    async allocate(payload) {
      await request(options, '/players/me/allocations', {
        method: 'POST',
        body: JSON.stringify(toWireAllocation(payload)),
      });
    },

    async updateSettings(payload) {
      await request(options, '/players/me/settings', {
        method: 'PATCH',
        body: JSON.stringify(toWireSettings(payload)),
      });
    },
  };
}

/**
 * ↯ Registration is the one call made **without** a bearer token — it is where the token comes from
 * — so it is a free function rather than a method on the client. Keeping it off the interface means
 * no client instance in the app ever holds an empty credential.
 *
 * ↯ It is also idempotent on the client-minted `player_id` (tech-02 §3): re-registering returns the
 * existing profile rather than 409, so a lost response does not strand the device. The token is
 * freshly minted on every call and returned exactly once — only its SHA-256 is stored server-side.
 */
export async function registerPlayer(
  options: Omit<ApiOptions, 'token'>,
  body: { playerId: string; traverserName: string; timezone: string },
): Promise<Registration> {
  return parseRegistration(
    await request({ ...options, token: null }, '/players', {
      method: 'POST',
      body: JSON.stringify(toWireRegistration(body)),
    }),
  );
}
