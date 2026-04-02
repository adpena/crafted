# Crafted — Design Specification

A personal portfolio and campaign action page engine built on emdash CMS, deployed to Cloudflare. Designed for open-source release.

## Project Identity

**Name:** Crafted

**What it is:** An emdash-powered portfolio site featuring a campaign action page plugin. The site is the portfolio; the plugin is the portfolio piece.

**Target audience:** Blueprint Interactive (progressive digital agency, DC) and the broader progressive campaign tech community.

**License:** MIT

## Architecture

### Portfolio Site

The portfolio runs on emdash CMS (Astro 6 + Cloudflare D1/R2/Workers). Content is managed through emdash's admin UI and MCP server.

```
crafted/
├── site/                    # Astro portfolio site (emdash integration)
│   ├── src/
│   │   ├── components/      # Astro components + React islands
│   │   ├── layouts/         # Newspaper editorial layout
│   │   ├── pages/           # Homepage, about, contact, project details
│   │   └── styles/          # TailwindCSS 4
│   └── astro.config.ts      # emdash integration config
├── plugin/                  # Campaign Action Page emdash plugin
│   ├── src/
│   │   ├── index.ts         # definePlugin() entry
│   │   ├── hooks/           # content:afterSave, page:metadata, cron
│   │   ├── routes/          # submit, page, embed, stats
│   │   ├── admin/           # React admin pages and widgets
│   │   └── modules/         # Pure business logic (Molt targets)
│   │       ├── disclaimers.ts
│   │       ├── geo-ask.ts
│   │       ├── ab-assign.ts
│   │       └── validate.ts
│   └── sandbox-entry.ts     # Standard format plugin entry
├── data/
│   └── disclaimers/         # Versioned compliance dataset
│       ├── schema.json      # JSON Schema for disclaimer records
│       ├── federal.json     # FEC 11 CFR 110.11 rules
│       └── states/          # Per-state files (dc.json, va.json, etc.)
├── package.json
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── README.md
```

### Cloudflare Services

| Service | Usage |
|---------|-------|
| D1 | Content database, action pages, submissions, A/B variants, disclaimers |
| R2 | Media storage, page assets |
| KV | Cached disclaimer lookups, rate limiting |
| Workers | SSR, API routes, form processing, action page serving |
| Turnstile | Bot protection on form submissions |
| Analytics Engine | A/B test event tracking (D1 fallback if unavailable) |

### Plugin Definition

Standard format plugin (sandboxable, runs in Worker isolate):

```
Capabilities: read:content, write:content, email:send, network:fetch, page:inject
Storage: action_pages, submissions, ab_variants, disclaimers
Hooks: content:afterSave, page:metadata, cron
Routes: POST /submit, GET /page/:slug, GET /embed.js, GET /stats
Admin: Action Page builder, Submissions viewer, A/B dashboard widget, Disclaimer manager
```

### Pure Modules

Business logic is isolated into pure, side-effect-free modules. These are the Molt replacement targets: each takes typed data in, returns typed data out, touches nothing else.

| Module | Signature | Purpose |
|--------|-----------|---------|
| `disclaimers.ts` | `(committee, jurisdiction, adType) → disclaimerText` | FEC/state disclaimer resolution |
| `geo-ask.ts` | `(country, city) → suggestedAmounts[]` | Geo-personalized donation asks |
| `ab-assign.ts` | `(visitorHash, variants) → variantId` | Deterministic variant assignment |
| `validate.ts` | `(input, schema) → result` | Form validation |

## Visual Design

### Style: Editorial Hybrid

Warm paper tones, serif body text (Georgia), monospace CLI references (Courier New/system mono). Bridges editorial design with engineering culture.

- Background: `#f5f5f0` (warm paper)
- Text: `#1a1a1a` (near-black)
- Secondary: `#888`
- Accent: `#22c55e` (status green, used sparingly)
- Code/meta: monospace, `#666` on `#eeeee8`
- Typography: Georgia for prose, system monospace for code/metadata
- Spacing: generous whitespace, no clutter

### Homepage: Newspaper Layout

Centered masthead, two-column editorial body. Left column: featured project. Right column: latest projects list. Status bar with live project indicators.

### Project Detail Pages

**Base (Layout B):** Case study with sidebar. Main column: long-form narrative with inline code and diagrams. Sidebar: stack, links, status. Used for all projects.

**Flagship (Layout C):** Layout B + React islands. Metrics banner, tabbed content sections (Overview/Architecture/Demo), drag-to-resize panels with Pretext-style canvas.measureText() text reflow (inlined, zero-dep). Used for Molt and Campaign Action Pages.

Progressive enhancement: C is B with hydrated islands on top. Same HTML structure underneath.

### React Islands

Interactive elements are React components hydrated via Astro's `client:visible`. All built from scratch, zero external component libraries:

- Tabbed content sections (flagship projects)
- Metrics banner with animated counters (flagship projects)
- Drag-to-resize split panel with canvas.measureText() text reflow (flagship projects, built into the project detail page component)
- A/B test dashboard widget (plugin admin)
- Disclaimer manager (plugin admin)

## Data Model

### Action Pages

```
action_pages {
  id: ULID
  slug: string
  title: string
  type: "fundraise" | "petition" | "gotv" | "rapid-response"
  body: PortableText
  actblue_url: string (nullable)
  refcode: string (nullable)
  geo_config: JSON { enabled: boolean, amounts_by_region: Record<string, number[]> }
  ab_config: JSON { enabled: boolean, variants: string[] }
  disclaimer_override: string (nullable)
  locale: "en" | "es"
  status: "draft" | "published" | "archived"
}
```

### Submissions

```
submissions {
  id: ULID
  page_id: string (FK action_pages)
  type: "donation_click" | "petition_sign" | "gotv_pledge"
  data: JSON
  ip_country: string
  ip_city: string
  variant_id: string (nullable)
  created_at: datetime
}
```

### A/B Variants

```
ab_variants {
  id: ULID
  page_id: string (FK action_pages)
  name: string
  config: JSON { headline, cta_text, amounts, layout }
  impressions: integer
  conversions: integer
}
```

### Disclaimers (Compliance Dataset)

```
disclaimers {
  jurisdiction: string (2-letter state code or "FED")
  type: "digital" | "print" | "broadcast" | "sms" | "email"
  required_text: string (template with {committee_name} etc.)
  adapted_text: string (nullable, for small formats)
  statute_citation: string
  ai_disclosure_required: boolean
  ai_disclosure_text: string (nullable)
  effective_date: date
  last_verified: date
  source_url: string
}
```

## Compliance Dataset

Versioned JSON files in `data/disclaimers/`, loaded into D1 on deploy.

**Federal:** Encoded from eCFR API (11 CFR 110.11). Monitored via Federal Register API for rulemaking changes.

**States (v1):** DC, VA, MD, NY, CA, TX, FL, PA, GA, CO. Manually encoded from NCSL and state election commission sources. Each file includes `last_verified` date and `source_url`.

**Schema:** JSON Schema validator ensures all entries conform. CI runs validation on every PR touching `data/disclaimers/`.

**Expansion:** Remaining states added incrementally. Community contributions welcome via PR. AI-assisted extraction from NCSL prose is a documented process in CONTRIBUTING.md but all entries require human verification.

## Embeddable Widget

A `<script>` tag that renders an action page anywhere:

```html
<script src="https://crafted.example.com/plugin/embed.js"
        data-page="donate-now"
        data-theme="light">
</script>
```

Renders in a shadow DOM container. Framework-agnostic: works in WordPress themes, Django templates, Laravel Blade, static HTML. Loads the action page from the Cloudflare edge. Inherits geo-personalization and disclaimer resolution from the Worker.

## Open-Source Principles

**Structure:**
- Monorepo with clear package boundaries (site, plugin, data)
- MIT license
- Semantic versioning from 0.1.0
- Clean git history: atomic commits, imperative tense, no fixup chains
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue templates, PR templates

**Code quality:**
- Strict TypeScript (TS 6.0-beta, `strict: true`)
- oxlint + oxfmt (emdash's toolchain)
- No `any`, no unnecessary `as` casts
- Pure modules are pure: no side effects, no global state
- Zero external dependencies beyond emdash's plugin API
- No npm packages: implement what we need ourselves
- Text measurement for resize panels uses canvas.measureText() directly (technique from Pretext by Cheng Lou, ~200 lines inlined)
- Supply chain security: no transitive dependency tree to audit or worry about (xz-utils, polyfill.io lessons learned)
- 1-week delay on all package updates (emdash, Astro, etc.): never auto-update to latest. Let the ecosystem surface bugs first.

**Security:**
- No secrets in code
- Turnstile tokens validated server-side only
- All user input sanitized
- Capability manifest is minimal: request only what's needed
- Standard format plugin runs in Worker isolate sandbox

**Documentation:**
- README: what it is, how to use it, how to contribute. Written like a person.
- No generated comments or boilerplate docstrings in code
- No emoji in code, commits, or docs
- Inline comments only where logic is non-obvious

**No AI fingerprints:**
- Concise code: if it's 20 lines, it's 20 lines
- Human variable names, no over-abstraction
- No premature generalization or enterprise patterns
- Clean, readable, the kind of code you'd be proud to show in a review

## Roadmap

### v0.1 (Launch)

- Portfolio site on emdash with newspaper layout
- Campaign Action Page plugin (standard format, sandboxed)
- Form submissions with Turnstile protection
- FEC + 10 states disclaimer auto-generation
- Geo-personalized donation asks
- ActBlue deep-linking
- Embeddable widget
- A/B variant assignment (edge-side)
- WCAG 2.1 AA compliance
- Open-source release

### v0.2

- Molt bridge: pure modules rewritten in Python, AOT-compiled to Wasm via Molt, running in emdash's Worker isolate
- Monty development mode: interpret Python modules in Monty sandbox during development, Molt-compile for production
- Capability manifest flow: Monty's deny-by-default capabilities map to emdash's definePlugin() capabilities

### v0.3

- Full 50-state disclaimer coverage
- AI-in-political-ads disclosure rules (15+ states)
- Automated monitoring: Federal Register API for FEC changes, NCSL legislation database for state changes
- Community contribution workflow for disclaimer data

### v0.4

- Multilingual action pages (Spanish i18n)
- Culturally-adapted CTAs (not word-for-word translation)
- Proper hreflang + URL structure

### v0.5

- emdash MCP tool extensions: plugin-provided MCP tools for managing action pages, querying submissions, and running A/B tests via AI agents
- WebMCP integration for browser-based MCP transport in the admin

### v1.0

- Statistical significance engine for A/B tests
- Email engagement loop (scroll depth, interaction events feeding back to email platform analytics)
- Plugin marketplace listing
- Comprehensive documentation site
