/**
 * D1 → R2 backup helpers.
 *
 * Dumps every user table in a D1 database as newline-delimited JSON
 * (NDJSON, one line per row, each row shaped as
 * `{"table":"<name>","row":{...}}`) and writes the result to an R2
 * bucket with a date-keyed object name.
 *
 * Design notes
 * ------------
 * - We enumerate tables from `sqlite_master` (D1 exposes SQLite internals)
 *   so backups remain correct as new tables are added. Internal tables
 *   prefixed with `sqlite_` and the D1 migration journal `d1_*` are
 *   excluded.
 * - Pagination is cursor-based on `rowid` to bound memory usage; a 1000-row
 *   page is a reasonable trade-off for Workers CPU time limits.
 * - The NDJSON stream is buffered in memory and written to R2 in a single
 *   `put`. For very large databases (>50 MB) this should be swapped to
 *   a multipart upload; we refuse to continue past MAX_BACKUP_BYTES rather
 *   than OOM the Worker.
 * - Operator-run equivalent lives at `scripts/backup-d1.sh` which wraps
 *   `wrangler d1 export`. The HTTP endpoint is the cron-triggered path.
 */

/** Hard cap on a single backup payload size — 50 MB. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
/** Rows fetched per page (bounded to respect Worker CPU limits). */
export const BACKUP_PAGE_SIZE = 1000;

/** Tables we always skip — SQLite internals and D1 migration journal. */
const SKIP_TABLE_PREFIXES = ["sqlite_", "d1_", "_cf_"];

export interface BackupD1 {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
    all(): Promise<{ results: Array<Record<string, unknown>> }>;
  };
}

export interface BackupR2 {
  put(key: string, value: ArrayBuffer | Uint8Array | string, opts?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
}

export interface BackupResult {
  /** R2 object key (e.g., "backups/2026-04-08T10-30-00Z.ndjson"). */
  key: string;
  /** Total rows written across all tables. */
  rows: number;
  /** Total bytes written. */
  bytes: number;
  /** Per-table row counts. */
  tables: Record<string, number>;
  /** UTC timestamp of the backup. */
  timestamp: string;
}

/**
 * Enumerate user tables in a D1 database.
 * Skips SQLite internals and the D1 migration journal.
 */
export async function listBackupTables(db: BackupD1): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  return results
    .map((r) => String(r.name ?? ""))
    .filter((name) => name && !SKIP_TABLE_PREFIXES.some((p) => name.startsWith(p)));
}

/**
 * Stream every row of a table as NDJSON lines, paginated by rowid.
 * Calls the writer for each line. Returns the total row count.
 */
export async function dumpTableNdjson(
  db: BackupD1,
  table: string,
  writer: (line: string) => void,
): Promise<number> {
  // SQLite identifier quoting — the table name came from sqlite_master, so
  // it is already trusted, but we still double-quote it to be safe.
  const quoted = `"${table.replace(/"/g, '""')}"`;

  let cursor = 0;
  let count = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { results } = await db
      .prepare(
        `SELECT rowid AS _rowid, * FROM ${quoted} WHERE rowid > ? ORDER BY rowid LIMIT ?`,
      )
      .bind(cursor, BACKUP_PAGE_SIZE)
      .all();

    if (results.length === 0) break;

    for (const row of results) {
      const rowid = Number(row._rowid ?? 0);
      if (Number.isFinite(rowid) && rowid > cursor) cursor = rowid;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _rowid, ...rest } = row;
      writer(JSON.stringify({ table, row: rest }) + "\n");
      count++;
    }

    if (results.length < BACKUP_PAGE_SIZE) break;
  }
  return count;
}

/**
 * Full backup: list tables, dump each to NDJSON, upload to R2.
 *
 * @param db          D1 database binding.
 * @param r2          R2 bucket binding.
 * @param options.prefix  R2 key prefix (default: "backups/").
 * @param options.timestamp  Override for the backup timestamp (testing).
 */
export async function runBackup(
  db: BackupD1,
  r2: BackupR2,
  options: { prefix?: string; timestamp?: Date } = {},
): Promise<BackupResult> {
  const timestamp = (options.timestamp ?? new Date()).toISOString();
  const keyTimestamp = timestamp.replace(/[:.]/g, "-");
  const key = `${options.prefix ?? "backups/"}${keyTimestamp}.ndjson`;

  const tables = await listBackupTables(db);
  const perTable: Record<string, number> = {};
  const chunks: string[] = [];
  let bytes = 0;
  let totalRows = 0;

  // Header row — makes the backup self-describing.
  const header =
    JSON.stringify({
      table: "_meta",
      row: { version: 1, timestamp, tables },
    }) + "\n";
  chunks.push(header);
  bytes += header.length;

  for (const table of tables) {
    perTable[table] = 0;
    const count = await dumpTableNdjson(db, table, (line) => {
      bytes += line.length;
      if (bytes > MAX_BACKUP_BYTES) {
        throw new Error(
          `Backup exceeded ${MAX_BACKUP_BYTES} byte limit at table ${table}`,
        );
      }
      chunks.push(line);
    });
    perTable[table] = count;
    totalRows += count;
  }

  const body = chunks.join("");
  await r2.put(key, body, {
    httpMetadata: { contentType: "application/x-ndjson" },
    customMetadata: {
      rows: String(totalRows),
      tables: String(tables.length),
      timestamp,
    },
  });

  return {
    key,
    rows: totalRows,
    bytes,
    tables: perTable,
    timestamp,
  };
}
