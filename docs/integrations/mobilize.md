# Mobilize America integration

The Mobilize America adapter pushes `event_rsvp` action-page submissions to
the Mobilize attendance API so that RSVPs collected through a Crafted action
page land directly on the canonical Mobilize event shift list.

**Source:** `src/lib/integrations/mobilize.ts`
**Dispatcher:** `src/lib/integrations/index.ts`
**Tests:** `plugin/tests/integrations-mobilize.test.ts`

## Scope and limitations

Mobilize America is an event-centric platform. Its public v1 API
(`https://api.mobilize.us/v1`) exposes write endpoints for events,
attendances, affiliations, and images, but **there is no `POST /people`
endpoint and no native activist-code or person-tagging endpoint**.

As a result, this adapter:

- Handles `event_rsvp` submissions by calling
  `POST /v1/organizations/:org/events/:event/attendances`.
- Silently skips every other action type (`petition_sign`, `gotv_pledge`,
  `signup`, `letter_sent`, `donation_click`, `call_made`). Those should be
  routed to Action Network, NationBuilder, or EveryAction instead — see the
  adapters in `src/lib/integrations/`.

## Getting an API token

1. Sign in to [mobilize.us](https://www.mobilize.us/) as an organization
   admin.
2. Navigate to **Settings → API** (`/admin/settings/api/`).
3. Generate a new token. Mobilize issues long-lived bearer tokens.
4. Copy the token — it will only be shown once.
5. Store it in Cloudflare as the `MOBILIZE_API_TOKEN` secret:
   ```bash
   wrangler secret put MOBILIZE_API_TOKEN
   ```

Rate limits: 5 req/s for write endpoints, 15 req/s for reads, per origin IP.
The adapter uses a 10-second `AbortSignal.timeout` on every call.

## Finding your organization, event, and timeslot IDs

The attendance endpoint requires three numeric identifiers:

| ID | Where to find it |
|----|------------------|
| `organization_id` | Visible in any admin URL, e.g. `https://www.mobilize.us/admin/org/12345/events/`. Set once as `MOBILIZE_ORGANIZATION_ID`. |
| `event_id` | In the event edit URL, e.g. `/admin/org/12345/events/67890/`. |
| `timeslot_id` | Call `GET /v1/events/:event_id` — each entry in the `timeslots` array has a numeric `id`. Each timeslot represents a shift/time option for the event. |

A quick way to enumerate timeslots for a public event without auth:

```bash
curl -s https://api.mobilize.us/v1/events/67890 \
  | jq '.data.timeslots[] | {id, start_date, end_date}'
```

## Configuring the global default (single-event orgs)

Set these Worker secrets if most of your action pages share a single event:

```bash
wrangler secret put MOBILIZE_ORGANIZATION_ID   # required
wrangler secret put MOBILIZE_EVENT_ID          # default event id
wrangler secret put MOBILIZE_TIMESLOT_ID       # default timeslot id
wrangler secret put MOBILIZE_API_TOKEN         # bearer token
```

With all four set, every `event_rsvp` submission is pushed to that event and
timeslot.

## Per-page override

To route a specific action page to a different Mobilize event, set
`action_props.event_ids.mobilize` on the page record in D1. The value is
passed through to the integration as `submission.eventIds.mobilize`.

Two formats are accepted:

- `"67890"` — use the configured `MOBILIZE_TIMESLOT_ID` with this event.
- `"67890:54321"` — use event `67890` and timeslot `54321`, ignoring the
  global defaults for this submission only.

The `MOBILIZE_ORGANIZATION_ID` secret is still required — per-page overrides
cannot change the organization.

Example page record fragment:

```json
{
  "slug": "spring-rally-2026",
  "action_props": {
    "event_ids": {
      "mobilize": "67890:54321"
    }
  }
}
```

The submit endpoint (`src/pages/api/action/submit.ts`) validates the id shape
with `/^[a-zA-Z0-9_-]{1,64}$/` before passing it through; malformed values
are dropped server-side.

## Activist code / tagging feature

Mobilize America does not expose a native person-tagging or activist-code
write endpoint. As a best-effort alternative, set:

```bash
wrangler secret put MOBILIZE_ACTIVIST_CODE
```

When present, the adapter embeds the code on every attendance payload as the
`utm_campaign` value inside the `referrer` object, alongside:

- `utm_source = "crafted"`
- `utm_medium = "action-page"`
- `utm_content = <page slug>`
- `url = <page URL>`

These fields flow into the Mobilize signup record and appear on the CSV
export (`/admin/org/:org/events/:event/attendances/export/`) so downstream
tools can segment attendees by code. Only ASCII alphanumerics plus `-._:`
are allowed in the code, capped at 64 characters.

Invoke the tagging path explicitly with `pushToActivistCode(submission, env)`
if you want to sweep historical submissions — it is idempotent with the
normal `pushToMobilize` dispatch.

## Security and privacy

- Never logs raw PII: errors record HTTP status and the first 200 bytes of
  the response body only, and submissions count successes/failures not
  emails.
- Never throws: every failure becomes `{ ok: false, error: "..." }`.
- 10-second `AbortSignal.timeout` on every request.
- Writes are authenticated via a single bearer token stored as a Worker
  secret — no client-side exposure.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Summary shows `mobilize=false` with `422` | Timeslot id does not belong to the event, or event is archived. |
| Summary shows `mobilize=false` with `401` | Token is missing the organization scope, or was revoked. |
| Adapter silently skipped (no entry in summary) | One of `MOBILIZE_API_TOKEN`, `MOBILIZE_ORGANIZATION_ID`, `MOBILIZE_EVENT_ID`, or `MOBILIZE_TIMESLOT_ID` is unset, or the submission was not an `event_rsvp`. |
| `invalid event id` error | Per-page override contained non-numeric characters. Mobilize ids are numeric. |
