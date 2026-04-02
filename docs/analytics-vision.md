# Analytics & Integration Vision

## Core Principle

Action pages generate high-value campaign data at the edge. That data should flow into whatever tools the campaign already uses — not be locked in a silo.

## Data We Capture

Every action page interaction produces:
- Submission data (donation clicks, petition signatures, GOTV pledges)
- A/B variant performance (impressions, conversions per variant)
- Geo data (jurisdiction, used for disclaimer resolution)
- Campaign scoping (which campaign, which page)
- Timestamps, visitor IDs (hashed), referrer context

## Analytics Layers

### Layer 1: Built-in Dashboard (Now)
- Per-campaign submission counts and conversion rates
- A/B variant performance with statistical significance
- Submission timeline (hourly/daily/weekly)
- Geo distribution of submissions
- Exposed via the plugin's `/stats` route and admin widget

### Layer 2: API & MCP Tools (Next)
- REST API for querying analytics: `/api/plugins/crafted-action-pages/analytics`
  - Filter by campaign, page, date range, geo, variant
  - Aggregation: sum, count, average, time series
  - Export: JSON, CSV
- MCP tools for AI-assisted analysis:
  - `query_submissions` — structured query with filters
  - `campaign_summary` — high-level stats for a campaign
  - `compare_variants` — A/B test comparison with confidence intervals
  - `export_data` — bulk export for external tools
- WebMCP for browser-based access to the same tools

### Layer 3: Integration Hub (Later)
Platform-agnostic connectors that push/pull data:

**Outbound (push data out):**
- Webhooks (generic — Zapier, Make, n8n compatible)
- Discord/Slack notifications (already built for contact form)
- CSV/JSON export to S3/R2 for data warehouse ingestion
- FEC-format export for compliance reporting

**Inbound (pull external data in):**
- Facebook Ads API — match ad spend to action page conversions
- Twitter/X Ads API — same
- Google Ads API — same
- ActBlue API — pull actual donation amounts to match against action page clicks
- EveryAction/NGP VAN — sync supporter data
- FEC API — pull committee filing data for compliance cross-reference

**Bidirectional:**
- Zapier/Make triggers and actions
- Generic webhook subscriptions (event-driven)

### Layer 4: OSINT & Pipeline (Future)
- Feed analytics into OSINT databases and dashboards
- ETL pipeline: action page data → transformation → external product
- Cloudflare Analytics Engine for high-cardinality time series
- Vectorize for semantic search across submission text
- Workers AI for anomaly detection (spam patterns, donation surges)

## Architecture

```
Action Page Event
    ↓
Plugin Storage (D1)
    ↓
┌──────────┬──────────┬──────────┐
│ REST API │ MCP Tools│ Webhooks │
└──────────┴──────────┴──────────┘
    ↓           ↓           ↓
Dashboards  AI Agents   External
                        Platforms
                        (Zapier, FB,
                         FEC, etc.)
```

## Design Principles

- **Privacy first** — no raw IPs stored, visitor IDs are hashed, geo is jurisdiction-level only
- **Campaign-scoped** — every query is scoped to a campaign; no cross-campaign data leakage
- **API-first** — everything available via REST and MCP before it's in a UI
- **Standards-based** — OpenAPI spec for REST, MCP protocol for AI tools, standard webhook format
- **Agnostic** — no vendor lock-in; Zapier/webhook approach works with any platform
- **Incremental** — each layer works independently; you don't need Layer 4 to use Layer 1

## FEC Integration Specifics

- Pull committee data from OpenFEC API (`api.open.fec.gov`)
- Cross-reference action page committee_name against FEC filing data
- Export disclaimer compliance records in FEC-compatible format
- Monitor for filing deadlines and flag campaigns that need updated disclaimers
