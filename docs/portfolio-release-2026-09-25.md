# Portfolio release: publishing and two audiences

This completes the implementation of roadmap items 1 and 2. The previously published portfolio work is preserved in commit `098491e`; this follow-up keeps software and research equally visible and makes publication reproducible. Deployment identifiers belong in the release PR and the private publication receipt.

## What changed

- The homepage opens with two software projects (Molt and comma.ai compression) and two research projects (Lost Decade and CharterCostTracker). Descriptions stay visible without hover. Data for Public Education connects the two and links to Facing Facts as a concrete example.
- Software/research/writing filters use shareable URLs, work without JavaScript, and preserve browser history. A shared contact/resume block appears on Home and About.
- Software engineering and research/consulting resumes have accessible HTML versions and one-page PDF downloads, maintained from one data file. Major project pages retain their problem/contribution openings, dated metadata, and report/code/demo links.
- About reads published CMS content. The unused homepage snapshot and its script are retired. Malformed/incomplete cached work cannot replace a complete cache.
- The public seed reflects the current published collection content. An isolated preview can be created from a fresh checkout without credentials or production records.
- Backups preserve application tables and CMS-referenced media, rebuild FTS, and verify restoration. A separate D1-compatible restore file was imported successfully into a fresh local D1 state; all 46 table counts, SQLite integrity, and zero foreign-key violations were verified.
- Both database repairs are in Wrangler’s migration journal. Fifteen legacy orphan metadata rows were archived before removal. Exact before/after comparisons found all five content collections, every revision, and all settings unchanged.
- Publication now guards the committed tree, CMS rows/settings/revisions, backup, and public artifacts; checks the build; clears the work cache; and verifies live pages and deployed artifact hashes.
- CI seeds the real portfolio before browser checks and audits a built Worker with Lighthouse. Historical Action Pages browser tests remain a separate suite, rather than serving as a misleading portfolio gate.
- Global content fades are removed. Demo inputs remain disabled until their React handlers are ready, preventing an early interaction from being lost during hydration.

## Validation before publication

- Type check: **0 errors, 0 warnings, 72 hints** across 301 files. Hints include existing deprecated event types and unused declarations.
- Unit tests: **1,874 passed** in 47 files; **three Python backup/migration tests passed**.
- Browser tests: **30 passed** across Chromium, desktop WebKit, and mobile Safari. Coverage includes equal homepage prominence, link/reload/history filters, JavaScript-disabled navigation, resume routes/downloads, WIP exclusions, overflow, serious accessibility violations, keyboard skip navigation, and the Molt/Notifications/inflation demos.
- Build passed, with the existing large-chunk advisory retained.
- Built local Worker Lighthouse scores: Home, About, Software Resume, and CharterCostTracker passed in desktop and mobile modes. Performance **99–100**; accessibility, best practices, and SEO **100**. These are local lab measurements, not field performance claims.
- Both resume PDFs were rendered and visually checked as one-page documents. Desktop/mobile portfolio views were inspected in both themes across the implementation pass.
- The production post-migration backup restored successfully. It contains **46 application tables, zero CMS media rows**, and no foreign-key violations. This does not cover unreferenced R2 uploads, Worker secrets, or atomic concurrent writes.

Working, but Uncovered remains excluded. Action Pages remains unfinished. The pending Molt revision remains unpublished and unchanged. No contact or campaign messages were sent. The full historical Action Pages suite, authenticated admin flows, and live third-party integrations are not covered by these results. Roadmap items 3–6 remain follow-up work.

See [the runbook](deploy.md), [resume maintenance](resumes.md), and [the roadmap](portfolio-roadmap-2026-09-25.md).
