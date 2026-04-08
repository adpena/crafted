# Operations Runbook

Operator-facing reference for the secrets, bindings, and cron triggers that
drive the production `crafted` Worker. The code is self-contained; this
document catalogs the infrastructure state each feature requires.

## 1. Required secrets (`wrangler secret put ...`)

Secrets are never committed to git. Set them per environment using
`wrangler secret put <NAME>`, which prompts for the value.

### Core

| Secret | Purpose | Required? | Failure mode if missing |
|---|---|---|---|
| `MCP_ADMIN_TOKEN` | Bearer token for all `/api/admin/*` and `/api/mcp/*` writes. Min 32 bytes. | **Yes** | 401 on every admin route. |
| `UNSUBSCRIBE_SECRET` | HMAC key for signed unsubscribe links in outbound email. | If sending email | 503 from `/api/unsubscribe`. |
| `UNSUBSCRIBE_BASE_URL` | Origin used to build unsubscribe URLs. | If sending email | Emails omit the footer. |

### Email (Resend)

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | API key from https://resend.com/api-keys |
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `alerts@adpena.com`) |
| `RESEND_DAILY_LIMIT` | Optional advisory cap on outbound emails (default `500`) |

### Conversion tracking

| Secret | Purpose |
|---|---|
| `META_PIXEL_ID`, `META_ACCESS_TOKEN` | Meta Conversions API (Facebook Ads) |
| `GOOGLE_CONVERSION_ID`, `GOOGLE_CONVERSION_LABEL` | Google Ads conversion |

### Campaign platform integrations

All twelve adapters are **opt-in** — missing credentials skip the adapter
silently. None are required for base operation.

| Adapter | Secrets |
|---|---|
| Action Network | `ACTION_NETWORK_API_KEY` |
| Mailchimp | `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC` |
| NationBuilder | `NATIONBUILDER_NATION_SLUG`, `NATIONBUILDER_API_TOKEN` |
| EveryAction | `EVERYACTION_API_KEY`, `EVERYACTION_APP_NAME` |
| Mobilize America | `MOBILIZE_API_TOKEN`, `MOBILIZE_ORGANIZATION_ID` (plus per-event config) |
| Eventbrite | `EVENTBRITE_API_TOKEN`, `EVENTBRITE_ORGANIZATION_ID` |
| Facebook Events | `FACEBOOK_ACCESS_TOKEN` (Graph API, `events_management` scope) |
| SendGrid | `SENDGRID_API_KEY`, `SENDGRID_LIST_ID` |
| Constant Contact | `CONSTANT_CONTACT_API_KEY`, `CONSTANT_CONTACT_LIST_ID` |
| NGP VAN | `NGPVAN_API_KEY`, `NGPVAN_APP_NAME`, optionally `NGPVAN_ACTIVIST_CODE_ID`, `NGPVAN_ACTIVIST_CODES_JSON` |
| Hustle | `HUSTLE_API_TOKEN`, `HUSTLE_ORGANIZATION_ID`, `HUSTLE_GROUP_ID` |
| Salsa Labs | `SALSA_API_TOKEN`, `SALSA_HOST` |

**VAN activist-code differentiation**: set
`NGPVAN_ACTIVIST_CODES_JSON` to a JSON map of action type → code, e.g.

    wrangler secret put NGPVAN_ACTIVIST_CODES_JSON
    # paste: {"petition_sign":12345,"letter_sent":12346,"signup":12347,"gotv_pledge":12348}

This lets a single VAN account differentiate supporters by what action
they took without touching every page's config. Per-page
`action_props.activist_code_ids` overrides the map for specific pages.

### Incoming webhooks

| Secret | Endpoint | Notes |
|---|---|---|
| `ACTBLUE_WEBHOOK_SECRET` | `POST /api/webhooks/actblue` | Basic auth (`username:password`). Configure in ActBlue committee settings. |
| `AN_WEBHOOK_SECRET` | `POST /api/webhooks/actionnetwork` | HMAC-SHA256 (`X-Action-Network-Signature`). Optional — unsigned requests are accepted if the secret is unset. |
| `MAILCHIMP_WEBHOOK_SECRET` | `POST /api/webhooks/mailchimp?key=...` | Shared-secret query param (Mailchimp does not sign payloads). Register the URL with the secret embedded in your Mailchimp list → Settings → Webhooks. |

### Bring-your-own integrations

| Secret | Purpose |
|---|---|
| `FIGMA_ACCESS_TOKEN` | Personal access token from figma.com → settings. Enables `POST /api/admin/figma-import`. Endpoint returns 503 until set. |
| `ANTHROPIC_API_KEY` | Claude API key for `/api/admin/generate-page` and `/api/admin/generate-variants`. |

## 2. Cloudflare bindings (wrangler.jsonc)

Resource identifiers below are not secrets. The `CLOUDFLARE_API_TOKEN`
env var controls who can modify them — never commit that.

### Always-on

- `CACHE` — KV namespace for rate limiting, counts, suppression lists.
- `DB` — D1 database `crafted`. Authoritative store for submissions,
  contacts, attribution events, audit log, campaigns/firms.
- `MEDIA` — R2 bucket `crafted-media` for admin image uploads.

### Optional

- `BACKUPS` — R2 bucket for nightly NDJSON backups. **Not enabled by
  default**. To enable:

      # 1. Create the bucket
      wrangler r2 bucket create crafted-backups

      # 2. Uncomment the BACKUPS entry in wrangler.jsonc r2_buckets
      # 3. Uncomment the triggers.crons block in wrangler.jsonc
      # 4. Redeploy:
      npm run deploy

  Once enabled, `src/worker.ts → scheduled()` runs `runBackup(DB, BACKUPS)`
  every day at 08:00 UTC (~03:00 CT). The endpoint
  `POST /api/admin/backup` also runs the same function on demand and
  returns `{ key, rows, bytes, tables }`.

- `LOADER` — Workers Loader binding for sandboxed plugin execution.
  Requires Workers Paid ($5/mo).

## 3. Cron triggers

Cron triggers are declared in `wrangler.jsonc → triggers.crons` and
invoke `src/worker.ts → scheduled()`. The handler dispatches by
`event.cron`.

Currently wired:

| Cron | Task |
|---|---|
| `0 8 * * *` | `runScheduledBackup` — D1 dump to `BACKUPS` R2 bucket (only if both `DB` and `BACKUPS` bindings are present) |

Missing bindings are logged but do not cause the scheduled invocation
to fail, so registering the trigger before creating the bucket is safe.

## 4. Operator-run commands

### Manual D1 backup (SQL dump)

    ./scripts/backup-d1.sh                  # remote DB → ./backups/<ts>.sql.gz
    LOCAL=1 ./scripts/backup-d1.sh          # local DB for dev
    BACKUP_DIR=/tmp ./scripts/backup-d1.sh  # custom output dir

Produces a SQL dump you can restore with `sqlite3 < file.sql`. Use this
for ad-hoc backups before risky migrations; use the R2 cron for
routine backups.

### Manual R2 backup via HTTP

    curl -X POST https://adpena.com/api/admin/backup \
      -H "Authorization: Bearer $MCP_ADMIN_TOKEN"

### Deploy

    npm run build && npm run deploy

### Tail production logs

    npx wrangler tail

## 5. Adding a new secret

1. `wrangler secret put <NAME>` (prompts for value, stored encrypted at Cloudflare)
2. Reference it via `env.NAME` in code (or `(env as Record<string, unknown>).NAME`)
3. Document it here with its purpose and failure mode
4. Never log secret values — the `[redacted]` audit log filter only
   catches email addresses, not API keys

## 6. Rotating secrets

Secrets can be rotated in-place with another `wrangler secret put <NAME>`.
The worker picks up the new value on the next invocation — no redeploy
needed. For webhook secrets, rotate in the third-party admin first
(ActBlue, Action Network, Mailchimp) then rotate in Cloudflare.
