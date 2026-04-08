# EveryAction / NGP VAN integration

The EveryAction adapter creates or matches a person via the SecureVAN
`findOrCreate` API endpoint, syncing contact information from action-page
submissions into the EveryAction / NGP VAN CRM.

**Source:** `src/lib/integrations/everyaction.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EVERYACTION_API_KEY` | Yes | API key from EveryAction. Used with `\|0` suffix for MyCampaign mode. |
| `EVERYACTION_APP_NAME` | Yes | Application name (used as the HTTP Basic auth username) |

## Setup instructions

1. Log in to your EveryAction / VAN account.
2. Contact your EveryAction account manager or submit a support ticket to
   request API access. They will provide an application name and API key.
3. The adapter uses HTTP Basic auth with `{app_name}:{api_key}|0`. The `|0`
   suffix selects MyCampaign mode. Use `|1` for VoterFile mode if needed
   (requires code change).
4. Store both as Cloudflare Worker secrets:
   ```bash
   wrangler secret put EVERYACTION_API_KEY
   wrangler secret put EVERYACTION_APP_NAME
   ```

## What gets synced

| Submission field | EveryAction field |
|-----------------|-------------------|
| `email` | `emails[0].email` (with `isSubscribed: true`) |
| `firstName` | `firstName` |
| `lastName` | `lastName` |
| `postalCode` | `addresses[0].zipOrPostalCode` |

The `findOrCreate` endpoint matches on email. If a person already exists,
their record is returned without creating a duplicate.

Note: Unlike other adapters, EveryAction does not receive tags or action type
metadata. Tag application would require a separate Activist Code API call.

## Which action types trigger it

All action types. The adapter fires for any submission with an email address.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `EveryAction 401` | API key or app name is wrong, or the `\|0` mode suffix is incorrect. |
| `EveryAction 400` | Malformed payload. Check that the email address is valid. |
| Adapter silently skipped | `EVERYACTION_API_KEY` or `EVERYACTION_APP_NAME` is not set. |
| `missing email` error | Submission had no email address. |
| `EveryAction 403` | The API key lacks permission for the People endpoint. |

## Example wrangler commands

```bash
wrangler secret put EVERYACTION_API_KEY
wrangler secret put EVERYACTION_APP_NAME
```
