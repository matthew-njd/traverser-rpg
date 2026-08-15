import * as Sentry from '@sentry/react-native';

import { sentryDsn, sentryEnvironment } from './env';

/**
 * tech-06 §9. Errors only — no tracing, no replay, no profiling, no custom event pipeline.
 * Called once from the root layout; `app/` holds routes and no logic (tech-04 §13).
 *
 * A blank DSN disables capture, the same contract the server side has: the dev loop must work
 * without a Sentry account (§4.1).
 */
export function initSentry(): void {
  if (!sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,

    // §9.3 — explicit rather than SDK defaults. Step counts and HR minutes must not ride along.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,

    // No performance product of any kind — the analytics trim stands (§9.3).
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // Off because an unreachable API is the *normal* case here (tech-02 §1.2) — capturing those
    // would fill the free tier with events describing the design working correctly.
    enableCaptureFailedRequests: false,
  });
}

/** Wraps the root component so render errors and native crashes are reported. */
export const wrapRoot = Sentry.wrap;
