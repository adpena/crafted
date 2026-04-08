# SendGrid integration

The SendGrid adapter syncs contacts to SendGrid Marketing Campaigns. It adds
supporters to a contact list so existing SendGrid email workflows pick them up
automatically. The adapter does not send email — that is handled by SendGrid's
automation.

**Source:** `src/lib/integrations/sendgrid.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes | SendGrid API key with Marketing permission |
| `SENDGRID_LIST_ID` | Optional | List ID to add contacts to. If omitted, contacts are added to the account without list membership. |

## Setup instructions

1. Sign in to [sendgrid.com](https://sendgrid.com/).
2. Go to **Settings > API Keys** and create a new key with at least
   **Marketing > Full Access** permission.
3. Copy the key (it is only shown once).
4. Optionally, find your list ID: go to **Marketing > Contacts > Lists**,
   click a list, and copy the ID from the URL.
5. Store as Cloudflare Worker secrets:
   ```bash
   wrangler secret put SENDGRID_API_KEY
   wrangler secret put SENDGRID_LIST_ID   # optional
   ```

## What gets synced

| Submission field | SendGrid field |
|-----------------|---------------|
| `email` | `email` |
| `firstName` | `first_name` |
| `lastName` | `last_name` |
| `postalCode` | `postal_code` |
| page slug | `custom_fields.crafted_source` |
| action type | `custom_fields.crafted_action` |

The adapter uses the `PUT /v3/marketing/contacts` endpoint, which is an
upsert: existing contacts are updated, new contacts are created. If a list ID
is configured, the contact is added to that list.

Note: The custom fields `crafted_source` and `crafted_action` must be created
in SendGrid before they will appear on contact records. Go to
**Marketing > Custom Fields** to define them.

## Which action types trigger it

All action types. The adapter fires for any submission with an email address.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `SendGrid 401` | API key is invalid or lacks Marketing permission. |
| `SendGrid 400` | Malformed payload, or custom fields not defined in SendGrid. |
| Adapter silently skipped | `SENDGRID_API_KEY` is not set, or no email in submission. |
| `SendGrid 404` | List ID is wrong or the list was deleted. |
| Custom fields not populated | Fields `crafted_source` and `crafted_action` not created in SendGrid dashboard. |

## Example wrangler commands

```bash
wrangler secret put SENDGRID_API_KEY
wrangler secret put SENDGRID_LIST_ID
```
