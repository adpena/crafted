# @crafted/action-pages

Campaign action page engine for [emdash CMS](https://emdashcms.com). Build donation, petition, and GOTV pledge pages with FEC/state disclaimer compliance, geo-personalization, deterministic A/B testing, and embeddable widgets -- all running inside emdash's plugin sandbox.

## Features

- **Campaign-scoped pages** -- group action pages under campaigns with independent slugs
- **FEC + state disclaimer compliance** -- built-in dataset covering federal rules (11 CFR 110.11) and 10 state jurisdictions (CA, CO, DC, FL, GA, MD, NY, PA, TX, VA), including AI disclosure requirements
- **Geo-personalization** -- resolve visitor jurisdiction from request geo headers; adjust donation amounts by region
- **Deterministic A/B testing** -- hash-based variant assignment (no cookies, no state) with conversion tracking
- **Embeddable widgets** -- generate a `<script>` tag that renders an action page in a Shadow DOM iframe on any site
- **Rate limiting + Turnstile** -- per-IP rate limiting with optional Cloudflare Turnstile bot protection
- **Submission validation** -- type-safe input validation and sanitization for donation clicks, petition signatures, and GOTV pledges
- **OG metadata injection** -- automatic Open Graph tags for action page URLs via the `page:metadata` hook

## Installation

### As a trusted plugin (config-based)

Install the package:

```bash
npm install @crafted/action-pages
```

Register the plugin in your emdash site's Astro config:

```typescript
// astro.config.mjs
import { defineConfig } from "astro/config";
import { emdash } from "emdash/astro";
import { actionPages } from "@crafted/action-pages";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [actionPages()],
    }),
  ],
});
```

### From the emdash Marketplace

Once the plugin is published to the marketplace, install it from the admin dashboard under **Plugins > Marketplace**. Marketplace plugins run in the sandbox automatically.

## Configuration

The plugin registers itself with ID `crafted-action-pages` and requests these capabilities:

| Capability | Purpose |
|---|---|
| `read:content` | Read action page and campaign data |
| `write:content` | Create demo campaign on install |
| `email:send` | Future: submission confirmation emails |
| `network:fetch` | Turnstile verification |
| `page:inject` | OG metadata for action page URLs |

### Plugin storage collections

| Collection | Indexes | Purpose |
|---|---|---|
| `campaigns` | `slug` | Campaign groupings |
| `action_pages` | `slug`, `status`, `campaign_id` | Individual action pages |
| `submissions` | `page_id`, `campaign_id`, `created_at` | Form submissions |
| `ab_variants` | `page_id` | A/B test variant stats |

## Usage

### Creating campaigns and pages

On first activation, the plugin seeds a demo campaign (`demo`) with a sample donation page (`demo-donate`). Create additional campaigns and pages through the admin UI or by writing directly to plugin storage.

### Rendering action pages

The plugin provides a JSON API via its routes. Your site needs a page template to render the data. A minimal Astro example:

```astro
---
// src/pages/action/[slug].astro
// This file lives in YOUR site, not in the plugin.
const pageData = await fetch(`${Astro.url.origin}/_emdash/api/plugins/crafted-action-pages/page?slug=${Astro.params.slug}`);
const { data } = await pageData.json();
---
<html>
  <body>
    <h1>{data.title}</h1>
    <p>{data.body}</p>
    <p class="disclaimer">{data.disclaimer.combined}</p>
  </body>
</html>
```

This separation is intentional -- the plugin handles data, compliance, and A/B logic; the site controls presentation.

### Embedding on external sites

Generate an embed script for any action page:

```
GET /_emdash/api/plugins/crafted-action-pages/embed?slug=demo-donate
```

Include the returned `<script>` tag on any HTML page. It creates a Shadow DOM container with an iframe pointing to your action page.

## API Reference

All routes are under `/_emdash/api/plugins/crafted-action-pages/`.

### `GET /page`

Returns action page data with resolved disclaimer, A/B variant, and geo context.

**Query parameters:**
- `slug` (required) -- action page slug
- `campaign` (optional) -- campaign slug to scope the lookup

**Response (200):**
```json
{
  "data": {
    "title": "Support the Cause",
    "type": "fundraise",
    "body": "Your contribution makes a difference.",
    "actblue_url": "https://secure.actblue.com/donate/example",
    "refcode": "crafted-demo",
    "amounts": [10, 25, 50, 100, 250],
    "variant": "control",
    "disclaimer": {
      "federal": { "text": "Paid for by Friends of Progress", "statute_citation": "11 CFR 110.11", "ai_disclosure_required": false, "ai_disclosure_text": null },
      "state": null,
      "combined": "Paid for by Friends of Progress"
    },
    "jurisdiction": "US-CA",
    "campaign": "demo"
  }
}
```

### `POST /submit`

Records a submission (donation click, petition signature, or GOTV pledge).

**Request body:**
```json
{
  "page_id": "uuid",
  "campaign_id": "uuid",
  "type": "donation_click",
  "data": {},
  "visitor_id": "uuid",
  "variant": "control",
  "turnstile_token": "..."
}
```

**Submission types and required fields:**
- `donation_click` -- no required fields
- `petition_sign` -- `first_name`, `last_name`, `email`, `zip`
- `gotv_pledge` -- `first_name`, `zip`

**Response (200):** `{ "data": { "ok": true } }`

### `GET /embed`

Returns a JavaScript snippet that embeds an action page via Shadow DOM iframe.

**Query parameters:**
- `slug` (required) -- action page slug
- `campaign` (optional) -- campaign slug

**Response:** `application/javascript` content

### `GET /stats` (authenticated)

Returns A/B variant statistics for a page.

**Query parameters:**
- `page_id` (required) -- action page ID
- `campaign` (optional) -- campaign slug

**Response (200):**
```json
{
  "data": {
    "page_id": "...",
    "campaign": null,
    "variants": [
      { "variant": "control", "impressions": 100, "conversions": 12, "conversion_rate": 0.12 },
      { "variant": "urgency", "impressions": 98, "conversions": 18, "conversion_rate": 0.1837 }
    ]
  }
}
```

## Compliance Dataset

The `data/disclaimers/` directory contains structured JSON files with political advertisement disclaimer requirements:

- `federal.json` -- FEC rules under 11 CFR 110.11 (digital, print, broadcast)
- `states/*.json` -- 10 state jurisdictions (CA, CO, DC, FL, GA, MD, NY, PA, TX, VA)
- `schema.json` -- JSON schema for disclaimer records
- `LEGAL_NOTES.md` -- scope, limitations, and legal disclaimers about the dataset
- `VERIFICATION.md` -- verification methodology and source citations

Each record includes:
- `jurisdiction`, `type` (digital/print/broadcast/sms/email), `context` (general/candidate_authorized/independent_expenditure/pac)
- `required_text` with `{variable}` interpolation
- `ai_disclosure_required`, `ai_disclosure_text`, `ai_disclosure_statute`
- `statute_citation`, `effective_date`, `last_verified`, `source_url`

**This is not legal advice.** See `data/disclaimers/LEGAL_NOTES.md` for full caveats. Always consult qualified election law counsel.

### Contributing to the dataset

Add a new state by creating `data/disclaimers/states/{state_code}.json` following the schema in `schema.json`. Include `source_url` and `last_verified` for every record.

## Architecture

The plugin follows emdash's two-entrypoint pattern:

- **`src/index.ts`** -- `PluginDescriptor` factory (runs at build time in Vite). Declares ID, version, capabilities, storage collections, and admin pages.
- **`src/sandbox-entry.ts`** -- `definePlugin()` with runtime hooks and routes (runs at request time in the sandbox).

### Pure modules (`src/modules/`)

All business logic lives in pure, framework-free modules with no emdash imports:

| Module | Purpose |
|---|---|
| `ab-assign.ts` | Deterministic hash-based A/B variant assignment |
| `disclaimers.ts` | Disclaimer resolution with jurisdiction layering and variable interpolation |
| `geo-ask.ts` | Jurisdiction resolution from geo context |
| `validate.ts` | Submission input validation and sanitization |

These modules have 100% unit test coverage and can be tested without emdash.

### Site-level rendering

The Astro page at `src/pages/action/[slug].astro` is **not part of this plugin** -- it is a site-level template that calls the plugin's API routes and renders the response. Each site controls its own presentation. The plugin only provides data and compliance logic.

## License

MIT
