# Portfolio development, publication, and recovery

This workflow maintains the existing `crafted` Worker at https://adpena.com. It does not provision a new Cloudflare account or finish the Action Pages product. A Git commit preserves code and public artifacts; D1 content, revisions, settings, and CMS media need a separate backup.

## Fresh local preview

Use Node 22 from `.nvmrc` and Python 3.10 or newer. Install with the lockfile. The repository disables dependency install scripts and npm pre/post hooks; type checking explicitly generates Worker declarations. Rebuild only the native SQLite dependency needed by the EmDash CLI.

```sh
npm ci
npm rebuild better-sqlite3 --ignore-scripts=false
npm run preview:seed
PORTFOLIO_TEST_STATE=.portfolio-release/test-state npm run dev
```

Open http://localhost:4321. `preview:seed` imports the public snapshot into a new local D1 state directory. It refuses an existing directory and never writes remote D1. For another preview, run `python3 scripts/seed-portfolio-preview.py --state .portfolio-release/another-preview` and set `PORTFOLIO_TEST_STATE` to that directory. No production user records or unpublished revisions are included. Initial admin setup in a preview is local only.

`seed/seed.json` reproduces the public content. It is **not** the production editing source. Do not import it into the live site or use it to overwrite an existing database.

## Editing authority

- About’s biography and shared site settings come from live EmDash/D1. About renders the published `pages/about` entry.
- Work descriptions, bodies, and external URLs come from published CMS collections.
- Selected homepage examples, layouts, demos, and public artifact snapshots are maintained in Git.
- Resume text comes from `src/data/resumes/profile.json`; see [resume maintenance](resumes.md).

Before a CMS update, read both the default entry and `--published` form using the configured EmDash CLI. A default read can return a pending draft. Preserve the full Portable Text structure and use the exact returned `_rev` with `content update --rev`. Updates publish by default; use `--draft` when drafting. Do not publish an existing draft as an incidental part of a copy edit. In particular, the older Molt draft remains protected.

After an intentional CMS publication, make a verified backup and refresh the public snapshot:

```sh
npm run backup:site
python3 scripts/sync-published-seed.py backups/EXACT-VERIFIED-BACKUP-DIRECTORY
```

Review the seed diff before committing. The sync exports only published custom fields and refuses empty collections or Working, but Uncovered. It does not export users, revisions, or credentials. A seed refresh does not modify D1.

## Verification and release

Run portfolio browser checks against an isolated seeded preview. Install browsers once using `npx playwright install --with-deps` (the OS dependency installation is intended for CI/Linux).

```sh
PORTFOLIO_TEST_STATE=.portfolio-release/test-state npm run test:e2e:portfolio
npm run build
npm run lighthouse
```

Lighthouse starts the built Worker on port 4322 and audits Home, About, Software Resume, and CharterCostTracker in desktop/mobile modes, using the median of three runs per page and mode. It saves local reports in `.lighthouseci/`. CI runs the same seeded portfolio checks against a built Worker; set `PORTFOLIO_BUILT_PREVIEW=1` to use that mode locally after building. Without it, Playwright starts the development server. Set `BASE_URL` to test an already running server. The historical Action Pages suite remains available through `test:e2e:all`, separately from this gate; these portfolio results do not establish that its unfinished fixtures, authenticated admin flows, or external integrations work.

Stop the development server before type checking, building, or shipping; Astro commands share a Vite dependency cache. After reviewing and committing all intended files:

```sh
npm run release:prepare
npm run ship
npm run release:verify
```

Preparation makes a verified private backup and records the Git tree, hashes of CMS rows/settings/all revisions, live/draft revision IDs, and hashes of public artifacts. Shipping requires a clean committed tree and unchanged prepared state, runs type checking, unit/backup tests and the build, deploys the Worker, invalidates `work-sections-v1` and `work-sections-v2`, then checks live portfolio/feed/resume routes, WIP 404s, and exact hashes of the deployed public artifacts. A receipt goes to `.portfolio-release/published.json`. An identical Git tree after merging remains verifiable.

A guard failure stops publication. Inspect the actual change; do not update the guard merely to bypass a conflict. For an intentional change, prepare again after committing. This command does not edit CMS content, apply migrations, or send a contact message.

The home cache expires after 60 seconds. Malformed cache data is ignored and incomplete collection reads are not cached. About returns 503 if its CMS entry is unavailable. Seed imports are never a fallback for missing live content.

## Backups and database migrations

`npm run backup:site` writes an ignored private directory with schema, data export, SQLite and D1 restore SQL, a restored SQLite database, CMS-referenced R2 media, and a manifest. The script excludes FTS shadow tables, rebuilds derived indexes, verifies their integrity, checks database integrity and every table’s row count, and compares foreign-key violations with the source.

The September 25 initial backup revealed 15 existing orphan metadata rows. Migration 0002 archives their complete values before removing only the named, still-orphaned, unchanged rows. Both repairs are now recorded in the production Wrangler migration journal. See [migration details](../migrations/README.md).

Backup scope includes application tables and **CMS-referenced** R2 objects. The current CMS media table has no rows. Unreferenced R2 uploads, KV cache, Worker secrets, and Cloudflare configuration require separate custody. Pause editing during a backup: before/after row-count/schema checks detect many changes, but this is not an atomic snapshot of concurrent updates. Private backups must never be committed or uploaded as public artifacts.

For a restore drill, start with a new empty local D1 state directory and import `restore-d1.sql` using Wrangler `--local --persist-to <new-directory>`. That file omits transaction statements because D1 manages the transaction. `restore.sql` is the equivalent standalone SQLite restore used by the automated verification. Do not run either against an existing database: it is a complete restore, not a merge. Validate counts, foreign keys, FTS search, public content, and protected drafts before any remote cutover. Restore media using the manifest’s original storage keys, separately from D1.

For code-only rollback, use Cloudflare’s recorded previous Worker deployment. A Worker rollback does not roll back D1, R2, or content edits. Use the backup and migration history to plan any data recovery rather than overwriting live content casually.

## Credentials and unfinished integrations

Use the existing Wrangler login or a scoped Cloudflare token through the environment. Never print tokens, signed export URLs, contact records, or draft text in logs. EmDash and Action Pages authentication/transport secrets are configured separately; ordinary portfolio previews and mock demos do not need real delivery credentials. The public email address remains a contact fallback. No live message is sent by release checks.
