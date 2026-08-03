import type { MintedDelta } from '../health/deltas';
import { type SyncResponse, parseContentVersion, parseSyncResponse, toWireSyncRequest } from './dto';

/**
 * The HTTP client for the three calls a sync pass makes.
 *
 * ↯ **An unreachable server is the normal case, not the error case** (tech-02 §1.2, tech-04 §8.1).
 * The API runs in Docker on a PC that is off between sessions by design, so this module's job is to
 * fail *fast and quietly* and let the pass succeed anyway. Everything the player earned is already
 * durable in the outbox before a request is ever made.
 *
 * ↯ And note the shape of the failure: `fetch` **rejects** on a network error, it does not resolve
 * with `ok: false`. Only an HTTP response — including a 500 — comes back as a resolved promise. The
 * two are different conditions here and are given different error types, because one means "try
 * again later, nothing is wrong" and the other means the server has an opinion.
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

export interface TraverserApi {
  contentVersion(): Promise<number>;
  sync(deltas: readonly MintedDelta[], contentVersion: number): Promise<SyncResponse>;
}

export interface ApiOptions {
  /** Includes the `/api/v1` prefix, no trailing slash. */
  readonly baseUrl: string;
  readonly token: string;
  readonly timeoutMs?: number;
  /** Injected in tests; production uses the global. */
  readonly fetchImpl?: typeof fetch;
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

export function createApi(options: ApiOptions): TraverserApi {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;

  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await doFetch(`${options.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${options.token}`,
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

    try {
      return await response.json();
    } catch {
      // A 2xx whose body will not parse is a broken server, not an unreachable one — but it is also
      // not something a retry fixes, so it is reported rather than swallowed as offline.
      throw new ApiStatusError(response.status, null, `${path} returned an unreadable body.`);
    }
  }

  return {
    async contentVersion() {
      return parseContentVersion(await request('/content/version'));
    },

    async sync(deltas, contentVersion) {
      return parseSyncResponse(
        await request('/sync', {
          method: 'POST',
          body: JSON.stringify(toWireSyncRequest(deltas, contentVersion)),
        }),
      );
    },
  };
}
