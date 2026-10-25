import { transact } from '../db/transaction';
import type { SqlParam, SqliteDatabase } from '../db/types';
import { WireFormatError } from '../sync/dto';
import { CONTENT_TABLES, CONTENT_TABLE_NAMES, type ColumnKind, type ContentTable } from './schema';

/**
 * The content bundle: parsed off the wire, stored whole, read back as rows (T4 §5.1).
 *
 * **The app must be playable having never fetched it** — `src/content/embedded.generated.ts` ships
 * the bundle current at build time and `seedEmbeddedContent` loads it at boot. A fetch only ever
 * replaces it with something newer.
 */

/** Row values as they cross the wire and sit in SQLite: decimals stay strings (tech-02 §2). */
export type ContentRow = Readonly<Record<string, string | number | null>>;

export type ContentTables = Readonly<Record<ContentTable, readonly ContentRow[]>>;

export interface ContentBundle {
  readonly contentVersion: number;
  readonly generatedAt: string;
  readonly tables: ContentTables;
}

function coerce(value: unknown, kind: ColumnKind, field: string): string | number | null {
  if (value === null || value === undefined) {
    if (kind === 'text?' || kind === 'int?' || kind === 'lines?') {
      return null;
    }

    throw new WireFormatError(field);
  }

  switch (kind) {
    case 'int':
    case 'int?':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new WireFormatError(field);
      }

      return value;

    case 'bool':
      if (typeof value !== 'boolean') {
        throw new WireFormatError(field);
      }

      return value ? 1 : 0;

    // A decimal arriving as a JSON number is a server that stopped honouring tech-02 §2, and
    // accepting it here would hide that until a damage multiplier came out one ulp low.
    case 'dec':
      if (typeof value !== 'string' || !/^-?\d+\.\d+$/.test(value)) {
        throw new WireFormatError(field);
      }

      return value;

    case 'lines?':
      if (!Array.isArray(value) || !value.every((line) => typeof line === 'string')) {
        throw new WireFormatError(field);
      }

      return JSON.stringify(value);

    default:
      if (typeof value !== 'string') {
        throw new WireFormatError(field);
      }

      return value;
  }
}

/** Explicit parsing, never a cast — same discipline and same failure mode as `sync/dto.ts`. */
export function parseBundle(payload: unknown): ContentBundle {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new WireFormatError('bundle');
  }

  const body = payload as Record<string, unknown>;
  const contentVersion = body.content_version;
  const generatedAt = body.generated_at;

  if (typeof contentVersion !== 'number' || !Number.isInteger(contentVersion)) {
    throw new WireFormatError('content_version');
  }

  if (typeof generatedAt !== 'string') {
    throw new WireFormatError('generated_at');
  }

  const tables = {} as Record<ContentTable, readonly ContentRow[]>;

  for (const table of CONTENT_TABLE_NAMES) {
    const spec = CONTENT_TABLES[table];
    const rows = body[spec.field];

    if (!Array.isArray(rows)) {
      throw new WireFormatError(spec.field);
    }

    // An empty table is a bundle that would leave the game unplayable in a way nothing downstream
    // reports — an enemy with no moves, a chart with no rows. Rejected whole rather than stored.
    if (rows.length === 0) {
      throw new WireFormatError(`${spec.field} (empty)`);
    }

    tables[table] = rows.map((row: unknown, index) => {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new WireFormatError(`${spec.field}[${index}]`);
      }

      const source = row as Record<string, unknown>;
      const parsed: Record<string, string | number | null> = {};

      for (const [column, kind] of Object.entries(spec.columns)) {
        parsed[column] = coerce(source[column], kind, `${spec.field}[${index}].${column}`);
      }

      return parsed;
    });
  }

  return { contentVersion, generatedAt, tables };
}

/**
 * Replaces the whole content set in one transaction.
 *
 * Delete-then-insert rather than upsert: a bundle that dropped a row would otherwise leave it
 * behind forever, and a stale enemy that no content references is invisible until something picks
 * it. There are no FKs between these tables (migration V3), so the delete order does not matter.
 */
export function writeBundle(db: SqliteDatabase, bundle: ContentBundle): void {
  transact(db, () => {
    for (const table of CONTENT_TABLE_NAMES) {
      const columns = Object.keys(CONTENT_TABLES[table].columns);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      db.runSync(`DELETE FROM ${table}`);

      for (const row of bundle.tables[table]) {
        db.runSync(sql, columns.map((column) => row[column] ?? null) as SqlParam[]);
      }
    }

    db.runSync(
      `INSERT INTO content_version (one_row, version, generated_at) VALUES (1, ?, ?)
         ON CONFLICT (one_row) DO UPDATE SET version = excluded.version,
                                             generated_at = excluded.generated_at`,
      [bundle.contentVersion, bundle.generatedAt],
    );
  });
}

/** Null until a bundle has been stored — which, after boot, means never (`seedEmbeddedContent`). */
export function readContentVersion(db: SqliteDatabase): number | null {
  return db.getFirstSync<{ version: number }>('SELECT version FROM content_version')?.version ?? null;
}

/** Whole-table read. Content is a few dozen rows per table; nothing here needs a query planner. */
export function readContentRows(db: SqliteDatabase, table: ContentTable): readonly ContentRow[] {
  return db.getAllSync<ContentRow>(`SELECT * FROM ${table}`);
}
