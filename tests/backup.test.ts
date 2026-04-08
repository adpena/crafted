/**
 * Unit tests for the D1→R2 backup helpers.
 */

import { describe, it, expect } from "vitest";
import {
  listBackupTables,
  dumpTableNdjson,
  runBackup,
  MAX_BACKUP_BYTES,
  type BackupD1,
  type BackupR2,
} from "../src/lib/backup.ts";

/**
 * Fake D1: simulates sqlite_master + two user tables, with bindable
 * prepared statements. Pagination is honored on rowid > cursor LIMIT N.
 */
function fakeDb(tables: Record<string, Array<Record<string, unknown>>>): BackupD1 {
  const tableNames = Object.keys(tables);
  return {
    prepare(sql: string) {
      const bindings: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          bindings.push(...args);
          return statement;
        },
        async all() {
          if (sql.includes("FROM sqlite_master")) {
            return {
              results: [
                ...tableNames.map((name) => ({ name })),
                { name: "sqlite_sequence" },
                { name: "d1_migrations" },
                { name: "_cf_KV" },
              ],
            };
          }
          // SELECT ... FROM "tablename" WHERE rowid > ? ORDER BY rowid LIMIT ?
          const match = sql.match(/FROM\s+"([^"]+)"/);
          if (match) {
            const table = match[1]!;
            const cursor = Number(bindings[0] ?? 0);
            const limit = Number(bindings[1] ?? 1000);
            const rows = tables[table] ?? [];
            // Assign synthetic rowids: index + 1
            const page = rows
              .map((row, i) => ({ _rowid: i + 1, ...row }))
              .filter((r) => r._rowid > cursor)
              .slice(0, limit);
            return { results: page };
          }
          return { results: [] };
        },
      };
      return statement;
    },
  };
}

function fakeR2() {
  const puts: Array<{ key: string; body: string; opts?: unknown }> = [];
  const r2: BackupR2 = {
    async put(key, value, opts) {
      const body = typeof value === "string" ? value : new TextDecoder().decode(value as Uint8Array);
      puts.push({ key, body, opts });
    },
  };
  return { r2, puts };
}

describe("listBackupTables", () => {
  it("excludes sqlite_ / d1_ / _cf_ prefixed tables", async () => {
    const db = fakeDb({ contacts: [], audit_log: [] });
    const names = await listBackupTables(db);
    expect(names).toEqual(expect.arrayContaining(["contacts", "audit_log"]));
    expect(names).not.toContain("sqlite_sequence");
    expect(names).not.toContain("d1_migrations");
    expect(names).not.toContain("_cf_KV");
  });
});

describe("dumpTableNdjson", () => {
  it("emits one NDJSON line per row", async () => {
    const db = fakeDb({
      contacts: [
        { id: "1", email: "a@b.com" },
        { id: "2", email: "c@d.com" },
      ],
    });
    const lines: string[] = [];
    const count = await dumpTableNdjson(db, "contacts", (line) => lines.push(line));
    expect(count).toBe(2);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.endsWith("\n")).toBe(true);
      const parsed = JSON.parse(line);
      expect(parsed.table).toBe("contacts");
      expect(parsed.row).toBeDefined();
      expect(parsed.row._rowid).toBeUndefined();
    }
  });

  it("paginates past the page size", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: String(i) }));
    const db = fakeDb({ big: rows });
    const lines: string[] = [];
    const count = await dumpTableNdjson(db, "big", (l) => lines.push(l));
    expect(count).toBe(2500);
    expect(lines).toHaveLength(2500);
  });
});

describe("runBackup", () => {
  it("writes a timestamped NDJSON payload to R2", async () => {
    const db = fakeDb({
      contacts: [
        { id: "1", email: "a@b.com" },
        { id: "2", email: "c@d.com" },
      ],
      audit_log: [{ id: "x", action: "login" }],
    });
    const { r2, puts } = fakeR2();
    const fixed = new Date("2026-04-08T12:00:00.000Z");
    const result = await runBackup(db, r2, { timestamp: fixed });

    expect(puts).toHaveLength(1);
    const put = puts[0]!;
    expect(put.key).toBe("backups/2026-04-08T12-00-00-000Z.ndjson");

    expect(result.rows).toBe(3);
    expect(result.tables).toEqual({ contacts: 2, audit_log: 1 });
    expect(result.bytes).toBeGreaterThan(0);

    // Body must start with the _meta header line and contain all rows.
    const lines = put.body.split("\n").filter(Boolean);
    expect(lines).toHaveLength(4); // 1 meta + 3 rows
    const meta = JSON.parse(lines[0]!);
    expect(meta.table).toBe("_meta");
    expect(meta.row.version).toBe(1);
    expect(meta.row.tables).toEqual(expect.arrayContaining(["contacts", "audit_log"]));
  });

  it("applies a custom prefix", async () => {
    const db = fakeDb({ contacts: [] });
    const { r2, puts } = fakeR2();
    await runBackup(db, r2, { prefix: "nightly/", timestamp: new Date("2026-01-01T00:00:00Z") });
    expect(puts[0]?.key.startsWith("nightly/")).toBe(true);
  });

  it("throws when payload exceeds the max size", async () => {
    // 2 rows each ~30 MB → overflow against 50 MB cap.
    const big = "x".repeat(30 * 1024 * 1024);
    const db = fakeDb({ giant: [{ data: big }, { data: big }] });
    const { r2 } = fakeR2();
    await expect(runBackup(db, r2)).rejects.toThrow(/Backup exceeded/);
    expect(MAX_BACKUP_BYTES).toBe(50 * 1024 * 1024);
  });

  it("sets R2 custom metadata with row/table counts", async () => {
    const db = fakeDb({ contacts: [{ id: "1" }] });
    const { r2, puts } = fakeR2();
    await runBackup(db, r2, { timestamp: new Date("2026-04-08T00:00:00Z") });
    const put = puts[0]!;
    const opts = put.opts as { customMetadata?: Record<string, string>; httpMetadata?: { contentType?: string } };
    expect(opts.customMetadata?.rows).toBe("1");
    expect(opts.customMetadata?.tables).toBe("1");
    expect(opts.httpMetadata?.contentType).toBe("application/x-ndjson");
  });
});
