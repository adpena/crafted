# End-to-End Test Report — Campaign Action Pages v0.2

**Date:** 2026-04-07
**Target:** https://adpena.com (production)
**Test slug:** `test-petition-2026` (left in DB for further verification)
**Tester:** Claude (automated agent)

---

## Summary

| # | Test                              | Status   | Notes                                                            |
|---|-----------------------------------|----------|------------------------------------------------------------------|
| 1 | `create_page` via MCP             | PASS     | Page persisted to D1 successfully                                |
| 2 | `list_pages` via MCP              | PASS     | New page returned with correct headline/action/template          |
| 3 | Render `/action/test-petition-2026` | **FAIL** | Returns HTTP 200 with **empty body** (SSR crash)                 |
| 4 | Embed widget script               | **FAIL** | `/api/_plugin/crafted-action-pages/embed` returns 404            |
| 5 | Embed mode page (`?embed=1`)      | **FAIL** | Same SSR crash as #3 — empty body                                |

**Root cause for #3 / #5:** `src/pages/action/[slug].astro` reads `pageData.type` (legacy field) instead of `pageData.action` (new MCP shape), so any new page is rendered with the wrong action component and the wrong props, leading to a runtime crash inside the action component.

**Root cause for #4:** The plugin's embed route lives at `plugin/src/routes/embed.ts` and is registered through `definePlugin({ routes })` in `plugin/src/sandbox-entry.ts`. Nothing in `src/pages/api/...` exposes those plugin routes through Astro, and the deployed Worker has no plugin runtime that bridges them.

---

## 1. Create page (PASS)

```bash
rtk proxy curl -s -X POST https://adpena.com/api/mcp/actions \
  -H "Content-Type: application/json" \
  -d '{"tool":"create_page","params":{"slug":"test-petition-2026","template":"hero-simple","template_props":{"headline":"Sign the Petition","subhead":"Tell Texas legislators to fund public schools"},"action":"petition","action_props":{"target":"Texas Legislature","show_count":true},"followup":"fundraise","followup_props":{"amounts":[10,25,50,100],"actblue_url":"https://secure.actblue.com/donate/test","refcode":"petition_followup"},"followup_message":"Thanks for signing! Will you also chip in to help us reach more voters?","disclaimer":{"committee_name":"Test Committee","treasurer_name":"Jane Doe"},"theme":"warm"}}'
```

**Response:**
```json
{"data":{"ok":true,"page_id":"48fb8bca-5a7e-4d67-84e6-5b6bf3599c17","url":"/action/test-petition-2026"}}
```

D1 row inserted into `_plugin_storage` with `plugin_id='crafted-action-pages'`, `collection='action_pages'`.

---

## 2. List pages (PASS)

```bash
rtk proxy curl -s -X POST https://adpena.com/api/mcp/actions \
  -H "Content-Type: application/json" \
  -d '{"tool":"list_pages"}'
```

**Response (pretty):**
```json
{
  "data": [
    {
      "id": "48fb8bca-5a7e-4d67-84e6-5b6bf3599c17",
      "slug": "test-petition-2026",
      "title": "Sign the Petition",
      "action": "petition",
      "template": "hero-simple",
      "created_at": "2026-04-07T16:40:20.324Z"
    },
    {
      "id": "demo-1",
      "slug": "demo-donate",
      "title": "Support the Cause",
      "created_at": "2026-04-02 10:39:28"
    }
  ]
}
```

`title` is correctly derived from `template_props.headline`. `action` and `template` round-trip cleanly.

---

## 3. Render the standalone page (FAIL → fixed in source)

```bash
rtk proxy curl -sv https://adpena.com/action/test-petition-2026 -o /tmp/test-page.html
```

**Response:** `HTTP/2 200`, `content-type: text/html`, **0 bytes body**. Repeated with cache busters — always 0 bytes.

For comparison, the legacy seeded page renders fine (11.3 KB):

```bash
rtk proxy curl -s https://adpena.com/action/demo-donate -o /tmp/demo-donate.html
# 11598 bytes — full HTML with hero header, fundraise buttons, disclaimer
```

### Diagnosis

`src/pages/action/[slug].astro` mapped D1 → `ActionPageConfig` with:

```ts
const actionType = pageData.type ?? "fundraise";
```

Legacy rows (`demo-donate`) store `type: "fundraise"`. Rows created via the new `create_page` MCP tool store `action: "petition"` (no `type` field). Result: the renderer received `action: "fundraise"` plus the petition's `action_props` (`target`, `show_count`) and tried to render `FundraiseAction` with `amounts === undefined`. `amounts.map(...)` then throws during SSR, the island returns no HTML, the response body is empty.

This also affected `template_props` indirectly because legacy rows store `title`/`body` while new rows store nested `template_props.headline`/`subhead`. The original mapping handled that, but `title` for the `<title>` tag still pulled `pageData.title` (undefined for new rows).

### Fix applied

`src/pages/action/[slug].astro`:

- Read `pageData.action` first, then fall back to `pageData.type`, then `"fundraise"`.
- Read `<title>` from `pageData.template_props?.headline` first, then `pageData.title`.

`plugin/src/components/actions/FundraiseAction.tsx` (defensive hardening so a partial config never crashes SSR again):

- New `safeAmounts` local that defaults to `[10, 25, 50, 100, 250]` when `amounts` is missing or empty.
- `buildUrl` now `try`/`catch`es invalid `actblue_url` and returns `"#"` instead of throwing on `new URL(undefined)`.

These changes are source-only — **the deployed Worker still serves the broken version until the next build/deploy.** Re-running the curl after deploy should yield a full HTML body containing:

- `<h1>Sign the Petition</h1>`
- `<p>Tell Texas legislators to fund public schools</p>`
- The four petition inputs (`first_name`, `last_name`, `email`, `zip`) and the comment textarea
- `Paid for by Test Committee` followed by `Jane Doe, Treasurer` in the footer
- `--page-bg: #f5f5f0` etc. on the wrapping `<div>` (warm theme)

---

## 4. Embed widget script (FAIL — route not exposed)

```bash
rtk proxy curl -sI "https://adpena.com/api/_plugin/crafted-action-pages/embed?slug=test-petition-2026"
# HTTP/2 404
```

Tried both `/api/_plugin/crafted-action-pages/embed` and `/api/plugins/crafted-action-pages/embed` — both 404.

`plugin/src/routes/embed.ts` is wired into the plugin via `definePlugin({ routes: { embed: { handler: handleEmbed, public: true } } })` in `plugin/src/sandbox-entry.ts`. That registration is meaningful only inside a host that runs the emdash plugin runtime; the deployed Astro/Workers app does not have an Astro page that adapts plugin routes to URLs.

The handler itself is correct: it builds a Shadow-DOM-wrapped `<iframe>` script with the right `iframe.src`, but it cannot be reached.

### Fix recommendation (not applied here)

Add `src/pages/api/_plugin/crafted-action-pages/embed.ts` (and friends for `submit`, `stats`, `page`) that import the plugin handlers and bridge `APIRoute` ↔ `RouteContext`. This is the same shape as `src/pages/api/mcp/actions.ts`, just a thin adapter. The simplest version:

```ts
import type { APIRoute } from "astro";
import { handleEmbed } from "../../../../../plugin/src/routes/embed";

export const GET: APIRoute = async ({ request }) => {
  const result = await handleEmbed(
    { request, input: undefined } as any,
    {} as any,
  );
  return new Response(typeof result.body === "string" ? result.body : JSON.stringify(result.body), {
    status: result.status ?? 200,
    headers: result.headers ?? { "content-type": "application/json" },
  });
};
```

This needs design discussion (which plugin routes should be public, how `PluginContext` is plumbed, etc.) so I am leaving it out of this PR.

---

## 5. Embed mode (`?embed=1`) (FAIL — same root cause as #3)

```bash
rtk proxy curl -sv "https://adpena.com/action/test-petition-2026?embed=1" -o /tmp/embed-page.html
# HTTP/2 200, 0 bytes
```

Same SSR crash as test #3. After the [slug].astro fix lands and is deployed, the embed mode should include the inline `crafted:resize` postMessage script that lives at the bottom of `[slug].astro` (lines 122–145). I verified the script source by reading the file: it sets up a `MutationObserver`, debounces `report()` calls, and posts `{ type: "crafted:resize", height }` to `window.parent`.

---

## Files changed

| Path                                                                                  | Change                                                                                  |
|---------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `src/pages/action/[slug].astro`                                                       | Prefer `pageData.action` over legacy `pageData.type`; fix `<title>` derivation          |
| `plugin/src/components/actions/FundraiseAction.tsx`                                   | Defensive defaults for `amounts`; safe `buildUrl` that handles missing/invalid actblue_url |
| `docs/e2e-action-pages-test.md`                                                       | This report                                                                              |

## Files NOT changed but flagged

- `src/pages/api/mcp/actions.ts` — `create_page` does **not** validate that `action` is one of the known values, nor that `template` exists, nor that `disclaimer.committee_name` is a non-empty string. A typo in `action` would persist a row that crashes the renderer (until the FundraiseAction defensive fix here, then it would render the wrong UI silently). Recommend adding allowlists derived from the existing `TEMPLATES` / `ACTIONS` constants.
- `plugin/src/components/actions/PetitionAction.tsx` — `fieldLabel(text: string)` ignores its `text` parameter; the value is only used as the visible label child. Cosmetic, but the unused parameter is misleading and lints poorly.
- Plugin routes (`embed`, `submit`, `stats`, `page`, `create-page`) are unreachable from the deployed Astro app. Either bridge them via `src/pages/api/_plugin/crafted-action-pages/*` adapters or document that the v0.2 plugin requires the emdash runtime host.
- `e2e/tests/action-page.spec.ts` assumes `/api/plugins/crafted-action-pages/...` which also 404s in production. The path prefix needs to match whatever bridge we settle on.

## Test artifacts

Saved during the run, available locally:

- `/tmp/create-page.json` — successful create response
- `/tmp/list-pages.json` — list response containing both pages
- `/tmp/test-page.html` — empty (0 bytes) — the bug
- `/tmp/test-page.err` — verbose curl headers for the failing request
- `/tmp/embed-page.html` — empty (0 bytes) — same bug
- `/tmp/embed-page.err` — verbose curl headers for the embed mode request
- `/tmp/embed.js` — empty (0 bytes), endpoint 404s
- `/tmp/demo-donate.html` — 11.3 KB control case (legacy shape, renders correctly)
- `/tmp/headers.txt` — initial HEAD response headers

## Next steps

1. Deploy the [slug].astro + FundraiseAction fixes and re-run tests #3 and #5.
2. Decide on a public URL prefix for plugin routes and add Astro adapter pages so the embed widget actually works.
3. Add MCP-side validation in `create_page` so bad payloads are rejected at the API boundary, not at SSR time.
4. Add a Playwright e2e that hits a freshly-created page (via the MCP endpoint) and asserts the H1, the form fields, and the disclaimer — which would have caught this bug before deploy.
