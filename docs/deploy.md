# Deploying Crafted

Crafted runs entirely on Cloudflare's free tier: Workers for compute, D1
for the database, KV for edge caching, and R2 for media. A fresh deploy
takes under ten minutes end-to-end.

---

## 1. Prerequisites

- **Cloudflare account** — free tier is sufficient.
  [Sign up](https://dash.cloudflare.com/sign-up).
- **Node 22+** — check with `node --version`.
- **Wrangler CLI** — `npm install -g wrangler` (or use `npx wrangler …`).
- **Git** — for forking and pushing.
- **openssl** — for generating secure tokens.

---

## 2. One-command deploy

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/crafted.git
cd crafted
npm install
wrangler login            # opens browser → authorize
npm run ship              # builds + deploys to your Cloudflare account
```

`npm run ship` is an alias for `npm run build && wrangler deploy`.

You'll get a `*.workers.dev` URL at the end. Point a custom domain at it
(see step 8) when you're happy.

---

## 3. Required secrets

Every secret is set with `wrangler secret put <NAME>` from the project
root. Wrangler prompts for the value and stores it encrypted on Cloudflare.

### Core (required)

| Secret              | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `MCP_ADMIN_TOKEN`   | Bearer token for MCP write tools. Min 32 chars.             |
| `RESEND_API_KEY`    | Transactional email (receipts, letter copies, welcomes).    |
| `RESEND_FROM_EMAIL` | Verified sender (e.g. `alerts@yourdomain.org`).             |
| `TURNSTILE_SECRET`  | Cloudflare Turnstile — bot protection on forms.             |

Generate a strong token:

```bash
openssl rand -hex 32 | wrangler secret put MCP_ADMIN_TOKEN
```

### Optional integrations

Each of these unlocks a specific feature. Omit any you don't need.

| Category | Secret |
| -------- | ------ |
| AI / theme | `ANTHROPIC_API_KEY` |
| Reps lookup | `GOOGLE_CIVIC_API_KEY` |
| Meta Pixel | `META_PIXEL_ID`, `META_ACCESS_TOKEN` |
| Google Ads | `GOOGLE_CONVERSION_ID`, `GOOGLE_CONVERSION_LABEL` |
| Action Network | `ACTION_NETWORK_API_KEY` |
| Mailchimp | `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID`, `MAILCHIMP_DC` |
| NationBuilder | `NATIONBUILDER_NATION_SLUG`, `NATIONBUILDER_API_TOKEN` |
| EveryAction / NGP VAN | `EVERYACTION_API_KEY`, `EVERYACTION_APP_NAME` |
| Mobilize | `MOBILIZE_API_TOKEN`, `MOBILIZE_ORGANIZATION_ID`, `MOBILIZE_EVENT_ID`, `MOBILIZE_TIMESLOT_ID`, `MOBILIZE_ACTIVIST_CODE` |
| Eventbrite | `EVENTBRITE_API_TOKEN` |
| Facebook Events | `FACEBOOK_ACCESS_TOKEN` |
| Unsubscribe signing | `UNSUBSCRIBE_SECRET` |

---

## 4. D1 (database) setup

```bash
wrangler d1 create crafted
```

Copy the `database_id` from the output into the `[[d1_databases]]` block
in `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "crafted",
      "database_id": "paste-the-id-here"
    }
  ]
}
```

Apply the schema migrations:

```bash
wrangler d1 migrations apply crafted --remote
```

---

## 5. KV (edge cache) setup

```bash
wrangler kv namespace create CACHE
```

Copy the `id` into the `[[kv_namespaces]]` block in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    { "binding": "CACHE", "id": "paste-the-id-here" }
  ]
}
```

---

## 6. R2 (media bucket) setup

```bash
wrangler r2 bucket create crafted-media
```

`wrangler.jsonc` already references the bucket under the `r2_buckets`
binding — just make sure the name matches.

---

## 7. Initial seed

```bash
# Content (writing, design, dev, policy collections)
emdash seed

# Demo action pages (six preloaded examples)
tsx scripts/seed-demo-pages.ts
```

You can re-run either command safely — both are idempotent by slug.

---

## 8. Custom domain

### Via dashboard

1. Cloudflare dashboard → **Workers & Pages** → your worker → **Settings**
   → **Triggers**.
2. Click **Add Custom Domain**.
3. Enter e.g. `example.org`. Cloudflare handles DNS if the domain is on
   Cloudflare; otherwise update DNS at your registrar.

### Via wrangler

```bash
wrangler deployments domain add example.org
```

HTTPS certificates are issued automatically and usually live within a
minute.

---

## 9. Monitoring

| Thing               | Where                                                        |
| ------------------- | ------------------------------------------------------------ |
| Live request logs   | `wrangler tail` (terminal) or dashboard → worker → **Logs**  |
| Analytics Engine    | Dashboard → **Analytics & Logs** → **Analytics Engine**      |
| D1 query usage      | Dashboard → **Workers & Pages** → **D1** → your database     |
| KV reads/writes     | Dashboard → **Workers & Pages** → **KV** → your namespace    |
| Scanner blocks      | Dashboard → **Security** → **Events** (filter on WAF rules)  |

Crafted writes submission and conversion events to Analytics Engine with
the `ACTIONS_ANALYTICS` binding. You can query them from the dashboard
with SQL:

```sql
SELECT blob1 AS page_id, COUNT(*) AS conversions
FROM ACTIONS_ANALYTICS
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob1
ORDER BY conversions DESC;
```

---

## 10. Troubleshooting

### `Error 1101 Worker threw exception`

Almost always a missing binding or secret. Check `wrangler tail` for the
real error, then `wrangler secret list` to confirm everything's set.

### `D1_ERROR: no such table: pages`

Migrations haven't been applied. Run:

```bash
wrangler d1 migrations apply crafted --remote
```

### Static CSS returns 0 bytes

Cloudflare Workers has a filename bug: Astro scoped CSS files with `@`
characters can be served empty. Put shared styles in
`src/styles/global.css` (see `CLAUDE.md` → "Known platform issues").

### `MCP_ADMIN_TOKEN not configured — denying all writes`

The MCP server fail-closes in production without the token set:

```bash
openssl rand -hex 32 | wrangler secret put MCP_ADMIN_TOKEN
```

### `Turnstile: invalid-input-secret`

The `TURNSTILE_SECRET` you set doesn't match the site key on the page.
Double-check the pair in the Cloudflare dashboard under **Turnstile**.

### Custom domain shows `525 SSL handshake failed`

Cert hasn't been issued yet. Wait a minute, or force-reissue via the
dashboard under **SSL/TLS** → **Edge Certificates**.

### `emdash seed` errors with `UNIQUE constraint failed`

Seed already ran. Either skip it, or wipe the DB and re-run:

```bash
wrangler d1 execute crafted --remote --command="DELETE FROM entries WHERE 1=1;"
```

(Use with care — this nukes all content.)
