# Campaign Platform Integrations

Crafted action pages sync submissions to 9 campaign platforms in parallel via
the post-submit pipeline (`waitUntil`). Each adapter fires independently; a
failure in one does not block the others.

All adapters live in `src/lib/integrations/` and share the types defined in
`src/lib/integrations/types.ts`.

## Summary

| Integration | Triggers on | Auth method | Key env var |
|-------------|------------|-------------|-------------|
| [Action Network](actionnetwork.md) | All action types | OSDI-API-Token header | `ACTION_NETWORK_API_KEY` |
| [Mailchimp](mailchimp.md) | All action types | HTTP Basic | `MAILCHIMP_API_KEY` |
| [NationBuilder](nationbuilder.md) | All action types | Bearer token | `NATIONBUILDER_API_TOKEN` |
| [EveryAction / NGP VAN](everyaction.md) | All action types | HTTP Basic | `EVERYACTION_API_KEY` |
| [Mobilize America](mobilize.md) | `event_rsvp` only | Bearer token | `MOBILIZE_API_TOKEN` |
| [Eventbrite](eventbrite.md) | `event_rsvp` only | Bearer token | `EVENTBRITE_API_TOKEN` |
| [Facebook Events](facebook.md) | `event_rsvp` only | Bearer token | `FACEBOOK_ACCESS_TOKEN` |
| [SendGrid](sendgrid.md) | All action types | Bearer token | `SENDGRID_API_KEY` |
| [Constant Contact](constantcontact.md) | All action types | Bearer token (OAuth2) | `CONSTANT_CONTACT_API_KEY` |

## How adapters work

1. A form submission hits `POST /api/action/submit`.
2. After the core pipeline (rate limit, Turnstile, geo, dedup, D1 write),
   all configured integrations fire in parallel via `waitUntil`.
3. Each adapter checks whether its required env vars are set. If not, it
   returns `undefined` (silently skipped).
4. If the env vars are present, the adapter builds a platform-specific payload
   and makes an HTTP request with a 10-second timeout.
5. Results are logged in the submission summary as `{platform}=true|false`.

## Event-only integrations

Mobilize America, Eventbrite, and Facebook Events only fire for `event_rsvp`
submissions. They also require per-page event IDs set in
`action_props.event_ids.{platform}`.

## Adding a new integration

1. Create a new adapter in `src/lib/integrations/`.
2. Add env vars to the `IntegrationEnv` interface in `types.ts`.
3. Wire the adapter into the dispatcher in `src/lib/integrations/index.ts`.
4. Add a doc in this directory following the same format.
