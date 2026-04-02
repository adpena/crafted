# Crafted — Claude Context

Personal portfolio for Alejandro Peña. Built on emdash CMS + Astro 6 + Cloudflare Workers.
Live at https://crafted.adpena.workers.dev

## Architecture

- **Site**: Astro 6, emdash CMS integration, Cloudflare D1/R2/KV
- **Plugin**: `plugin/` — Campaign Action Page engine (emdash standard-format plugin)
- **Data**: `data/disclaimers/` — FEC + 10 states political ad disclaimer dataset
- **Styles**: `src/styles/global.css` — single source of truth for all shared CSS

## Collections (four domains)

| Collection | Slug | Key fields |
|-----------|------|-----------|
| Development | `dev_projects` | title, summary, content, repo_url, live_url, stack, language, year, project_status |
| Design | `design_work` | title, summary, content, featured_image, gallery, client, medium, year, live_url |
| Policy | `policy_work` | title, summary, content, publication, date, topic, link, pdf_url, coauthors |
| Writing | `writing` | title, summary, content, publication, date, topic, link, excerpt |
| Pages | `pages` | title, content |

## Adding content

### Via seed file
Edit `seed/seed.json`, run `npm run bootstrap` locally, export and push to remote D1.

### Via remote D1
```bash
wrangler d1 execute crafted --remote --command "INSERT INTO ec_dev_projects ..."
```

### Via emdash admin
Visit https://crafted.adpena.workers.dev/_emdash/admin

## Shared CSS classes (global.css)

Use these instead of writing new styles:
- `.page` — standard content wrapper (42rem centered)
- `.breadcrumb` — mono navigation path
- `.page-title` — restrained h1
- `.page-summary` — secondary text
- `.meta-grid` — key-value metadata (dl)
- `.prose` — long-form body text
- `.hero-image` — responsive image
- `.section-label` — small mono uppercase heading
- `.item-list` / `.item-link` / `.item-title` / `.item-desc` / `.item-meta` — list items
- `.form-field` — label + input
- `.btn` — bordered button
- `.empty` — centered empty state

## Design principles

- Editorial Hybrid: Georgia serif, Courier New mono, warm paper (#f5f5f0)
- Masthead: wide-tracked uppercase Georgia, font-weight: 400
- Headings: font-weight: 400, letter-spacing — restraint, not boldness
- No card grids, no drop shadows, no gradients, no component library defaults
- Zero external CSS dependencies
- Every element should feel intentionally designed

## Deploy

```bash
npm run build && wrangler deploy
```

## Plugin (plugin/)

Pure modules in `plugin/src/modules/` — future Molt replacement targets:
- `disclaimers.ts` — FEC/state disclaimer resolution
- `geo-ask.ts` — geo-personalized donation amounts
- `ab-assign.ts` — deterministic A/B variant assignment
- `validate.ts` — form validation and sanitization

27 unit tests: `cd plugin && npm test`

## Compliance data (data/disclaimers/)

- Schema: `schema.json` (v0.2.0 with context, ai_disclosure_scope)
- Federal: `federal.json`
- States: `states/*.json` (DC, VA, MD, NY, CA, TX, FL, PA, GA, CO)
- Provenance: `VERIFICATION.md`, `scripts/verify-disclaimers.ts`
- Legal notes: `LEGAL_NOTES.md`

Run verification: `npm run verify`
