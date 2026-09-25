# Portfolio review — September 25, 2026

## Editorial direction

The agreed voice is plain, specific, and in first person, with some personality. Keep most technical detail on project pages. Let the work supply the argument: what the question was, what Alejandro did, what was produced, and where a reader can inspect it.

The main problems were repeated introductions and conclusions, generic headings, and promotional claims that had drifted from the implementation. The project descriptions added in the earlier portfolio pass also needed tightening.

| Before | Revision |
| --- | --- |
| “Research that reaches its audience” | Name the actual report, workbook, map, or recipient. |
| “Making inflation concrete” | Tell the reader to enter an amount and choose two periods. |
| “My role spans project scoping…” | “I handle the research, data collection, analysis, and software development.” |
| “Production-hardened”, “<100ms global”, “Deploy your own in minutes” | Describe the implemented form pipeline and link to setup instructions. |
| “The portfolio tracks this project as alpha software” | “Reproq is in alpha.” |

Keep useful technical terms such as PostgreSQL, WebAssembly, and record matching. Explain specialized compression terms through the problem they solve. Avoid turning every small utility into a three-section case study.

## Changes in this pass

- Rewrote the About copy in first person. Made the biography and contact link readable immediately, including without JavaScript; the terminal-name animation remains.
- Revised 15 CMS entries: About, eight development entries, the design entry, four policy entries, and the Action Pages article.
- Lost Decade now explicitly credits full authorship, all analysis, and responsive HTML tables for the 2024 update. It links to the 2024 report and article/tables, the original 2022 joint report, and Every Texan’s original announcement.
- CharterCostTracker retains its engineering detail, mentor’s methodological contribution, distinction between observed and estimated transfers, and credit for writing the full June 2024 Texas AFT article.
- Added links to the HB 2 support-staff analysis and Facing Facts under Data for Public Education, Reproq TUI under Reproq, and Witness Machine under the compression project.
- Simplified the Action Pages landing page and embed instructions. Removed the unsupported competitor comparison, prices, latency promises, and inconsistent test/integration counts.
- Rewrote the Action Pages article around the actual submission route. It no longer says Turnstile is always enforced, that the request makes no external API calls, or that a stored submission guarantees delivery to integrations.
- Corrected the Molt preview’s JavaScript/Wasm labeling, including the embedded frame’s accessible title. Published Molt copy follows the current repository’s limited compatibility claims.
- Labeled the six seeded campaign pages as portfolio demos using sample content.
- Marked Action Pages as an unfinished experiment, removed it from the homepage highlights and pinned entries, and removed production-use positioning.
- Fixed publication-month formatting to use UTC, so May 1 records do not appear as April in the local time zone.

The existing unpublished Molt draft is preserved byte-for-byte. It still contains old compatibility, size, and target claims; it should be reconciled before anyone publishes that draft over the revised live copy.

## Lost Decade source checks

The original Texas AFT URLs now return 404. Search-engine text still exposes those old pages, so a search result alone was insufficient to establish a working link.

The current Texas AFT legislative-agenda page offers a download under the heading “The Lost Decade (and a Half)”, but its PDF is the **2022** report. The March 2025 Wayback capture of the 2024 PDF is truncated at 5,242,880 bytes and fails PDF parsing. Neither is used as the 2024 download.

The May 2024 capture contains the complete 5,332,743-byte, three-page report and parses successfully. The January 2025 archived HTML page preserves the article and the wide/narrow district-table layouts. Links inside that archived page were not all individually verified.

- [2024 report, complete archived PDF](https://web.archive.org/web/20240516045549/https://www.texasaft.org/wp-content/uploads/2024/05/The-Lost-Decade-and-a-half-2.pdf)
- [2024 Texas AFT article and district tables](https://web.archive.org/web/20250123212800/https://www.texasaft.org/lost-decade-and-a-half/)
- [2022 report, Texas AFT and Every Texan](https://everytexan.org/wp-content/uploads/2022/04/The-Lost-Decade-final.pdf)
- [Every Texan’s April 2022 announcement](https://everytexan.org/2022/04/19/new-joint-report-by-texas-aft-and-every-texan-highlights-declining-teacher-salaries/)

The 2024 attribution also agrees with the writing-sample attribution document in Drive and Alejandro’s explicit instructions. Sole authorship of the 2024 update must not be applied to the 2022 joint report.

## Best missing work items

These were the initial recommendations. The follow-through below records which entries and exhibits were subsequently added.

| Priority | Project | Why it belongs | Useful deliverable or demo |
| --- | --- | --- | --- |
| 1 | Facing Facts: Charter Schools in Texas | A substantial published policy-research result. The Civitech resume attributes the quantitative analysis to Alejandro. Keep it distinct from CharterCostTracker’s acquisition and reporting software. | Link the published report; show one sourced figure and a short account of the underlying dataset and analysis. Credit the report’s other contributors. |
| 2 | HB 2 support-staff raise analysis | A clear example of turning a statewide funding formula into local organizing material: 1,179 school systems and 35 customized PDFs, as described in the resume. It is distinct from the 2023 SB 9 teacher-pay work. | A district selector, statewide workbook, and one sample district PDF. Label results as scenarios under stated funding and staffing assumptions. |
| 3 | Notifications | A reusable TypeScript library with independent value beyond Action Pages. Its public README documents parallel dispatch, timeouts, returned failures, and multiple adapters. | A local mock dispatch panel: choose channels, inspect payloads, simulate a timeout. It should send no real messages. |
| 4 | FMTools / FMRuntime and local chat | Adds Swift, Python, FFI, structured generation, and desktop work to the portfolio. | A short macOS screen recording and one structured-extraction example. Confirm current product naming: the public `fmchat` repository describes SiliconRefineryChat, while `fmtools` documents a separate FMChat surface. |
| Excluded | Working, but Uncovered | Alejandro clarified that this is a work in progress and must stay off the portfolio. | No entry or demo is published. The prepared entry was removed from the seed and local preview before deployment. |

Sources: [Facing Facts](https://osod.org/facing-facts-charter-schools-in-texas/), [HB 2 analysis](https://www.texasaft.org/post/maximizing-house-bill-2-s-promise-support-staff-raises-new-texas-aft-analysis), [Notifications](https://github.com/adpena/notifications), [FMTools](https://github.com/adpena/fmtools), [the current fmchat README](https://github.com/adpena/fmchat), [Working, but Uncovered](https://github.com/adpena/tx-working-but-uncovered).

Other resume-supported candidates are Fully Funded, Fully Respected, the TEA commissioner-decisions archive, and legislative work such as cottage-food legislation. They need a focused description of Alejandro’s role and a public artifact before becoming strong standalone entries. Private code should not be labeled open source merely because a project appears in a resume.

## Enhance and simplify existing entries

1. **Lost Decade:** add a small district comparison using a dated, verified dataset. Show nominal and inflation-adjusted pay, years, and source. A screenshot of the original responsive tables would show the web work more directly than another paragraph.
2. **CharterCostTracker:** show a sample statement of impact beside its source inputs and generated HTML index. This would demonstrate the full acquisition-to-publication workflow. A bounded sample is preferable to exposing an enormous raw archive.
3. **Reproq:** include a screenshot or short recording of Reproq TUI. It belongs under the existing entry, not a second nearly identical card.
4. **Compression:** keep the three PR links prominent. Add a frame/segmentation comparison and a size-versus-distortion explanation with an explicitly identified submission. Witness Machine is a good related notebook, but its demonstrations are not official comma.ai scores.
5. **Respect Campaign Map and Inflation Calculator:** both have static interfaces in their repositories. A maintained hosted preview would be useful; currently the map’s “View” link opens GitHub and the calculator has no live URL.
6. **TCDP donor identification:** keep the short historical description. Consider folding it into the Travis County entry if the work list becomes crowded.
7. **Action Pages article:** retain it as a technical note linked from the project, or consolidate it into the project page later. The Articles navigation tab is gone, but `/articles`, RSS, and the Writing filter still expose the article; removing the tab did not delete those routes.
8. **Homepage:** keep a small set of highlights. Consider moving Lost Decade and CharterCostTracker into the leading work rows alongside Molt, compression, and Data for Public Education. A longer catalog is less useful than a few entries with visible artifacts.

## Functional/demo findings

Action Pages is an unfinished experiment that Alejandro may not resume. It remains in the work list with that status and has been removed from the homepage highlights. The Action Pages items below are notes for **if it is revived**, not recommended near-term work.

These findings came from read-only inspection. Forms were not submitted, messages were not sent, and external integrations were not exercised.

| Priority | Finding | Recommended next step |
| --- | --- | --- |
| High | The in-site Molt demo uses a JavaScript Mandelbrot worker. Python text is parsed for parameters; the compile button is disabled. | Wire in a real compiled artifact or compilation service and show the executed code and output. The labels are corrected in this pass. |
| High | `/api/action/reps?zip=78701` returns an empty representative list. The source still references ProPublica and maps ZIP to state, not a verified House district. | Replace and test the lookup before presenting the letter/call flow as complete. Accurate district lookup needs more than state-level matching. |
| Medium | The town-hall sample links to nonexistent Mobilize, Eventbrite, and Facebook events; all three returned 404. Its displayed event date is in the past, and its displayed time differs from the prose. | Replace with consistent sample event data, remove invented external event URLs, and specify the event’s time zone. |
| Medium | Sample campaign copy includes stale factual claims, fake committee details, and an election countdown needing review. | Treat these as explicitly fictional product examples. Add a demo mode that cannot send messages, store personal submissions, or start a donation flow before encouraging people to submit forms. |
| Medium | Turnstile is optional in the current submit route, contrary to the previous article’s “fail-closed” implication. | Decide the intended production enforcement policy and test missing-token behavior separately from this editorial update. |

## Review coverage and verification

Reviewed the homepage, About, Contact, Articles, all published work entries, Action Pages, its embed generator, six seeded campaign pages, and the Molt demo. The crawl requested 28 URLs, including the Action Pages redirect and an intentional 404 check. It checked 27 unique existing external links; the three fake event links and old Lost Decade PDF returned 404.

Source review included the current CMS rows and Molt draft, local implementation, the Civitech resume/application answers, writing-sample attribution, Texas AFT/Every Texan/OSOD publications, the public GitHub repository inventory, and targeted READMEs. This is an editorial and portfolio review, not a full audit of all 115 repositories, translated campaign variants, authenticated admin screens, security, or external-service behavior.

Validation included seed validation, CMS migration guards against stale edits, preservation of the pending Molt draft, and browser checks on desktop and mobile.

## Error fixes and final verification

All 121 original type-checking errors are resolved. Cloudflare resource types are generated from the Wrangler configuration before type checking, optional secrets have explicit types, and routes no longer erase their binding types into generic records. Scripts use module scope; integration mocks and component props now match their contracts. Lighthouse's missing dependencies are installed. CI now runs the full site/plugin type check and unit suite before building.

The error pass also corrected functional issues:

- The email unsubscribe route and bulk-send suppression checks now share the configured `CACHE` binding. A local test follows an unsubscribe through a subsequent send and verifies that the recipient is skipped with no network call.
- RSS sorts year-only and fully dated entries on the same timeline, handles project ranges such as `2024–present`, and omits malformed dates. RSS and sitemap normalize untyped CMS metadata before serializing XML.
- The site's sitemap is registered once, resolving the EmDash/Astro route collision. It includes `/work` and the portfolio's static pages.
- Email-composer responses are validated before updating the UI. An ambiguous send result tells the operator to check delivery status before resending.
- The CMS publication failure was traced to faulty EmDash 0.1.0 external-content FTS5 update/delete triggers. The repair in `migrations/0001_repair_emdash_fts.sql` uses old row values, rebuilds the three affected search indexes, and checks their consistency. All 15 editorial updates were then verified in the published CMS rows; the pending Molt draft was preserved exactly. The migration README documents when reapplication may be needed.

Final checks on September 25, 2026:

- `npm run typecheck`: **0 errors, 0 warnings** across 273 files. Astro still reports 51 nonblocking hints, primarily unused declarations.
- `npm test`: **1,857 passing tests across 43 files**, including regression coverage for the actual FTS repair SQL, metadata normalization, email-response validation, and shared unsubscribe suppression.
- `npm run build`: passed. The duplicate-route warning is gone; Vite's existing large-chunk advisory remains.
- `git diff --check`: passed.
- Production Worker version: `7aa78459-8d8c-41cf-9315-d6e024a420ce`.
- Live crawl: 30 URLs, with 29 successful responses after redirects and one intentional 404. All six seeded campaign pages show the sample-content notice.
- Live RSS: 14 items, valid dates in descending order, including Data for Public Education. Live sitemap: valid XML with 19 URLs.
- Browser checks: About is readable immediately on mobile; homepage highlights exclude Action Pages; Action Pages displays its unfinished status; Lost Decade shows May 2024 and the authorship/report links; Molt is labeled as a JavaScript preview. No browser errors or horizontal overflow appeared in the checked desktop/mobile views.
- All 11 newly added external links returned HTTP 200. The archived May 2024 Lost Decade PDF was also downloaded and successfully text-extracted to distinguish it from a truncated later capture.

The unfinished Action Pages features listed above remain project limitations. These checks did not send live messages, make donations, exercise production integrations, or complete the experimental product.


## Follow-through on the approved recommendations

Alejandro approved the remaining portfolio updates, then explicitly excluded **Working, but Uncovered** because it is a work in progress. It was removed from the publication manifest, seed, and local preview. The production database had no entry for it before publication.

Four new work items were published:

- **Facing Facts:** credits the quantitative research and analysis, distinguishes that role from the report team's writing/design/publication, and links the OSOD report. A figure reproduces the 2022–23 central-administration expenditure shares on page 5: 6.8% for districts and 10.3% for charters. Both values were checked against the rendered PDF.
- **HB 2 support-staff analysis:** explains the work across 1,179 school systems and the 35 original customized PDFs. Its district selector uses all three tabs of the public comparison workbook: 1,180 rows, with one identical duplicate removed. It distinguishes estimated allotment funding and the workbook's paraprofessional staffing count from the broader support-staff denominator in the newsletter's raise examples.
- **Notifications:** a working demo uses the actual 0.1.0 dispatcher with local mock adapters. Users can simulate delivery, failure, timeout, and an unconfigured channel. No credentials or external delivery are involved.
- **FMTools & FMRuntime:** describes the Python/Swift/FFI work and identifies FMChat under the correct repository. The interactive example displays three public evaluation inputs and their reference outputs; it does not claim to perform live inference or substitute for a native-app recording.

Existing work now has inspectable artifacts:

- **Molt:** the demo runs a freshly compiled Python Mandelbrot program as WebAssembly in a browser worker. It includes the exact source, binary, and a build record. The local development checkout was dirty, so the record gives artifact/host hashes and does not claim that its HEAD commit alone reproduces the build. Two browser-host adaptations expose the VFS as an ES module and forward the linked module's isolate self-import, following the existing Node host. The executed output matches CPython exactly in the browser tests. This is a fixed program compiled ahead of time; arbitrary browser compilation is not offered. The old unpublished Molt draft is retained.
- **Lost Decade / Respect Campaign Map:** a district comparison and hosted map use 1,019 records from the original 2022 research dataset, covering 2009–10 to 2020–21 in 2021 dollars. Missing values remain missing, and the boundaries are labeled historical and simplified. Nominal salary amounts were not invented from percentage-change data. The existing 2024 authorship, report, article, and responsive-table links remain prominent.
- **Texas Inflation Calculator:** a hosted calculator uses the original archived CPI data, deduplicated from 394 matching rows to 197 monthly observations, January 2007–May 2023. It does not extrapolate beyond that range.
- **CharterCostTracker:** a district selector shows 1,020 rows from the June 21, 2024 export, alongside the original generated report index and downloadable data. Masked enrollment counts are preserved rather than treated as zero. This one-year row count is distinguished from the full project's 1,023 districts across five years.
- **HB 2 and CharterCostTracker:** new, one-page Aldine and Austin workbook excerpts are downloadable. Both explicitly identify themselves as newly prepared portfolio exhibits, not the original client reports. Their figures come directly from the published exports; the script is `scripts/build-portfolio-excerpts.py`.
- **Reproq:** the project shows the TUI's actual golden test fixture, clearly labeled as sample metrics rather than a live queue or screen recording.
- **Compression:** the page explains the three score terms using the rounded public component reports for PRs 107, 110, and 140. CPU and CUDA evaluations are identified separately. The frame/segmentation pair comes from a public Witness Machine diagnostic and is explicitly separate from those submissions and official scores.
- **Homepage:** Lost Decade and CharterCostTracker now lead the policy rows; CharterCostTracker joins Molt, compression, Lost Decade, and Data for Public Education in the highlights.

The data and image snapshots have source URLs, Git blob identities, SHA-256 hashes, transformation notes, and output hashes in `docs/portfolio-data-provenance.json`.

The Action Pages cleanup keeps the project unfinished. All eight reserved public samples now use local mock form responses, fictional representatives, and explicit completion notices. Donation navigation, external event links, calendar exports, and sharing are disabled for the samples. A server-side guard also prevents older clients from storing or dispatching submissions to reserved sample slugs. Sample copy, event date/time zone, fake committee details, and two broken photo links were cleaned up. The admin preview uses the same local request behavior. These changes do not complete the real representative lookup or impose a new production Turnstile policy.

TCDP donor identification remains a short historical entry, and the Action Pages technical article retains its existing URL. Other suggested research projects were not added without a clear public artifact and role description.

### Follow-through verification

- Type check: 0 errors, 0 warnings; 72 nonblocking hints, mainly unused declarations in browser-host files and older code, plus deprecated React type names.
- Unit tests: 1,866 passed across 46 files.
- Browser regression tests: 9 passed across Chromium, WebKit, and the mobile Safari profile. Tests compare real Wasm output with CPython, exercise mixed notification outcomes, and check historical calculator inputs.
- Additional browser checks covered the new pages/exhibits on desktop and mobile, all eight sample campaign pages, and local-only letter/donation completion. No horizontal overflow, broken images, or uncaught browser errors remained in those checks.
- Both generated PDFs were rendered and visually inspected; their source figures and one-page layouts were checked.
- Production build and `git diff --check` passed. The pre-existing large-chunk build advisory remains.
- Publication uses eight guarded CMS revisions: four new entries and four existing-entry updates. The guards check versions, timestamps, content, and revision pointers before writing.

Production verification after publication:

- Worker version: `57af478b-48af-4103-a3d3-14ddf54502c6`.
- All eight expected CMS revisions match their published content and revision IDs. The pending Molt draft's entire stored row is unchanged from the pre-publication snapshot.
- Live crawl: 44 URLs, including all public work/demo routes, eight sample campaign pages, CSV/PDF downloads, social-card fallback, and the intentionally absent Working, but Uncovered route. All returned the expected status.
- Sitemap: 27 URLs. RSS: 18 items. Neither contains Working, but Uncovered; its work route returns 404.
- All eight live Action Pages samples pass the image, overflow, and exception checks. The letter and donation examples complete locally without delivery requests or donation navigation.
- The live Molt worker produced all 28 output rows in the checked browser. Cloudflare's automatic security/analytics traffic is excluded from the mock-delivery request checks; it can prevent the page from reaching a generic network-idle condition.
- The final live exhibit/browser run passed all 18 checks, including exact Molt output, mixed Notifications outcomes with no delivery requests, and mobile layouts.
