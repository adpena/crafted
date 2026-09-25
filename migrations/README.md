# Site database repairs

`0001_repair_emdash_fts.sql` repairs the external-content search indexes for the existing `projects`, `pages`, and `writing` collections in EmDash 0.1.0. It replaces update/delete triggers with FTS5 delete commands that use the old row values, rebuilds the derived indexes, and checks their consistency. It does not modify content or revision rows.

Applied to the production `crafted` D1 database on September 25, 2026. This was an explicit repair, not a migration recorded in Wrangler's migration journal.

Run only after the named collections and search indexes exist. The repair can be reapplied. If EmDash 0.1.0 recreates an affected collection's search schema, it can reinstall the faulty triggers; reapply this repair after that operation until the upstream trigger generation is fixed.

```sh
npx wrangler d1 execute crafted --remote --file migrations/0001_repair_emdash_fts.sql
```

`tests/fts-migration.test.ts` exercises the actual SQL against SQLite FTS5, including searches after updates and deletions.
