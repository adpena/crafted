# NationBuilder integration

The NationBuilder adapter creates a signup record via the NationBuilder v2
Signups API (JSON:API format), tagging the person with the action type and
page slug.

**Source:** `src/lib/integrations/nationbuilder.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NATIONBUILDER_NATION_SLUG` | Yes | Your nation slug (the subdomain in `{slug}.nationbuilder.com`). Must be lowercase alphanumeric with hyphens, max 63 characters. |
| `NATIONBUILDER_API_TOKEN` | Yes | Bearer token for the NationBuilder API |

## Setup instructions

1. Sign in to your NationBuilder control panel.
2. Go to **Settings > Developer > API tokens**.
3. Create a new token with People (read/write) scope.
4. Your nation slug is the subdomain you use to access your nation, e.g.,
   `mycampaign` in `mycampaign.nationbuilder.com`.
5. Store both as Cloudflare Worker secrets:
   ```bash
   wrangler secret put NATIONBUILDER_NATION_SLUG
   wrangler secret put NATIONBUILDER_API_TOKEN
   ```

Note: This adapter uses the v2 API (not the deprecated v1 People API). Bearer
tokens work with both v1 and v2 endpoints.

## What gets synced

| Submission field | NationBuilder field |
|-----------------|---------------------|
| `email` | `data.attributes.email` |
| `firstName` | `data.attributes.first_name` |
| `lastName` | `data.attributes.last_name` |
| action type | `data.attributes.tag_list`: `crafted:{type}` |
| page slug | `data.attributes.tag_list`: `page:{slug}` |

The payload uses JSON:API format: `{ data: { type: "signups", attributes: { ... } } }`.

## Which action types trigger it

All action types. The adapter fires for any submission with an email address.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `invalid nation slug` error | Slug contains invalid characters. Must match `^[a-z0-9][a-z0-9-]{0,62}$`. |
| `NationBuilder 401` | Token is invalid, expired, or lacks the required scope. |
| `NationBuilder 404` | Nation slug is wrong or the nation does not exist. |
| Adapter silently skipped | `NATIONBUILDER_NATION_SLUG` or `NATIONBUILDER_API_TOKEN` is not set. |
| `missing email` error | Submission had no email address. |

## Example wrangler commands

```bash
wrangler secret put NATIONBUILDER_NATION_SLUG
wrangler secret put NATIONBUILDER_API_TOKEN
```
