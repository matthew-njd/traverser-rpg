import { type ContentBundle, parseBundle } from '../content/bundle';
import type { MintedDelta } from '../health/deltas';
import {
  type ActivityDay,
  type AllocationPayload,
  type EquipPayload,
  type ExplorePayload,
  type PlayerProfile,
  type Registration,
  type RestDayPayload,
  type SettingsPayload,
  type SkillsPayload,
  type SyncResponse,
  type SyncSession,
  type UseItemPayload,
  parseActivityDays,
  parseContentVersion,
  parseProfile,
  parseRegistration,
  parseSyncResponse,
  toWireAllocation,
  toWireEquip,
  toWireRegistration,
  toWireRestDay,
  toWireSettings,
  toWireSkills,
  toWireSyncRequest,
  toWireUseItem,
} from './dto';

/**
 * The HTTP client for everything the app asks of the server.
 *
 * An unreachable server is the **normal** case (tech-02 §1.2) — the API is on a PC that is off
 * between sessions by design. Fail fast and quietly; the outbox is durable before any request.
 *
 * ↯ `fetch` **rejects** on a network error but resolves for any HTTP response, 500 included. Those
 * are different conditions and get different error types: "retry later" versus "the server ruled".
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
 * Deliberately short (tech-04 §7.1). Thirty seconds against a dead host is thirty seconds of an app
 * that looks busy; nothing is lost by giving up, because the queue is durable.
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
  /** The whole content set (tech-02 §3). Fetched only when the version poll above moved. */
  contentBundle(): Promise<ContentBundle>;
  sync(
    deltas: readonly MintedDelta[],
    contentVersion: number,
    battles?: readonly Record<string, unknown>[],
    /** T3 §6's sessions, re-sent whole every pass — the server sets rather than adds (T2 §6.3). */
    sessions?: readonly SyncSession[],
    /** GDD 9 §4.3 taps queued while offline. Each spends one roll from the daily pool. */
    explores?: readonly ExplorePayload[],
    /** "Today" for streak evaluation (T2 §4 step 9) — the day this sync marks as opened. */
    localDate?: string,
  ): Promise<SyncResponse>;
  /** tech-02 §3's one-shot repair path, and what a restore uses to prove its credentials. */
  profile(): Promise<PlayerProfile>;
  /**
   * The activity log's history, for a closed date range of local calendar dates (tech-02 §3).
   *
   * ↯ `/players/me` does **not** carry this — it is the player block, settings, streak and zones,
   * and nothing day-by-day. Activity history otherwise only ever arrives as the days a sync
   * touched, so this is the only way a device that did not live through those days can show them.
   */
  activity(from: string, to: string): Promise<readonly ActivityDay[]>;
  allocate(payload: AllocationPayload): Promise<void>;
  updateSettings(payload: SettingsPayload): Promise<void>;
  /** GDD 11 §3.1's tag, which is also GDD 2 §6's Vigor restore. */
  tagRestDay(payload: RestDayPayload): Promise<void>;
  equipGear(payload: EquipPayload): Promise<void>;
  useItem(payload: UseItemPayload): Promise<void>;
  setSkills(payload: SkillsPayload): Promise<void>;
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
    // A 2xx that will not parse is a broken server, not an offline one, and a retry will not fix it.
    throw new ApiStatusError(response.status, null, `${path} returned an unreadable body.`);
  }
}

export function createApi(options: ApiOptions): TraverserApi {
  return {
    async contentVersion() {
      return parseContentVersion(await request(options, '/content/version'));
    },

    async contentBundle() {
      // No `If-None-Match`: the client already decided the version moved before calling, so a 304
      // here would be a response it has no cached body to pair with.
      return parseBundle(await request(options, '/content/bundle'));
    },

    async sync(deltas, contentVersion, battles = [], sessions = [], explores = [], localDate) {
      return parseSyncResponse(
        await request(options, '/sync', {
          method: 'POST',
          body: JSON.stringify(
            toWireSyncRequest(deltas, contentVersion, battles, sessions, explores, localDate),
          ),
        }),
      );
    },

    async profile() {
      return parseProfile(await request(options, '/players/me'), 'response');
    },

    async activity(from, to) {
      return parseActivityDays(
        await request(options, `/players/me/activity?from=${from}&to=${to}`),
      );
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

    async tagRestDay(payload) {
      await request(options, '/players/me/rest-days', {
        method: 'POST',
        body: JSON.stringify(toWireRestDay(payload)),
      });
    },

    async equipGear(payload) {
      await request(options, `/players/me/gear/${encodeURIComponent(payload.playerGearId)}/equipped`, {
        method: 'PUT',
        body: JSON.stringify(toWireEquip(payload)),
      });
    },

    async setSkills(payload) {
      await request(options, '/players/me/skills', {
        method: 'PUT',
        body: JSON.stringify(toWireSkills(payload)),
      });
    },

    async useItem(payload) {
      await request(options, `/players/me/items/${encodeURIComponent(payload.playerItemId)}/use`, {
        method: 'POST',
        body: JSON.stringify(toWireUseItem(payload)),
      });
    },
  };
}

/**
 * A free function, not a method: registration is the one call made without a token, and keeping it
 * off the interface means no client instance ever holds an empty credential.
 *
 * Idempotent on the client-minted `player_id` (tech-02 §3) — re-registering returns the existing
 * profile rather than 409. The token is returned exactly once; only its SHA-256 is stored.
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
