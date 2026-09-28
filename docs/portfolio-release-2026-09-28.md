# Portfolio release: spacing and EmDash 1

The homepage's Data for Public Education label inherited an extra rule, the resume links created an oversized empty column, and work rows were inset from their headings. This release gives the sections consistent spacing, places resume/contact links together, aligns work rows with their headings, and removes the left hover rule. Links retain 44-pixel targets and the work index stacks on small screens.

teadata joins Molt and comma.ai in the software highlights, linked directly to its [public repository](https://github.com/adpena/teadata). Its description follows the repository's district/campus models, data enrichment, transfer queries, and spatial lookups. Facing Facts becomes the third research highlight. Software and research keep equal space.

## Dependency and API changes

All direct runtime/development dependencies and CI actions were checked against their latest stable releases on September 28, 2026. The root lockfile pins EmDash and its Cloudflare adapter to **1.0.1**, Astro to **7.3.5**, React to **19.3.0**, and Wrangler to **4.143.0**. Node **22.23.3** was used locally. `npm outdated` returned no updates and `npm audit` reported zero vulnerabilities.

- Remove the obsolete sitemap injection workaround and internal Vite imports. Keep collection sitemap URLs on the site's filtered sitemap so excluded work stays excluded.
- Guard Astro cache calls and let EmDash generate the social image tags once.
- Update native plugin capabilities and route contexts. JSON routes use EmDash's new `pluginResponse` contract; script routes redirect to Astro asset endpoints because the CMS raw API disallows executable content. Move the existing loader out of Astro's ignored underscore directory and retain its old URL as a redirect.
- Keep production migrations explicit (`runtime: "check"`). A public request cannot apply a database upgrade.
- Restore EmDash 1's stored full-text indexes through its insert triggers; preserve subsequent update/delete triggers. Retain support for old external-content FTS backups.

## Validation

- Type checking: **0 errors, 0 warnings**, with existing hints retained. Production build passes; the existing large-chunk advisory remains visible.
- **1,876 unit tests** and **five Python backup/migration tests** pass.
- **33 browser checks** cover Chromium, desktop WebKit, and mobile Safari, including three runnable demos, filters/history, keyboard navigation, no-JavaScript pages, overflow, accessibility, WIP exclusions, and the real plugin HTTP response boundary. Light/dark screenshots are attached to the browser report.
- Local Lighthouse audits cover Home, About, Software Resume, and CharterCostTracker, with three samples per page/device. Desktop/mobile median performance, accessibility, best practices, and SEO were **100**. These are lab results, not field measurements; CI retains its own reports for the final commit.
- A complete production backup was upgraded in an isolated local D1 database. All **64 revisions**, original settings, credentials, plugin records, and content identities were preserved. Migration 079 normalized **20 date cells** to equivalent UTC strings. The comparison rejects other content changes.
- The upgraded **76-table** backup restored into both SQLite and a fresh local D1 state, with valid integrity and zero foreign-key violations. There are zero CMS media rows in the source.
- On the disposable migrated copy, authenticated draft creation/editing/publication/deletion, public search visibility, media upload/download/deletion, the admin login page, and plugin route responses were exercised successfully. Fixtures and test credentials were local only.

## Publication

Apply the reviewed core migrations after a fresh verified backup, compare pre/post-upgrade content with `scripts/verify-emdash-upgrade.py`, then prepare and ship the committed release as described in [the runbook](deploy.md). Deployment receipts and private database backups remain ignored; the PR records the actual publication result.

Working, but Uncovered stays excluded. The pending Molt draft is preserved. Action Pages remains an unfinished experiment; these checks do not establish that its complete historical suite or live integrations work. No contact or campaign messages were sent.
