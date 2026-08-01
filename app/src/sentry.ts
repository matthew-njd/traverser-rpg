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

    // ↯ §9.3 requires these be explicit rather than left at SDK defaults. The app handles step
    // counts and heart-rate minutes; none of it should ride along on a crash report.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,

    // No performance product of any kind — the analytics trim stands (§9.3).
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // ↯ Off for a reason specific to this app, not just privacy. tech-02 §1.2 makes an unreachable
    // API the *normal* case and tech-04 §8.1 makes the client treat it as success — so failed
    // requests here are expected behaviour, not incidents. Capturing them would fill the free tier
    // with events describing the design working correctly, and bury the real ones.
    enableCaptureFailedRequests: false,
  });
}

/** Wraps the root component so render errors and native crashes are reported. */
export const wrapRoot = Sentry.wrap;
