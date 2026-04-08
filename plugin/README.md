# @crafted/action-pages

Campaign action page engine for [emdash CMS](https://emdashcms.com). Build fundraise, petition, GOTV, signup, letter, event, call, and multi-step form pages with FEC/state disclaimer compliance, geo-personalization, deterministic A/B testing, brand extraction, AI page generation, and 9 campaign platform integrations -- all running on Cloudflare Workers.

## Quick start

```bash
# Install
npm install @crafted/action-pages

# Run tests
cd plugin && npm test

# Seed demo pages (requires MCP_ADMIN_TOKEN)
MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/seed-demo-pages.ts
```

Register in your Astro config:

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

## Action types (8)

| Action | Submission type | Description |
|--------|----------------|-------------|
| **Fundraise** | `donation_click` | Amount buttons + ActBlue redirect or iframe embed |
| **Petition** | `petition_sign` | Name, email, zip, optional comment with progress bar |
| **GOTV** | `gotv_pledge` | Pledge-to-vote with election day reminders |
| **Signup** | `signup` | Email + optional name, lightweight list capture |
| **Letter** | `letter_sent` | Letter to Congress with zip-based rep lookup + editable merge fields |
| **Event** | `event_rsvp` | RSVP with .ics calendar export + multi-platform sync (Mobilize/Eventbrite/Facebook) |
| **Call** | `call_made` | Click-to-dial with rep lookup, script, and talking points |
| **Step** | `step_form` | Multi-step branching form with conditional logic |

## Templates (5)

- **hero-simple** -- headline, subhead, configurable alignment
- **hero-media** -- full-bleed image/video with overlay
- **hero-story** -- editorial layout with body text and pull quote
- **hero-layered** -- composited background (image/video/gradient) with positioned content
- **hero-split** -- side-by-side media and content with configurable ratio

## Themes (3 + brand extraction)

- **warm** -- editorial serif, neutral tones
- **bold** -- dark background, high contrast
- **clean** -- minimal, system fonts

**Brand extraction**: POST a URL to `/api/admin/brand-extract` to auto-generate 4 theme variants from any website's colors and fonts. Integrated directly in PageBuilder.

## Admin panels (10)

1. **PageBuilder** -- WYSIWYG page creation with live preview, inline brand extraction
2. **SubmissionsViewer** -- browse and search submissions per page
3. **NotificationConfig** -- configure email/webhook notifications
4. **TemplateGallery** -- pre-built campaign page templates
5. **BrandExtractor** -- standalone URL-to-brand-kit tool
6. **AIPageGenerator** -- generate complete action pages from a prompt (Anthropic API)
7. **EmailBlastComposer** -- bulk email via Resend with template variables
8. **CsvImportWizard** -- CSV contact import with tag merging + optional platform sync
9. **WebhookInboxViewer** -- incoming webhook event log
10. **AuditLogViewer** -- admin action audit trail

## Integrations (9)

All integrations fire in parallel after each submission via `dispatchIntegrations`:

1. **Action Network** -- person signup/petition via OSDI API
2. **Mailchimp** -- list member upsert via Marketing API
3. **NationBuilder** -- person push via v2 API
4. **EveryAction / NGP VAN** -- contact upsert via VAN API
5. **Mobilize America** -- event attendance via API
6. **Eventbrite** -- attendee creation via API
7. **Facebook Events** -- RSVP via Graph API (CAPI v25.0)
8. **SendGrid** -- Marketing Contacts upsert
9. **Constant Contact** -- contact list upsert

CSV imports can optionally sync to all configured platforms via `sync_to_platforms=true`.

## i18n (8 locales)

en, es, zh, vi, ko, tl, fr, ar

## Compliance

- **FEC disclaimers** -- built-in dataset covering 11 CFR 110.11 (digital, print, broadcast)
- **State disclaimers** -- 10 jurisdictions (CA, CO, DC, FL, GA, MD, NY, PA, TX, VA)
- **AI disclosure** -- per-jurisdiction AI-generated content disclosure requirements
- Dataset in `data/disclaimers/` with JSON schema, legal notes, and verification methodology

**This is not legal advice.** See `data/disclaimers/LEGAL_NOTES.md`.

## Features

- **Campaign-scoped pages** -- group action pages under campaigns with independent slugs
- **Geo-personalization** -- whitelist/blacklist by country, adjustable per page
- **Deterministic A/B testing** -- hash-based variant assignment with z-test significance
- **Embeddable widgets** -- Shadow DOM iframe embed for external sites
- **Rate limiting + Turnstile** -- per-IP KV rate limiting with optional Cloudflare Turnstile
- **Email dedup** -- SHA-256 hash per email+slug prevents duplicate submissions
- **OG metadata injection** -- automatic Open Graph tags for action page URLs
- **QR codes** -- `/api/action/qr?slug=X&style=rounded&ec=H` generates styled SVG QR codes (8 shapes, 4 EC levels, gradients, eye styling — zero dependencies)
- **Conversion tracking** -- Meta CAPI + Google Ads with click attribution forwarding
- **WYSIWYG preview** -- live side-by-side preview in PageBuilder

## Architecture

The plugin follows emdash's two-entrypoint pattern:

- **`src/index.ts`** -- `PluginDescriptor` factory (build time)
- **`src/sandbox-entry.ts`** -- `definePlugin()` with runtime hooks and routes

### Pure modules (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `ab-assign.ts` | Deterministic hash-based A/B variant assignment |
| `disclaimers.ts` | Disclaimer resolution with jurisdiction layering |
| `geo-ask.ts` | Jurisdiction resolution from geo context |
| `validate.ts` | Submission input validation and sanitization |

### Component registries

- Templates: `src/components/templates/` (5 components)
- Actions: `src/components/actions/` (8 components)
- Admin: `src/admin/` (10 panels + components)

## Tests

1,693 tests across 30 files:

```bash
cd plugin && npm test
```

## License

MIT
