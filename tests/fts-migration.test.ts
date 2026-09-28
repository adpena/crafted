import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("EmDash external-content search indexes", () => {
  it("keeps search results consistent after updates and deletions", () => {
    const db = new DatabaseSync(":memory:");
    try {
      for (const collection of ["projects", "pages", "writing"]) {
        const table = `ec_${collection}`;
        const fts = `_emdash_fts_${collection}`;
        const columns = collection === "pages"
          ? "id, locale, title, content"
          : "id, locale, title, summary, content";
        db.exec(`CREATE TABLE ${table} (${columns});
          CREATE VIRTUAL TABLE ${fts} USING fts5(${columns}, content='${table}', content_rowid='rowid');
          INSERT INTO ${table} (id, locale, title, content) VALUES ('entry', 'en', 'Original', 'oldterm');`);
      }
      db.exec(readFileSync(new URL("../migrations/0001_repair_emdash_fts.sql", import.meta.url), "utf8"));
      for (const collection of ["projects", "pages", "writing"]) {
        const table = `ec_${collection}`;
        const fts = `_emdash_fts_${collection}`;
        const matches = (term: string) => db.prepare(`SELECT id FROM ${fts} WHERE ${fts} MATCH ?`).all(term);
        expect(matches("oldterm")).toHaveLength(1);
        db.exec(`UPDATE ${table} SET title='Revised', content='newterm' WHERE id='entry'`);
        expect(matches("oldterm")).toHaveLength(0);
        expect(matches("newterm")).toHaveLength(1);
        db.exec(`DELETE FROM ${table} WHERE id='entry'`);
        expect(matches("newterm")).toHaveLength(0);
        db.exec(`INSERT INTO ${fts}(${fts}, rank) VALUES ('integrity-check', 1)`);
      }
    } finally {
      db.close();
    }
  });
});
