# Portfolio case studies: September 28, 2026

The case studies combine original published deliverables with explicitly labeled portfolio exhibits. Live EmDash remains authoritative for their prose. This release adds one `dev/teadata` entry and its revision; verified before/after database copies establish that all pre-existing rows, including the unpublished Molt revision, are unchanged.

## teadata

Pinned source: `adpena/teadata` commit `7b206d8a0fb086fec2176b78bb22bf1530486247`. The input is `examples/campus_stats_district.xlsx` (SHA-256 `60385fd2323dbf3507cc0eb6b8de77eec8ebaee2473b84450ccdb58e3de483d8`). It contains 795 selected D/F-rated district campuses across 217 districts, not a statewide inventory. Ratings are from 2025; beginning-teacher percentages are from 2023–24.

With that source on PYTHONPATH and its Python dependencies installed:

```sh
PYTHONPATH=/path/to/teadata python scripts/build-teadata-exhibit.py /path/to/teadata/examples/campus_stats_district.xlsx src/data/portfolio/teadata-example.json
cp src/data/portfolio/teadata-example.json public/portfolio/teadata-example.json
```

The script constructs actual teadata District/Campus objects and executes twelve reference queries through its `>>` DSL. The browser filters the exported data and is checked against those results. The export removes the library's spreadsheet apostrophe prefix while retaining all nine campus-ID digits. Missing measurements remain null and are excluded, not converted to zero. No geographic operations are needed by this example.

## Lost Decade: 2024 originals, 2022 comparison

The three-page May 2024 PDF was recovered from [this May 16 capture](https://web.archive.org/web/20240516045549/https://www.texasaft.org/wp-content/uploads/2024/05/The-Lost-Decade-and-a-half-2.pdf). The hosted file is unchanged; its cover image is a PDF render.

`recover-lost-decade-tables.py` reads the [January 23, 2025 capture](https://web.archive.org/web/20250123212800/https://www.texasaft.org/lost-decade-and-a-half/) and preserves its two responsive layouts, each with 1,209 district labels. It removes the external font request and workbook link targets, darkens the blue labels for accessible contrast, adds a restrictive CSP, and makes no data claims beyond the recovered index. Browser checks cover both sides of its 750px breakpoint. The earlier 1,019-district 2022 explorer is now inside an explicitly dated disclosure.

**Still needed:** original 2024 district salary workbooks to reconstruct a 2024 data explorer. Drive searches for Lost Decade and salary found related application and writing materials, but no original workbook in that scope. The Austin workbook's former SharePoint link currently returns `UnlicensedPersonalSiteArchived`. The report, article, and table layout remain available without it.

## CharterCostTracker

The hosted Word file is byte-identical to the Austin ISD original at `adpena/CharterCostTracker` commit `b9123138fcbd2e3f3e51fffd0ed64ff688cd206e`, Git blob `d7d9b7e16343e63ccfcc1c5d0136ceef61be5697`. Its one-page rendering was inspected. It covers 2019–20 through 2023–24 and cites preliminary 2023–24 finance inputs accessed May 19, 2024.

The five printed estimates sum to $624,927,517. The last year's 12,636 observed transfers divided by enrollment of 72,830 gives 17.35%. The code's estimate is selected formula revenue / refined ADA × (refined ADA / enrollment) × observed transfers. Masked transfer counts are excluded from this original version. This is an estimate, not an audited transfer ledger.

Keep it separate from the later June 21, 2024 one-year export used in the existing explorer and its newly constructed PDF excerpt. The Molt transfer example uses the original report's observed counts and computes shares only.

## OSOD's thirty-year report

Page 5 of [Facing Facts](https://osod.org/wp-content/uploads/2025/02/Facing-facts_digital_02.26.pdf) prints central-administration expenditure shares of 6.8% for districts and 10.3% for charters. The source check retrieves TEA Snapshot 2023 district and summary files from the official download form. `build-osod-exhibit.py` documents exact form parameters and field names and produces the hosted CSV and calculation receipt.

Weighting each entity's rounded central-administration percentage by operating expenditures gives 6.8343% (1,020 usable district records) and 10.2886% (184 usable charter records). Five records lack usable finance values. This reproduces the published rounded shares approximately; it does not recover exact administrative dollars from rounded percentages.

**Date correction:** the report labels the comparison 2022–23, but TEA's layout identifies the financial fields as 2021–22. The portfolio now uses that financial year and explicitly explains the difference. The original report has not been altered. The 3.5 percentage-point gap is about 51% relative to the published district share; it is not a per-student spending comparison.

## Molt and comma.ai

See `molt-demo-architecture.md` for the clean pinned build, browser-host changes, and three examples. `public/molt-compiled/provenance.json` records current hashes and tool versions. The second word-counter build matched the first byte-for-byte; all three outputs are compared with CPython in each browser target.

The compression timeline uses PR creation dates, not dates of leaderboard appearance. The three archive downloads matched their public SHA-256, byte counts, and ZIP CRCs on September 28. `public/portfolio/compression-archives.json` records that check. CPU and CUDA reports stay separate. The exhibit links the submitted artifacts and credits upstream representations; it does not claim a fresh evaluation or show synthetic reconstructions as decoded archive frames. A full decoded-video comparison would require running the corresponding pinned runtimes and evaluation environments, including T4 CUDA for PRs 107 and 140.

## Social cards and release checks

`node scripts/build-project-cards.mjs` renders nine project-specific SVG/PNG previews at 1200×630 using text and vectors. No model-generated imagery is used. The release guard now includes every public OG asset and the six featured case-study routes, alongside the existing CMS/draft/artifact checks.

Local validation before publication: 1,890 unit tests; 42 portfolio browser checks across Chromium, WebKit, and mobile Safari; type checking with zero errors and warnings; successful production build. Accessibility coverage includes all six featured case studies and the standalone restored index. The sandboxed iframe is excluded from parent-page injection and its document is audited directly. Existing informational type hints and the framework's large-chunk build advisory remain.

The first deployment check detected Cloudflare's JavaScript Detections script appended to the static district-index HTML. That document is deliberately script-free and sandboxed. Its two static URL forms now use a narrowly scoped `Cache-Control: no-transform` header, which [Cloudflare documents](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/#if-your-origin-sends-a-no-transform-header) as preserving the response body. The release verifier continues to require an exact byte hash; it does not strip scripts or normalize HTML. Other site routes retain their existing edge behavior.
