# Constant Contact integration

The Constant Contact adapter syncs contacts to a Constant Contact list. It
creates a contact with implicit permission to send, and tags them with the
action type and page slug. Existing automation in Constant Contact handles
email delivery.

**Source:** `src/lib/integrations/constantcontact.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONSTANT_CONTACT_API_KEY` | Yes | OAuth2 access token for the Constant Contact v3 API |
| `CONSTANT_CONTACT_LIST_ID` | Yes | Contact list ID to add the supporter to |

## Setup instructions

1. Sign in to [constantcontact.com](https://www.constantcontact.com/).
2. Go to the [Constant Contact Developer Portal](https://developer.constantcontact.com/)
   and register an application.
3. Generate an OAuth2 access token with Contacts write permission.
4. Find your list ID: go to **Contacts > Lists**, click a list, and copy
   the list ID from the URL or API response.
5. Store both as Cloudflare Worker secrets:
   ```bash
   wrangler secret put CONSTANT_CONTACT_API_KEY
   wrangler secret put CONSTANT_CONTACT_LIST_ID
   ```

Note: OAuth2 access tokens expire. You may need a refresh token workflow for
long-lived use. The adapter expects a valid bearer token in
`CONSTANT_CONTACT_API_KEY`.

## What gets synced

| Submission field | Constant Contact field |
|-----------------|----------------------|
| `email` | `email_address.address` (with `permission_to_send: "implicit"`) |
| `firstName` | `first_name` |
| `lastName` | `last_name` |
| list ID (env var) | `list_memberships` |
| action type | Tag: `crafted:{type}` |
| page slug | Tag: `page:{slug}` |

The adapter uses `POST /v3/contacts` to create the contact. If the contact
already exists (409 Conflict), the adapter treats it as a success (idempotent).

## Which action types trigger it

All action types. The adapter fires for any submission with an email address.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `ConstantContact 401` | Access token is invalid or expired. Regenerate via OAuth2 flow. |
| `ConstantContact 409` (treated as success) | Contact already exists. This is handled gracefully. |
| Adapter silently skipped | `CONSTANT_CONTACT_API_KEY` or `CONSTANT_CONTACT_LIST_ID` is not set, or no email. |
| `ConstantContact 400` | Malformed payload or list ID does not exist. |
| `ConstantContact 403` | Token lacks Contacts write permission. |

## Example wrangler commands

```bash
wrangler secret put CONSTANT_CONTACT_API_KEY
wrangler secret put CONSTANT_CONTACT_LIST_ID
```
