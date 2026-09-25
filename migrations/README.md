# Site database repairs

Both migrations are recorded in the production `crafted` D1 Wrangler migration journal as of September 25, 2026. They operate on an existing EmDash database; they are not a schema bootstrap for an empty site.

- `0001_repair_emdash_fts.sql` repairs external-content FTS5 update/delete triggers for the historical `projects`, `pages`, and `writing` collections. It rebuilds indexes and checks their consistency. Its initial manual application was subsequently reconciled by applying the idempotent migration through Wrangler.
- `0002_archive_legacy_metadata.sql` archives the full values of 10 named orphan field definitions and five named orphan menu items. It deletes a row only while its parent remains missing and its value exactly matches the archive. Unlisted or changed rows are retained. It also repairs the design collection’s FTS update/delete triggers. No content or revision rows are changed.

Take and verify a private backup first. Review the pending SQL before running:

```sh
npx wrangler d1 migrations list crafted --remote
npx wrangler d1 migrations apply crafted --remote
```

EmDash 0.1.0 can reinstall faulty triggers when recreating a collection’s search schema. Inspect the generated schema after such changes. A repair for an already journaled migration needs a new migration (or a separately recorded exact repair), not an assumption that `migrations apply` will rerun it. Do not apply the historical migration set to a fresh preview that lacks the legacy `projects` collection.

`tests/fts-migration.test.ts` exercises the first migration against SQLite FTS5. `tests/test_portfolio_backup.py` tests restore/search behavior, the second migration’s exact-row archive and idempotence, preservation of unknown/healthy rows and revisions, and search after edits/deletions.
