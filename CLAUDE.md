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
- FOUC prevention: inline critical link styles with is:inline
- View Transitions: ready for Safari 26.2 (parked)

## Security

- HSTS, CSP (with object-src none, form-action self), X-Frame-Options
- Scanner blocking: WAF rule + middleware (23 paths → 403)
- MCP write tools require Bearer token (MCP_ADMIN_TOKEN)
- Turnstile on contact form (fail-closed)
- npm supply chain: ignore-scripts, save-exact, Dependabot

## Deploy

```bash
npm run build && wrangler deploy
```

## Plugin (plugin/)

Dev copy of @adpena/action-pages. 5 templates, 4 actions, 3 themes.
136 tests: `cd plugin && npm test`

## Known platform issues

### Cloudflare Workers CSS filename bug
Astro scoped CSS with `@` in filename served as 0 bytes by Workers. Put styles in `src/styles/global.css`.

### Debugging streaming responses
Never `curl | grep` streaming responses. Save to file first, then grep.
