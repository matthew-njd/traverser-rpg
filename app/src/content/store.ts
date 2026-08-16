import type { SqliteDatabase } from '../db/types';
import { EMBEDDED_BUNDLE } from './embedded.generated';
import { type ContentBundle, parseBundle, readContentVersion, writeBundle } from './bundle';

/**
 * Which bundle the device holds, and how it gets one (T4 §5.1).
 *
 * Version negotiation has exactly one rule: **a bundle is adopted only if it is strictly newer than
 * the one stored.** That covers the embedded copy at boot, a fetch after a content release, and the
 * case that matters most — an API rolled back to an older seed, whose bundle must not overwrite the
 * newer content already on the device.
 */

/**
 * Loads the build-time copy if the device holds nothing newer. Runs at boot, before anything reads
 * content, so the app is playable on a device that has never reached the server.
 *
 * Parsed rather than trusted, despite being generated: it crosses the same shape check as a fetched
 * bundle, so a codegen run against a server that changed the payload fails here rather than
 * half-populating the tables.
 */
export function seedEmbeddedContent(db: SqliteDatabase): number | null {
  return adoptBundle(db, parseBundle(EMBEDDED_BUNDLE));
}

/** Stores the bundle if it is newer than what is already there; returns the version now in force. */
export function adoptBundle(db: SqliteDatabase, bundle: ContentBundle): number | null {
  const held = readContentVersion(db);

  if (held !== null && bundle.contentVersion <= held) {
    return held;
  }

  writeBundle(db, bundle);

  return bundle.contentVersion;
}
