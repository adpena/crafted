---
title: "Building Action Network on Cloudflare's free tier"
summary: "How I built a production-hardened campaign action pages platform with 875 tests, 8 action types, 7 integrations, and AI-generated pages — all running for $0/month"
excerpt: "How I built a production-hardened campaign action pages platform with 875 tests, 8 action types, 7 integrations, and AI-generated pages — all running for $0/month"
publication: "self-published"
date: 2026-04-07
topic: "Campaign technology"
link: "https://adpena.com/work/writing/building-action-network-on-cloudflare"
---

## The problem

Action Network starts at $59 a month and climbs past $1500 for anything that looks like a real campaign. It is closed source, US-centric, and the reporting lags real time by enough that it is never quite the source of truth you want during a launch. On top of the subscription, campaign engineers routinely burn thousands of dollars of billable time wiring up petition pages to the CRM, then wiring the CRM to the ad platforms, then wiring the ad platforms to the email vendor. Most of that glue work is the same job, done again, per client.

I wanted to see whether I could build the whole thing — the petitions, the letters, the event RSVPs, the email blasts, the platform integrations, the admin surface, the AI assist — for free, on Cloudflare's edge, end to end. Not a demo. A platform I would be willing to put a paying client on.

This is a writeup of how that went.

## The architecture

The platform runs entirely on Cloudflare's free tier primitives:

- **Cloudflare Workers** for compute
- **D1** (SQLite) for submissions, page configs, and contact upserts
- **KV** for rate limiting, submission counters, and the edge cache
- **R2** for uploaded media and exported submission CSVs
- **Turnstile** for bot protection

The frontend is Astro 6 with React 19 islands. Only the action forms themselves are interactive — the rest of the page is static HTML streamed from the edge. Templates and themes are composed in an emdash CMS plugin so a non-engineer can build a page without touching code.

The hot path has zero external dependencies. No Redis. No managed queue. No Postgres. No third-party API waits before the user sees a thank-you state. Everything happens either inside the Worker or inside `waitUntil()` after the response has already shipped.

## The hot path

When a supporter signs a petition, here is what the Worker does before it sends the response:

1. **Rate limit check.** A fixed-window counter in KV keyed by a SHA-256 hash of the client IP plus the page slug. Fixed window, not sliding — more on that in the security section.
2. **Turnstile verification.** Fail-closed: if the token is missing or the sitekey cannot be reached, the submission is rejected. No "probably fine" fallback.
3. **Geo filter.** The Worker reads `cf-ipcountry` and checks it against the page's whitelist or blacklist. Pages targeting a US Senate race do not take signatures from the EU.
4. **Email deduplication.** SHA-256 hash of the normalized email, scoped to the page slug. If we have seen this supporter on this page before, we mark the submission as a duplicate and still succeed — the supporter does not need to know their signature did not increment the counter.
5. **D1 write.** A single prepared-statement insert into the submissions table.
6. **Response sent.**

That is everything the user waits for. In production the p50 for that path is under 80ms from the edge city nearest the supporter.

Everything else — the KV counter update for the public progress bar, the Resend thank-you email, the Meta CAPI event, the Google Ads conversion, the seven campaign-platform syncs, the contact-record upsert — runs inside `ctx.waitUntil()` after the response has already been sent. All of the async tasks fire in parallel through a single `Promise.allSettled`, so a slow third-party integration cannot block a fast one, and a broken one cannot break the rest. Each adapter logs its own failure to a small error table so the admin UI can show which platforms are degraded without the supporter ever knowing.

## The security story

I ran three security audit passes against the platform, each one trying to break what the previous one had built. The audits turned up twenty-plus real issues. All of them are fixed. A few are worth calling out because they are the kind of thing I see constantly in campaign tooling:

**Centralized, timing-safe Bearer auth.** Every admin route goes through a single `requireAdmin()` helper that does a constant-time comparison against an HMAC key derived from the admin token, not against the token itself. Early versions compared a bare string against a constant module export. That is a timing side channel and it is trivial to exploit with a stopwatch and a loop.

**SSRF-safe brand extraction.** The AI brand extractor fetches arbitrary URLs to pull logos and colors out of a campaign site. Arbitrary fetches from a Worker are a SSRF risk — somebody could point it at `http://169.254.169.254/` or an internal admin panel behind Cloudflare Access. The fetcher rejects private IPv4 ranges, IPv6 link-local, loopback, and the AWS metadata endpoint before it dials, and it re-validates every hop in the redirect chain instead of trusting the final resolved URL.

**CRLF injection in ICS files.** Calendar files for events are generated server-side. A naive implementation interpolates the event title into a `SUMMARY:` line. If the title contains `\r\n`, an attacker can inject arbitrary ICS properties — including phishing URLs that calendar clients will happily render. The generator strips and escapes control characters before any interpolation.

**Payload size enforced by reading bytes.** `Content-Length` is a hint, not a promise. The Worker reads the request body into a bounded buffer and counts bytes as they arrive, rejecting the request the moment it exceeds the limit. Trusting the header would let a malicious client announce 1KB and stream 50MB.

**Fixed-window rate limits, not sliding.** Sliding-window rate limits are elegant but they can be beaten by an attacker who paces requests to straddle the window edge. Fixed windows are less theoretically clean but they are much harder to game in practice, especially against a distributed attack.

**SHA-256 everywhere for privacy hashing.** Rate limiting hashes the IP before storing it. Deduplication hashes the email before storing it. The Worker never writes a raw IP or a raw email to KV. If somebody dumps the store, they get hashes.

## The browser compatibility story

All eight action components — petition, letter-to-rep, event RSVP, donation, volunteer signup, survey, pledge, and share-this — work on Chrome, Safari, Firefox, and Edge across desktop and mobile. That took more work than the security pass did.

Every `fetch` from the client has a 15-second `AbortController` timeout with explicit `TimeoutError` handling. A dead network should show a retry prompt, not a spinner that never resolves. iOS Safari does not honor the `download` attribute on an anchor for `.ics` files, so the event RSVP component detects iOS and opens the ICS in a new window instead. Every interactive target is at least 44 by 44 pixels — the Apple Human Interface Guidelines minimum and the WCAG 2.5.5 AAA minimum. I removed every `outline: none` from the action component styles and restored focus rings for keyboard users (WCAG 2.4.7). Every input has a paired `htmlFor` and `id`, and every error message uses `role="alert"` so screen readers announce it.

None of this is glamorous. All of it was load-bearing the first time a real supporter hit the page on an iPhone SE.

## The AI layer

There are three places the platform uses AI, and none of them are in the supporter's hot path.

**Brand extraction.** Give the platform a URL and it fetches the page, parses the HTML, walks the computed stylesheets, and extracts primary and secondary colors, typography, and the logo. It then generates four theme variants — light, dark, high-contrast, and monochrome print — and lets the admin pick one. The extractor is a port from another project of mine; it has zero external dependencies and runs inside the Worker.

**AI page generator.** An admin types "three-week petition to stop the Austin highway expansion, collect email and zip, target Texas only, progress bar to 10k signatures" and the generator emits a complete, validated `ActionPageConfig` object through the Anthropic API. The admin reviews the config, tweaks what they want, and publishes. Typical cost: about a cent per generated page.

**AI headline variants.** The admin can ask for five headline variations for a page and then run them through the edge A/B test without leaving the admin UI. The winner gets promoted automatically once it clears a configurable confidence threshold.

## The integration layer

This is the killer feature, and it is the part that is normally the most expensive to build and maintain in-house.

Seven campaign-platform adapters fire in parallel on every submission:

- Action Network
- Mailchimp
- NationBuilder
- EveryAction / NGP VAN
- Mobilize America (with per-page event ID support for RSVP syncs)
- Eventbrite
- Facebook Events via the Conversions API Lead event

One signature on a petition fans out to every platform the organization uses, simultaneously, in a single `Promise.allSettled`. The org's digital director does not reconcile spreadsheets on Monday morning. The field director sees the new volunteer in NationBuilder before the supporter has closed the browser tab. The ad buyer sees the conversion in Meta Ads Manager within the hour.

Each adapter is a single TypeScript file implementing a common `PlatformAdapter` interface: `syncContact`, `syncEvent`, `syncDonation`. Adding a new platform is roughly a day of work plus a test suite.

## The testing discipline

875 tests across 17 files. The breakdown:

- Unit tests for every utility: rate limiting, geo filter, deduplication, email template rendering, ICS generation, URL validation, HMAC comparison.
- 675 property-based fuzz tests using randomized Unicode, SQL injection strings, XSS payloads, CRLF sequences, and multi-megabyte blobs.
- Component tests for the progress bar and every action component.
- Template tests for the hero and landing templates.
- Web component tests for the embeddable drop-in script.

The property-based fuzz tests caught real bugs that example-based tests missed. A URL encoder that threw an exception on lone Unicode surrogates. A regex that ReDoS'd on a specific combining-mark sequence. A progress-bar prop validator that crashed when the current count was a `BigInt`. None of those would have come up through hand-written examples. All of them would have come up in production eventually.

## The cost breakdown

Cloudflare Workers free tier: 100,000 requests per day. That is enough headroom for roughly three million supporter actions per month before I have to think about upgrading.

- **D1:** 5 million reads per day free, 100,000 writes per day free.
- **KV:** 100,000 reads per day free, 1,000 writes per day free.
- **R2:** 10GB storage free, 1 million Class A operations per month free.
- **Turnstile:** unlimited, free, forever.
- **Resend:** 3,000 emails per month free, $20 per month for 50,000 after that.
- **Anthropic API:** pay-per-use, roughly a cent per AI-generated page, zero cost when not used.

Fixed monthly cost to run this platform for a small-to-mid campaign: **$0.** The only variable cost is transactional email past 3,000 sends, and even that tops out at $20. A comparable Action Network plan for the same feature set is somewhere between $250 and $1,500 a month.

## What I would do differently

**Durable Objects from day one for atomic counters.** I am currently using a KV read-modify-write for the public progress bar counter and documenting the eventual-consistency window. That is fine, but a Durable Object with a single-writer counter is the right answer and it would eliminate a class of "my progress bar ticked backwards" bug reports I know are coming.

**A typed ORM over raw D1 prepare and bind.** I started with raw prepared statements because I wanted to understand the D1 shape without a layer of indirection. I now understand it fine and I would reach for `drizzle-orm` or equivalent for the next version just to get compile-time column-name checking.

**Ship Storybook stories for the admin UI earlier.** The admin surface ended up with three different date pickers in three different places before I caught it.

**Write the case study as I went.** This one, specifically. I forgot half the rabbit holes.

## What is next

Admin UI polish. Deploy the six live demos to `adpena.com/action/*`. Open-source the plugin under `@adpena/action-pages`. Write the docs site. Talk to campaigns. If you run a campaign and you want to stop paying $1,500 a month for a platform that emails you your own data twelve hours late, get in touch.

## Links

- Live demos: `adpena.com/action/*` (six example pages)
- GitHub: `github.com/adpena/crafted`
- npm: `@adpena/action-pages`
