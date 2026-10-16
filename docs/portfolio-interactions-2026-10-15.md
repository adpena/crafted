# Portfolio interaction and responsive-layout pass

This pass addresses the portfolio interface and its browser coverage. Research values, source files, CMS entries, and unpublished revisions are unchanged.

## Changes

- Exhibit inputs and selects use 16px text and a minimum 44px target. Custom select appearance lets WebKit honor the height while preserving the native select control. Disclosures, demo buttons, and artifact links also have larger targets.
- Wide campus and research tables retain native table semantics. Overflowing tables show a hint, left/right controls, and a focusable region with arrow-key scrolling. The controls disappear when the table fits, and wrap when text is enlarged. Campus identifiers stay on one line.
- District search trims whitespace, distinguishes matching options from the district being displayed, and explains empty results. Clearing the search restores the options. Map and select interactions update the same comparison and announce the selected district.
- Molt examples can be stopped, retried after a worker failure or timeout, and run repeatedly. Cancellation terminates the worker and restores focus to Run. Source previews have loading, failure, and retry states independent of execution.
- Interactive controls wait for hydration. With JavaScript disabled, exhibits explain their limitations and retain initial results, source links, or downloads.
- The theme toggle exposes its pressed state, follows system changes until a preference is selected, and continues working when storage is blocked. It stays hidden without JavaScript. The page canvas has an explicit theme background for mobile Safari.
- Action Pages' document styles are scoped to its own body class. Its unscoped body rules had been overriding the portfolio's colors and font in development.

## Coverage

`npm run test:e2e:portfolio` includes the existing portfolio/artifact checks and `e2e/tests/portfolio-interactions.spec.ts`. Projects cover Chromium, Firefox, WebKit, mobile Chrome, mobile Safari, and tablet Safari. Checks include:

- 320, 768, and 1440px layouts and 200% text size; element bounds are checked directly because page-level overflow can be hidden by CSS.
- Table scrolling and empty-filter recovery; district search, real SVG pointer/touch selection, and comparison updates.
- Keyboard disclosure, theme, table, and skip-link behavior; homepage filter/history navigation.
- Worker startup failure, cancellation, timeout, retry, repeated execution, and source-preview failure/recovery.
- Calculator validation, local notification outcomes, disabled-JavaScript content, blocked browser storage, and dark-mode/reduced-motion accessibility states.
- Native contact-field validation with third-party verification blocked and no message submission.

These profiles exercise browser engines and emulated device settings. They do not establish physical-device, assistive-technology, external delivery, or authenticated Action Pages integration coverage. The historical Action Pages suite remains a separate gate.

Private screenshots and execution logs are kept under `.portfolio-release/evidence/`; release backups and deployment receipts remain in their existing ignored locations. Use the publishing workflow in [deploy.md](deploy.md).
