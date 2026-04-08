# Crafted — Claude Context

Personal portfolio for Alejandro Peña. Built on emdash CMS + Astro 6 + Cloudflare Workers.
Live at https://adpena.com (also https://crafted.adpena.workers.dev)

## Architecture

- **Site**: Astro 6, emdash CMS integration, Cloudflare D1/R2/KV
- **Plugin**: `plugin/` — Campaign Action Pages engine (dev copy of @adpena/action-pages)
- **Notifications**: `@adpena/notifications` — published on npm, 17 adapters
- **Data**: `data/disclaimers/` — FEC + 10 states political ad disclaimer dataset
- **Styles**: `src/styles/global.css` — single source of truth for all shared CSS

## Collections (four domains)

| Collection | Slug | Key fields |
|-----------|------|-----------|
| Development | `dev` | title, summary, content, repo_url, live_url, stack, language, year, project_status |
| Design | `design` | title, summary, content, featured_image, gallery, client, medium, year, live_url |
| Policy | `policy` | title, summary, content, publication, date, topic, link, pdf_url, coauthors |
| Writing | `writing` | title, summary, content, publication, date, topic, link, excerpt |

## Key Features

- React islands: WorkListing (filter), MoltDemo (fractal), ActionPageIsland
- Dark mode: prefers-color-scheme + manual toggle in masthead
- KV edge cache: 193ms LCP on home page (vs 633ms without)
- JSON-RPC 2.0 MCP tools at /api/mcp/actions and /api/mcp/demo
- QR code endpoint: /api/action/qr (pure TypeScript Reed-Solomon, 8 shapes, 4 EC levels, zero deps)
- ActBlue iframe embed mode (fundraise action supports redirect or inline iframe)
- OG meta tags on action pages via page:metadata hook
- FOUC prevention: inline critical link styles with is:inline
- View Transitions: ready for Safari 26.2 (parked)

## Security

- HSTS, CSP (with object-src none, form-action self), X-Frame-Options
- Scanner blocking: WAF rule + middleware (23 paths → 403)
- MCP write tools require Bearer token (MCP_ADMIN_TOKEN, min 32 bytes)
- Turnstile opt-in per page (verify token if present, skip if no site key)
- Centralized timing-safe Bearer auth via `src/lib/auth.ts` (HMAC-SHA256 with token-derived key)
- Rate limiting: KV fixed-window (5/min per hashed IP)
- Geo whitelist/blacklist per page (cf-ipcountry)
- Email dedup: SHA-256 hash per email+slug
- Payload size enforced by reading bytes (not trusting Content-Length)
- R2 media server: MIME allowlist + nosniff header
- npm supply chain: ignore-scripts, save-exact, Dependabot
- 5 security audit passes + 2 senior engineer reviews — 44+ issues found and fixed

## Pricing Reality

- Demo / low-volume (< 500 submissions/day): Cloudflare free tier ($0)
- Production campaigns: Cloudflare Workers Paid ($5/month) required for KV write limits
- With email confirmations: + Resend ($20/month for 50K emails)
- Typical cost for 10 active campaigns: $25-85/month
- Compare: Action Network $99-$1,500/month for equivalent features

## Deploy

```bash
npm run build && wrangler deploy
```

## Plugin (plugin/)

Dev copy of @adpena/action-pages. Full campaign action pages platform.

### Action types (8)
petition, fundraise, gotv, signup, letter (Congress rep lookup), event (RSVP + .ics + multi-platform sync), call (click-to-dial), step (multi-step branching forms)

### Templates (5)
hero-simple, hero-media, hero-story, hero-layered, hero-split

### Themes (3)
warm (editorial), bold (dark), clean (minimal) + brand extraction (URL → 4 auto-generated variants)

### Admin panels (10)
PageBuilder, SubmissionsViewer, NotificationConfig, TemplateGallery, BrandExtractor, AIPageGenerator, EmailBlastComposer, CsvImportWizard, WebhookInboxViewer, AuditLogViewer

### Integrations (11 — 9 push + 2 read-back)
Action Network, Mailchimp, NationBuilder (v2 API), EveryAction/NGP VAN, Mobilize America, Eventbrite, Facebook Events (CAPI v25.0), SendGrid, Constant Contact
Read-back webhooks: ActBlue (Basic auth), Action Network (HMAC-SHA256)

### i18n (8 locales)
en, es, zh, vi, ko, tl, fr, ar

### Tests
1,677 tests across 28 files: `npm test`

## API Endpoints

### Public
- `POST /api/action/submit` — form submissions (full pipeline: rate limit → Turnstile → geo → dedup → D1 → async email/tracking/integrations/contacts)
- `GET /api/action/count?slug=X` — KV-cached submission count
- `GET /api/action/stream?slug=X` — SSE live count updates
- `GET /api/action/reps?zip=X` — rep lookup (ProPublica Congress API)
- `GET /api/unsubscribe` — HMAC-verified email unsubscribe
- `POST /api/webhooks/:source` — incoming webhook receiver (rate-limited)
- `POST /api/webhooks/actblue` — ActBlue donation webhook (Basic auth, attribution tracking)
- `POST /api/webhooks/actionnetwork` — Action Network webhook (HMAC-SHA256, attribution tracking)
- `GET /api/media/action-pages/...` — R2 image server (MIME allowlist)

### Authenticated (Bearer MCP_ADMIN_TOKEN)
- `POST/GET /api/mcp/actions` — JSON-RPC 2.0 MCP tools (8 tools)
- `GET /api/action/export?slug=X` — CSV/JSON submission export
- `GET /api/action/stats?slug=X` — A/B variant stats with z-test significance
- `GET /api/action/list?slug=X` — paginated submissions with search
- `POST /api/admin/upload` — R2 image upload
- `POST /api/admin/brand-extract` — URL → BrandKit + 4 theme variants
- `POST /api/admin/generate-page` — AI page generator (Anthropic API)
- `POST /api/admin/generate-variants` — AI A/B headline variants
- `GET /api/admin/templates` — pre-built campaign template gallery
- `POST /api/admin/email/send` — bulk email blast via Resend
- `GET /api/admin/contacts` — contact list with search + tag filter
- `GET/PATCH/DELETE /api/admin/contacts/:id` — contact detail, tag management, CCPA erasure
- `POST /api/admin/contacts/delete-bulk` — bulk CCPA/GDPR erasure by email or IDs
- `POST /api/admin/contacts/import` — CSV contact import
- `GET /api/admin/audit-log` — admin audit trail
- `GET /api/admin/webhook-inbox` — incoming webhook log
- `GET /api/admin/attribution?slug=X` — attribution summary (petition->donation conversion)
- `GET /api/admin/attribution?contact=email` — contact attribution journey

## Attribution Tracking

Webhook receivers close the feedback loop: after pushing supporters to ActBlue/Action Network,
we track what happened next. Events stored in D1 (`_plugin_storage`, collection='attribution_events')
with SHA-256 hashed emails. `src/lib/attribution.ts` provides query functions for per-page summaries
(petition->donation conversion rates) and per-contact journey views.

## Post-Submit Pipeline (async via waitUntil)

1. KV count cache increment
2. Confirmation email via Resend (HTML templates per action type)
3. Meta CAPI + Google Ads conversion tracking (v25.0)
4. Campaign platform integrations (9 adapters fire in parallel)
5. Contact upsert (D1 dedup by email)

## Case Study

Action Pages case study: /action-pages (src/pages/action-pages.astro)

## Known platform issues

### Cloudflare Workers CSS filename bug
Astro scoped CSS with `@` in filename served as 0 bytes by Workers. Put styles in `src/styles/global.css`.

### Debugging streaming responses
Never `curl | grep` streaming responses. Save to file first, then grep.

### Astro v6 waitUntil
Use `context.locals.cfContext.waitUntil()` — NOT `context.locals.runtime.ctx.waitUntil()` (removed in Astro v6).

### Google Civic API
`representativeInfoByAddress` was removed April 30, 2025. Use ProPublica Congress API instead.
