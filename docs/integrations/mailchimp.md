# Mailchimp integration

The Mailchimp adapter adds a subscriber to a Mailchimp audience (list),
setting merge fields for first and last name and tagging them with the
action type and page slug.

**Source:** `src/lib/integrations/mailchimp.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILCHIMP_API_KEY` | Yes | Mailchimp API key (used for Basic auth) |
| `MAILCHIMP_LIST_ID` | Yes | Audience/list ID to add members to |
| `MAILCHIMP_DC` | Yes | Data center prefix (e.g. `us21`) — the suffix of your API key after the dash |

## Setup instructions

1. Sign in to [mailchimp.com](https://mailchimp.com/).
2. Go to **Profile > Extras > API keys** and create a new key.
3. The API key looks like `abc123def456-us21`. The part after the dash (`us21`)
   is your data center (`MAILCHIMP_DC`).
4. Find your audience ID: go to **Audience > Settings > Audience name and defaults**.
   The Audience ID is listed at the bottom of the page.
5. Store all three as Cloudflare Worker secrets:
   ```bash
   wrangler secret put MAILCHIMP_API_KEY
   wrangler secret put MAILCHIMP_LIST_ID
   wrangler secret put MAILCHIMP_DC
   ```

## What gets synced

| Submission field | Mailchimp field |
|-----------------|----------------|
| `email` | `email_address` |
| `firstName` | `merge_fields.FNAME` |
| `lastName` | `merge_fields.LNAME` |
| action type | Tag: `{type}` |
| page slug | Tag: `{slug}` |

New members are added with `status: "subscribed"` (no double opt-in). If a
member already exists, Mailchimp returns a 400 with "Member Exists" — the
adapter treats this as an error. To handle existing members gracefully,
consider using the PUT (upsert) endpoint in a future update.

## Which action types trigger it

All action types. The adapter fires for any submission with an email address.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `Mailchimp 401` | API key is invalid or the data center is wrong. |
| `Mailchimp 400: Member Exists` | Email already on the list. Not a true failure. |
| Adapter silently skipped | One of `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, or `MAILCHIMP_DC` is missing. |
| `missing email` error | Submission had no email address. |
| `Mailchimp 404` | List ID is wrong or the audience was deleted. |

## Example wrangler commands

```bash
wrangler secret put MAILCHIMP_API_KEY
wrangler secret put MAILCHIMP_LIST_ID
wrangler secret put MAILCHIMP_DC
```
