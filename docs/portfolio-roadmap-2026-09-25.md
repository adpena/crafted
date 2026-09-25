# Portfolio roadmap — September 25, 2026

## Direction

Support engineering applications and research/consulting work equally. Keep one portfolio, with software and research equally visible from the first screen. Use plain, specific first-person writing, with some personality and most technical detail on project pages.

The next pass should deepen the strongest work and make the site easier to maintain. Preserve the existing visual character. A broad redesign, a large new project catalog, and a commitment to regular articles are not priorities.

This is a proposed roadmap, not a record of additional implementation or publication.

## Already complete

The published pass updated the byline, About, current work, project copy, and source links; removed Articles from navigation; added CharterCostTracker, Facing Facts, HB 2, Notifications, and FMTools coverage; and expanded the existing work with data exhibits and hosted demos. Action Pages is described as unfinished and its public samples complete locally without delivery.

Working, but Uncovered remains excluded. The pending Molt draft was preserved, although its old claims need reconciliation before publication.

The preceding implementation pass reported zero type errors/warnings, 1,866 passing unit tests, nine portfolio browser regression tests, and 44 live URL checks with expected responses. The build still reports a large-chunk advisory and type checking reports 72 nonblocking hints. Those results do not establish that every historical end-to-end test, authenticated admin flow, or production integration has been verified.

See [the completed review](./portfolio-review-2026-09-25.md) for the dated publication and verification record. Earlier recommendations in that document are superseded where its follow-through section records completion.

## 1. Preserve the release and make publishing dependable

Do this before another substantial publication.

1. **Review and commit the deployed work.** The working tree still contains the completed pass as modified and untracked files. Identify the intended release files, preserve unrelated changes, and record the Worker version together with the CMS revisions and artifact provenance. A Git commit alone does not preserve D1 content.
2. **Choose one editing source for About and other shared copy.** About currently has hardcoded text alongside CMS/seed versions. Make updates travel through one clear path so a later seed import or CMS edit cannot quietly restore old copy.
3. **Repair or retire the homepage snapshot script.** `scripts/refresh-homepage.ts` converts failed collection requests into empty arrays and writes the result. The current homepage queries content at runtime, so first establish whether the snapshot is still needed. If retained, failed or incomplete reads must fail without replacing a valid snapshot. Update the `ship` command accordingly.
4. **Make publication checks repeatable.** Turn the existing revision guards, protected-draft checks, cache refresh, live-content comparison, and exclusion checks into a documented command. Ensure Working, but Uncovered stays absent from rendered listings, direct routes, RSS, and sitemap.
5. **Track the FTS repair and backups.** The EmDash trigger repair was applied manually, outside the Wrangler migration journal. Establish a versioned migration process and verify the repair survives schema changes. Preserve CMS/media backups and test a restore before depending on them. Do not upgrade the CMS blindly while its schema generation can reinstate the faulty triggers.
6. **Refresh repository guidance.** `CLAUDE.md` still contains older test totals, performance claims, representative-lookup guidance, and Action Pages positioning. Align it with the actual implementation and unfinished status so future edits do not reintroduce removed claims.

**Done when:** a fresh checkout plus documented content restoration can reproduce the intended release, and publication refuses stale or incomplete input instead of silently replacing valid content.

## 2. Give both audiences an equally strong introduction

1. **Curate the first screen.** Use two software examples and two research examples, with Data for Public Education connecting the two. A good starting set is Molt, comma.ai compression, Lost Decade, and CharterCostTracker. DFPE should lead into a specific example of its work. The remaining catalog follows below.
2. **Make the short explanation visible.** Readers should see what each featured project does and what Alejandro contributed without hovering. Keep technical tags secondary to the work itself.
3. **Provide shareable software/research views.** The current filter lives only in session storage. Put filter state in the URL, preserve browser back/forward behavior, and retain a clear All option. An application or client email can then link directly to a relevant selection while the main homepage remains balanced.
4. **Explain the work someone can hire Alejandro to do.** Use specific examples supported by the portfolio: research and analysis, data acquisition and pipelines, funding models, reporting tools, and data-driven web applications. State availability only once confirmed; do not invent consulting packages or client outcomes.
5. **Add maintained resume downloads.** Offer an engineering version and a research/consulting version, with consistent dates and claims. Link the relevant projects directly. A concise HTML background page can remain the accessible starting point.
6. **Use a consistent opening on major project pages.** State the question or problem, personal contribution, deliverable, date/status, and an obvious report/demo/code link. Do not force every small utility into a long case study.

**Done when:** a visitor from either audience can find a relevant project, understand Alejandro's role, inspect an artifact, and reach contact information within two clicks.

## 3. Deepen the work that best demonstrates the range

| Order | Project | Recommended next addition | Important distinction |
| --- | --- | --- | --- |
| First | **Lost Decade and a Half** | Show the original 2024 responsive tables at desktop and mobile widths; preserve a dependable report/article link; recover the actual 2024 dataset for an interactive comparison if available. | The current 1,019-district exhibit is from the original 2022 research. Full authorship, analysis, and responsive-table implementation apply to the 2024 update; the 2022 report was joint work. |
| First | **CharterCostTracker** | Follow one district from public source inputs through the calculation to the generated report. Include an original delivered statement if available, the generated index, and the user-authored Texas AFT article. | The current Austin PDF is a newly prepared portfolio excerpt, not an original client report. Preserve masking and the distinction between observed and estimated transfers. |
| First | **Data for Public Education** | Walk through one released public project: the question, data collection, analysis, usable tool/report, and source code. Clarify which parts Alejandro owns. | The organization description and repository links need one concrete example readers can follow. This is the strongest opportunity to connect software and research. |
| Next | **comma.ai compression** | Add a dated PR 107/110/140 timeline with the contribution and reported evaluation for each. Where reproducible artifacts are available, show an actual submission's input, decoded frame, and segmentation result. | Preserve CPU/CUDA distinctions and historical leaderboard language. The existing Witness Machine diagnostic is not an official submission reconstruction. Do not imply a current rank from a historical report. |
| Next | **Molt** | Produce a clean, pinned build that reproduces the browser artifact; test its browser-host adaptations; then add two or three small, useful precompiled examples. Reconcile the older unpublished draft before publishing it. | The current demo executes real compiled Wasm, but the build came from a dirty checkout and runs one fixed program. Editable browser compilation is a separate, much larger project. |
| Next | **HB 2 support-staff analysis** | Include one of the original customized district PDFs if available for publication. Explain a funding-to-raise scenario with its staffing assumptions. | The public workbook's funding estimate and paraprofessional count differ from the broader staffing denominator used in the newsletter examples. The current Aldine PDF is a new portfolio excerpt. |
| Next | **Facing Facts** | Add one short worked example from source data and matching decisions to a published figure. Keep the report and contributor credits prominent. | Credit Alejandro's quantitative analysis without extending it to all writing, design, and publication work. |
| Later | **Reproq / Reproq TUI** | Record a small real queue run: enqueue, worker execution, retry/failure, and completion. Include a runnable example. | The current TUI exhibit is a labeled golden test fixture, not a recording of a live system. |
| Later | **FMTools / FMRuntime** | Record the native macOS application performing a structured task. Explain the Python/Swift interface through that example and document the actual environment used. | The current example displays public evaluation inputs and expected outputs; it is not live inference. Resolve naming between the separate chat applications before adding more entries. |
| Maintain | **Notifications** | Keep the working mock demo and make a short API usage example easy to find. Add more only if a real use case demonstrates something new. | The demo already exercises the actual dispatcher and deliberately performs no external delivery. |
| Maintain | **Respect Campaign Map / Inflation Calculator** | Improve shareable district/period selections, map legend clarity, keyboard behavior, and source/download presentation. | These are historical datasets. A refreshed series should be a separately dated edition, not a silent overwrite of the original research. |
| Selectively simplify | **Travis County / donor identification / smaller policy items** | Combine overlapping historical entries if the catalog becomes crowded. Add a report excerpt or small synthetic-data example only where it explains a distinct contribution. | Do not expose personal voter/donor records or manufacture a large case study for every utility. |

Prefer original deliverables, screenshots, and short recordings over more descriptive paragraphs. A demo earns its place when interacting with it teaches something that a static artifact cannot.

## 4. Close verification gaps and polish everyday use

### Contact and navigation

- Verify the contact form's success, validation, timeout, and transport-failure behavior with a mock transport. Keep the existing direct email link available. A real delivery test would require an explicitly authorized test message; the previous work did not send one.
- Test the actual route and expected content before accepting any accessibility or interaction result. Several older tests target historical Action Pages fixtures; an empty form list should not count as a successful form check.
- Run the complete existing browser suite against seeded content, repair its fixtures, and extend it to the homepage, About, Contact, project pages, and research exhibits. The nine new portfolio tests are useful coverage, not evidence that the full suite passes.
- Correct the Lighthouse target URLs and establish a working preview server in CI. Measure representative portfolio pages and demos rather than only Action Pages.

### Reading and interacting

- Review small body text, contrast, line length, and spacing on About and project pages in both themes. Increase text size where reading feels cramped.
- Remove or shorten content entrance fades so the work is readable immediately. Preserve optional decorative personality and reduced-motion behavior.
- Check keyboard focus, screen-reader feedback, 200–400% zoom, and narrow-screen reflow. Test dense selectors, table headers, empty search results, and map alternatives explicitly. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) is a useful acceptance reference.
- Check hydration/loading and failure states for the interactive exhibits. Controls should not invite an action that will be reset when the component finishes loading. Preserve static explanations and useful fallback content.

### Speed and sharing

- Measure before changing architecture. Investigate the large-chunk advisory, then reduce or defer the modules that actually affect visitors. The Wasm program already loads on demand; do not repeatedly optimize work the current implementation already does.
- Use field performance where available and lab tests for repeatable diagnosis. Reasonable targets are LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 at the 75th percentile, separately for mobile and desktop. These are targets, not current site measurements. Lighthouse cannot directly measure INP. [Core Web Vitals guidance](https://web.dev/articles/vitals).
- Create accurate social previews for the leading projects using real report figures or demo screenshots. Normalize image URLs, check actual generated metadata for duplicates, and define canonical URLs when adding shareable filter/district parameters.
- Audit existing structured data before adding more. Appropriate person/profile metadata may help describe the About page, but does not guarantee search features. [Google's profile-page guidance](https://developers.google.com/search/docs/appearance/structured-data/profile-page).
- Clean up unused declarations and deprecated types in maintained code opportunistically. Do not bury meaningful warnings or spend a major pass rewriting vendored files merely to make hint counts disappear.

**Done when:** the important pages work by keyboard, on mobile, with larger text, and under failed/slow requests; the checks run against real content and report actionable failures.

## 5. Consider additional projects only after checking the evidence

Resume-supported candidates include **Fully Funded, Fully Respected**, the **TEA commissioner-decisions archive**, and selected **legislative work such as cottage-food legislation**. They need a verified public artifact and a precise role description before becoming standalone entries. They are candidates, not confirmed omissions ready to publish.

Use a simple selection rule: add a project when it shows a distinct capability, has something readers can inspect, and adds more value than strengthening an existing page. Research method, authorship, and implementation matter more than the number of cards.

## 6. Keep the portfolio current without making it another large project

- **At each release:** record code/content versions; validate links and downloads; protect unpublished work; verify cache, sitemap, RSS, and live copy.
- **Periodically:** review current-work wording, project status, resume links, and a small sample of important external artifacts. Validate PDFs as documents rather than trusting HTTP 200 alone; the Lost Decade source review found a truncated archived PDF.
- **When sources change:** retain dated snapshots and provenance. Make corrections explicit instead of mixing newer measurements into an older research exhibit.
- **If analytics would answer a useful question:** measure project visits, demo use, downloads, and contact clicks with minimal first-party events. Do not collect form contents. Use the results to see whether both audiences reach relevant work, not to optimize raw page views.
- **When dependencies change:** make small upgrades, check CMS publication/search behavior, and retain a tested rollback path.

This cadence is a recommendation only; no recurring automation has been created.

## Explicitly deferred

- **Working, but Uncovered:** keep it off the public site, including indirect discovery routes.
- **Action Pages:** keep its unfinished status and safe samples. Repairing its real representative lookup, finishing integrations, or turning it into a product belongs to a separate decision if Alejandro returns to it.
- **Articles:** keep the navigation tab removed. The existing technical article can remain linked from its project; consolidating it later should preserve a redirect. No new publishing schedule is needed.
- **Public compilation service, demos for every repository, and a full visual redesign:** low priority compared with stronger evidence on the leading project pages.
- **Unsupported impact claims:** do not invent reach, savings, adoption, or current leaderboard rank. Distinguish delivered work from a portfolio reconstruction and individual contributions from team results.

## Recommended execution order

1. Preserve the deployed release and fix the publishing/CI gaps.
2. Balance the homepage, add shareable audience views, and make resumes/contact easier to reach.
3. Complete the 2024 Lost Decade exhibit and one original CharterCostTracker walkthrough.
4. Add a concrete DFPE example and improve the compression and Molt evidence.
5. Add selected original HB 2/Facing Facts artifacts and native software recordings as they become available.
6. Measure accessibility/performance and finish targeted polish; evaluate new project candidates only after the strongest existing pages are complete.

Artifact-dependent work can change order: a verified original report already in hand is a better next step than a recording or reconstruction blocked on missing source material.
