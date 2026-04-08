# Eventbrite integration

The Eventbrite adapter syncs `event_rsvp` submissions as attendees on an
Eventbrite event, so RSVPs from Crafted action pages are reflected in the
Eventbrite dashboard.

**Source:** `src/lib/integrations/eventbrite.ts`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EVENTBRITE_API_TOKEN` | Yes | Personal OAuth token from Eventbrite |

The event ID is set per-page via `submission.eventIds.eventbrite`, not as a
global env var.

## Setup instructions

1. Sign in to [eventbrite.com](https://www.eventbrite.com/).
2. Go to [eventbrite.com/platform/api](https://www.eventbrite.com/platform/api)
   and create a personal OAuth token.
3. Store it as a Cloudflare Worker secret:
   ```bash
   wrangler secret put EVENTBRITE_API_TOKEN
   ```
4. For each action page, set the Eventbrite event ID in the page's
   `action_props.event_ids.eventbrite` field. The event ID is the numeric ID
   visible in the event URL on Eventbrite.

## What gets synced

| Submission field | Eventbrite field |
|-----------------|-----------------|
| `email` | `attendee.profile.email` |
| `firstName` | `attendee.profile.first_name` |
| `lastName` | `attendee.profile.last_name` |

The adapter creates an attendee record via
`POST /v3/events/{event_id}/attendees/`.

## Which action types trigger it

Only `event_rsvp`. All other action types are silently skipped.

The per-page event ID (`submission.eventIds.eventbrite`) must also be set for
the adapter to fire.

## Limitations

- **Paid events**: Eventbrite's API does not support creating attendees for
  paid events without going through the checkout flow. The adapter returns
  `ok: true` for 403/405 responses from paid events (known limitation).
- **Free events**: Works as expected for free/RSVP events.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `Eventbrite 401` | OAuth token is invalid or expired. |
| `Eventbrite 403` or `405` (treated as success) | Event is paid. Eventbrite rejects direct attendee creation for paid events. |
| Adapter silently skipped | `EVENTBRITE_API_TOKEN` not set, or submission type is not `event_rsvp`, or `eventIds.eventbrite` is not set on the page. |
| `Eventbrite 404` | Event ID is wrong or the event was deleted. |

## Example wrangler command

```bash
wrangler secret put EVENTBRITE_API_TOKEN
```
