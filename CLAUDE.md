# Crafted — repository context

Alejandro Peña’s portfolio at https://adpena.com, built with Astro 6, EmDash 0.1.0, React islands, and Cloudflare Workers/D1/R2/KV. Software and research have equal prominence. Write plainly, specifically, and in first person; use technical detail where it explains the work.

## Content and scope

- Live D1 is authoritative for the About bio, shared site settings, and the `dev`, `policy`, `design`, and `writing` collections. The homepage’s selected examples and layout are maintained in code.
- `seed/seed.json` is a published-content snapshot for fresh previews, not a production update mechanism. Never reseed live D1 to update copy.
- Public resumes share `src/data/resumes/profile.json`. The accessible HTML pages and downloadable PDFs must agree. See `docs/resumes.md`.
- Working, but Uncovered must remain absent from public listings, direct routes, RSS, and sitemap. Keep the exclusion in `src/lib/portfolio-content.ts` even if CMS state changes.
- Action Pages is an unfinished experiment. Do not promise completion, describe every adapter as verified, or restore old price/performance claims. Public samples complete locally without external delivery.
- Preserve the unpublished Molt revision. EmDash `content get` can return that draft; compare `--published` and default reads before any content update. Use the exact `_rev` token for a write. CLI updates publish automatically unless `--draft` is supplied.
- Full authorship, analysis, and responsive HTML table work apply to the **2024** Lost Decade and a Half. The 2022 report was joint work, and the hosted 1,019-district exhibit is the older dataset. Alejandro wrote the June 2024 CharterCostTracker Texas AFT article.
- Keep historical comma.ai leaderboard language and CPU/CUDA evaluations distinct. Portfolio reconstructions and fixtures must remain labeled.

## Development and checks

Use Node 22 (`.nvmrc`) and Python 3.10+. `.npmrc` disables install scripts; explicitly rebuild `better-sqlite3` for the current Node version before using the EmDash CLI. Newer Node releases are not a substitute for this tested runtime.

```sh
npm ci
npm rebuild better-sqlite3 --ignore-scripts=false
npm run preview:seed
PORTFOLIO_TEST_STATE=.portfolio-release/test-state npm run dev
```

The preview seed refuses to overwrite an existing state directory and never writes remote D1. To create another preview, choose a new `--state` directory. See `docs/deploy.md` for the complete publishing/restore workflow.

- `npm run typecheck` regenerates Worker types and checks site/plugin code.
- `npm test` runs site/plugin unit tests. `npm run test:backup` exercises real SQLite restoration, FTS, and the metadata migration.
- `npm run test:e2e:portfolio` covers the actual portfolio and three runnable demos in Chromium, WebKit, and mobile Safari. Use the isolated state environment variable above.
- `npm run build && npm run lighthouse` audits the built Worker on port 4322 against the isolated seed, on desktop and mobile.
- `npm run test:e2e:all` retains the historical Action Pages suite. It is separate from the portfolio release gate: unfinished product routes/fixtures and authenticated production integrations are not established as passing by portfolio checks.

Keep validation counts and deployment receipts in dated release notes, not in permanent product claims. The large bundle advisory needs measurement before optimization; do not suppress it to claim a warning-free build.

## Publication

Commit the release, run `npm run release:prepare`, then `npm run ship`. Preparation creates a private verified backup and hashes live/draft content, settings, revisions, and public artifacts. Shipping refuses an uncommitted tree or changes since preparation; it checks types/tests/build, deploys, clears the work cache, and checks live routes. It does not edit CMS content or apply database migrations.

Backups and release receipts contain private CMS information and belong only in ignored `backups/` and `.portfolio-release/`. Never commit them or put them in `public/`. Public provenance lives in `docs/` and `public/portfolio/`.

## Code map and platform details

- `src/pages/index.astro` and `WorkListing.tsx`: balanced introduction, runtime CMS reads, `work-sections-v2` KV cache (60 seconds), shareable `?focus=software|research|writing` filters.
- `src/styles/global.css`: shared CSS, themes, responsive layouts. Content is readable immediately, without an entrance fade.
- `src/components/ProjectArtifacts.astro`: source-backed project exhibits. Molt runs a precompiled Wasm program; Notifications uses the actual dispatcher with mock transports; the inflation calculator uses a dated CPI snapshot.
- `plugin/`: Action Pages source and admin code. Maintained as an unfinished experiment, not a completed campaign product.
- `src/lib/auth.ts`, API routes, and plugin tests describe the actual security/transport behavior. Do not infer verified delivery from an adapter’s existence.
- EmDash 0.1.0 can generate faulty external-content FTS update/delete triggers. Read `migrations/README.md` before schema changes. Do not blindly upgrade or reseed to fix search.
- Astro v6 request context uses `locals.cfContext.waitUntil()`. Inspect current types before assuming older runtime APIs.
- Prefer global CSS for shared components; earlier scoped assets with `@` in their names were served incorrectly by Workers.
- Representative lookup in the unfinished Action Pages experiment is not a confirmed working integration. Do not reintroduce the obsolete ProPublica recommendation.
