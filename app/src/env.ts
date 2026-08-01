import Constants from 'expo-constants';

/**
 * The single read point for build-time configuration (tech-06 §4.2).
 *
 * Feature code imports `apiBaseUrl` from here and never touches `process.env` or
 * `Constants.expoConfig` directly — one place to look when a build points at the wrong host.
 */

const extra = Constants.expoConfig?.extra as
  | { apiBaseUrl?: string; sentryDsn?: string; sentryEnvironment?: string }
  | undefined;

if (!extra?.apiBaseUrl) {
  // app.config.ts already throws at build time if the variable is unset, so reaching this means
  // the installed binary was built against a different config than the one in the repo.
  throw new Error(
    'apiBaseUrl missing from expoConfig.extra — rebuild the app (tech-04 §3.2: config changes need a rebuild, not a reload).'
  );
}

/** Includes the `/api/v1` prefix, no trailing slash — join with a leading-slash path. */
export const apiBaseUrl: string = extra.apiBaseUrl;

/**
 * tech-06 §9.1's `traverser-app` DSN. Unlike apiBaseUrl this is **optional by design** — blank
 * disables capture, matching the server contract (§4.1), so the app runs without a Sentry account.
 */
export const sentryDsn: string = extra.sentryDsn ?? '';

/** `development` / `production`, so a local experiment does not pollute real issues (§9.2). */
export const sentryEnvironment: string = extra.sentryEnvironment ?? 'development';
