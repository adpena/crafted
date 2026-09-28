# Portfolio descriptions and published writing

The teadata highlight now describes its shared data model, query language, cross-year research, transfer flows, and geographic queries. This follows the Civitech resume and Blueprint cover letter reviewed in the owner's Google Drive; the private originals and contact details are not copied into the repository.

The comma.ai highlight says “I’ve been working on comma.ai’s lossy video compression challenge” and retains the historical leaderboard qualification.

The research highlight and practice link now describe **Texas charter schools: 30 years**. This is the existing [Facing Facts report](https://osod.org/facing-facts-charter-schools-in-texas/), whose subtitle is “After 30 years, it’s time for change.” The Civitech resume and Goff Policy cover letter credit Alejandro with all quantitative research and analysis. The project page retains the report's formal title and distinguishes that contribution from the team's writing and design.

The Writing filter includes two published Texas AFT pieces:

- [The Growing Financial Strain of Charter School Expansion on Texas Public Schools](https://web.archive.org/web/20241213163109/https://www.texasaft.org/government/tea/the-growing-financial-strain-of-charter-school-expansion-on-texas-public-schools/), June 27, 2024.
- [The Lost Decade (and a Half)](https://web.archive.org/web/20250123212800/https://www.texasaft.org/lost-decade-and-a-half/), 2024 article and district tables.

Both archived originals returned HTTP 200 on September 28, 2026. Authorship follows the owner's explicit corrections. Curated off-site entries are added after the CMS cache and link directly to the publications. They have no duplicate local article routes.

The Action Pages writing article is excluded from listings, RSS, sitemap, and its direct route. Its promotion on `/action-pages` is removed. The unfinished software project remains available. CMS records, revisions, and the pending Molt draft are preserved without content writes.

## Checks

- Type checking: zero errors and warnings; existing hints remain. Unit tests: 1,877 passed. Production build passed.
- All 36 portfolio browser checks passed across Chromium, WebKit, and mobile Safari. The new writing-link test's accessible-name matcher was corrected to include the displayed year; the other 33 passed initially, and the three affected checks passed on rerun.
- No-JavaScript rendering includes the two external writing links. Browser checks cover article withdrawal from the homepage, experiment page, feed, sitemap, and direct URL.
- The release verifier now checks 17 URLs, including the writing filter and withdrawn article, while preserving its CMS and artifact guards.

CI and publication results are recorded on the pull request. Private backups and deployment receipts remain ignored.
