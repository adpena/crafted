# Action Network integration

The Action Network adapter pushes action-page submissions to the OSDI-style
People API, creating or matching a person record in Action Network and tagging
them with the action type and page slug.

**Source:** `src/lib/integrations/actionnetwork.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ACTION_NETWORK_API_KEY` | Yes | OSDI API key (passed as `OSDI-API-Token` header) |

## Setup instructions

1. Sign in to [actionnetwork.org](https://actionnetwork.org/) as a group admin.
2. Navigate to **Start Organizing > Details > API & Sync**.
3. Your API key is listed under "Your API Key." Copy it.
4. Store it as a Cloudflare Worker secret:
   ```bash
   wrangler secret put ACTION_NETWORK_API_KEY
   ```

Note: The free tier API key only gives access to people within your group.
Partner-level keys provide broader access.

## What gets synced

| Submission field | Action Network field |
|-----------------|---------------------|
| `email` | `person.email_addresses[0].address` |
| `firstName` | `person.given_name` |
| `lastName` | `person.family_name` |
| `postalCode` | `person.postal_addresses[0].postal_code` |
| action type | Tag: `crafted:{type}` |
| page slug | Tag: `page:{slug}` |

The adapter uses Action Network's upsert behavior: if a person with the same
email already exists, they are matched and the tags are added to the existing
record.

## Which action types trigger it

All action types. The adapter fires for any submission that has an email
address, regardless of action type (`petition`, `fundraise`, `gotv`, `signup`,
`letter`, `event`, `call`, `step`).

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `ActionNetwork 403` | API key is invalid or revoked. Regenerate in the AN dashboard. |
| `ActionNetwork 400` | Malformed payload. Check that the email address is valid. |
| Adapter silently skipped | `ACTION_NETWORK_API_KEY` is not set. |
| `missing email` error | Submission had no email address. Email is required. |
| Timeout / network error | Action Network API is down, or request exceeded 10s timeout. |

## Example wrangler command

```bash
wrangler secret put ACTION_NETWORK_API_KEY
```
