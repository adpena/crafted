# Facebook Events integration

The Facebook Events adapter records `event_rsvp` submissions as Lead
conversion events via the Facebook Conversions API (CAPI). Since Facebook
deprecated most event RSVP write APIs in 2018, this integration notifies
campaign staff of cross-platform RSVPs through the CAPI pipeline.

**Source:** `src/lib/integrations/facebook.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FACEBOOK_ACCESS_TOKEN` | Yes | User or page access token with appropriate permissions |

The event/pixel ID is set per-page via `submission.eventIds.facebook`, not
as a global env var.

## Setup instructions

1. Go to [developers.facebook.com](https://developers.facebook.com/) and
   create or select an app.
2. Set up the Conversions API in **Events Manager > Data Sources**.
3. Generate a system user access token with the required permissions.
4. Store it as a Cloudflare Worker secret:
   ```bash
   wrangler secret put FACEBOOK_ACCESS_TOKEN
   ```
5. For each action page, set the Facebook event/pixel ID in the page's
   `action_props.event_ids.facebook` field.

## What gets synced

| Submission field | Facebook CAPI field |
|-----------------|---------------------|
| `email` (SHA-256 hashed) | `user_data.em` |
| `firstName` (SHA-256 hashed, lowercased) | `user_data.fn` |
| `lastName` (SHA-256 hashed, lowercased) | `user_data.ln` |
| page URL | `event_source_url` |
| page title or slug | `custom_data.content_name` |
| `"event_rsvp"` | `custom_data.content_category` |

The adapter sends a `Lead` event to Graph API v25.0 at
`/{event_id}/events`. All PII is SHA-256 hashed before transmission, following
Facebook's Advanced Matching requirements.

## Which action types trigger it

Only `event_rsvp`. All other action types are silently skipped.

The per-page event ID (`submission.eventIds.facebook`) must also be set.

## Privacy

- Email, first name, and last name are SHA-256 hashed before being sent to
  Facebook. Raw PII never leaves the Worker.
- Email is lowercased and trimmed before hashing (per Facebook normalization
  requirements).
- First and last names are lowercased before hashing.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `Facebook 401` | Access token is invalid or expired. Regenerate in Events Manager. |
| `Facebook 400` | Malformed event data. Check that the event/pixel ID is correct. |
| Adapter silently skipped | `FACEBOOK_ACCESS_TOKEN` not set, or submission type is not `event_rsvp`, or `eventIds.facebook` not set, or no email. |
| `Facebook 403` | Token lacks required permissions for the event/pixel. |

## Example wrangler command

```bash
wrangler secret put FACEBOOK_ACCESS_TOKEN
```
