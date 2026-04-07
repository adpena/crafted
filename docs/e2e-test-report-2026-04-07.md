# E2E Production Test Report — 2026-04-07

**Site:** https://adpena.com  
**Plugin:** Campaign Action Pages (`/Users/adpena/Projects/crafted/plugin`)  
**Notifications:** `@crafted/notifications` (`/Users/adpena/Projects/notifications`)  
**Tools used:** Chrome DevTools MCP (primary), Playwright MCP (responsive/WebKit), Node.js HTTPS (API/endpoint tests)  
**Tester:** Claude (automated)  

---

## Summary

| Category | Result |
|---|---|
| Endpoint smoke tests | PASS (11/11) |
| Security headers | PASS (5/5) |
| Scanner blocking | PASS (4/4) |
| MCP tools | PARTIAL — 7/8 pass; `get_submissions` requires page_id (correct), all tools functional |
| Action page rendering | PARTIAL — 3/5 templates render; `hero-layered` and `hero-split` blank (critical bug) |
| Disclaimer text | FAIL — committee name not shown (field name mismatch) |
| Embed mode (?embed=1) | PASS — resize script present, standalone layout correct |
| Web component JS | FAIL — 404 in production (route not registered) |
| Responsive layout | PASS — no horizontal overflow at any viewport |
| Touch targets | PARTIAL — 3 issues found (nav links, contact inputs, X social link) |
| Notifications package | PASS — 53/53 tests |
| Plugin unit tests | PASS — 85/85 tests |
| Lighthouse (desktop) | Accessibility: 100, Best Practices: 96, SEO: 100 (Performance not measured by tool) |
| Console errors | FAIL — React hydration error #418 on home page (Chrome) |

---

## 1. Endpoint Smoke Tests

All endpoints return correct status codes and content types.

| Endpoint | Expected | Actual Status | Content-Type |
|---|---|---|---|
| `/` | 200 | 200 | text/html |
| `/about` | 200 | 200 | text/html |
| `/contact` | 200 | 200 | text/html |
| `/404-test` | 404 | 404 | text/html |
| `/rss.xml` | 200 + valid XML | 200 ✓ (12 items) | application/rss+xml; charset=utf-8 |
| `/sitemap.xml` | 200 + valid XML | 200 ✓ (15 URLs) | application/xml; charset=utf-8 |
| `/api/mcp/demo` | 200 JSON | 200 ✓ (8 tools, name=molt-demo) | application/json |
| `/api/mcp/actions` | 200 JSON | 200 ✓ (8 tools, name=action-pages) | application/json |
| `/favicon.svg` | 200 | 200 | image/svg+xml |
| `/og.png` | 200 | 200 | image/png |
| `/robots.txt` | 200 | 200 | text/plain |

**PASS — 11/11**

---

## 2. Security Headers

All required headers present and correctly configured.

| Header | Value | Status |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | PASS |
| `Content-Security-Policy` | Full policy (default-src 'self', no unsafe-eval, object-src 'none') | PASS |
| `X-Content-Type-Options` | `nosniff` | PASS |
| `X-Frame-Options` | `DENY` | PASS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | PASS |

Additional headers observed: `X-XSS-Protection: 0` (correct — modern browsers ignore it), Cloudflare CF-Ray, NEL reporting.

**Notes:** CSP includes `'unsafe-inline'` for scripts and styles. This is required for Astro's inline hydration scripts and is acceptable, but worth revisiting with a nonce-based approach for future hardening.

**PASS — 5/5**

---

## 3. Scanner Blocking

All sensitive paths correctly return 403.

| Path | Expected | Actual |
|---|---|---|
| `/.env` | 403 | 403 |
| `/.git/config` | 403 | 403 |
| `/wp-login.php` | 403 | 403 |
| `/phpmyadmin` | 403 | 403 |

**PASS — 4/4**

---

## 4. MCP Tools — `/api/mcp/actions`

**GET** returns full tool manifest with 8 tools and transport=http. ✓

### Tool Results

| Tool | Expected | Result | Notes |
|---|---|---|---|
| `list_templates` | 5 templates | 5 ✓ | hero-simple, hero-media, hero-story, hero-layered, hero-split |
| `list_actions` | 4 actions | 4 ✓ | fundraise, petition, gotv, signup |
| `list_themes` | 3 themes | 3 ✓ | warm, bold, clean |
| `generate_theme` | Returns theme vars | PARTIAL ⚠ | Returns valid themes but 2 prompts produce unusable results (see below) |
| `create_page` | Creates pages | 5/5 ✓ | All 5 templates accepted, returns page_id + url |
| `get_page` | Returns page data | 5/5 ✓ | Correct template + action for each |
| `list_pages` | Shows all created | 7 total ✓ | All 5 test pages appear |
| `get_submissions` | Empty list | 0 submissions ✓ | Correctly returns empty array for new page |

**Total: 8/8 tools functional**

### generate_theme Quality Issues (Medium severity)

5 prompts tested. 2 produce unusable themes:

| Prompt | bg | text | accent | Issue |
|---|---|---|---|---|
| "dark blue" | #0a0a0a | #ffffff | #2563eb | ✓ Good |
| "warm earthy" | #f5f5f0 | #1a1a1a | #1a1a1a | ⚠ accent === text — CTA buttons use same color as body text, nearly invisible |
| "minimal white" | #ffffff | #1a1a1a | #ffffff | ⚠ accent === background — CTA buttons invisible on white bg |
| "campaign red" | #f5f5f0 | #1a1a1a | #dc2626 | ✓ Good |
| "midnight elegant" | #0a0a0a | #ffffff | #ef4444 | ✓ Good |

**Fix recommendation:** In `generateTheme()` in `/src/pages/api/mcp/actions.ts`, when starting from the "warm" base, the `--page-accent` defaults to `#1a1a1a` (same as text). Add a fallback rule: if the generated accent matches the background or text color, substitute a contrasting default (e.g., `#2563eb` on light backgrounds, `#ef4444` on dark).

---

## 5. Action Page Rendering

### Template rendering status

All pages created via `create_page` MCP tool, then loaded in browser.

| Template | Slug | Headline | Form/Action | Theme CSS Vars | Status |
|---|---|---|---|---|---|
| hero-simple | test-e2e-hero-simple | ✓ "Stand With Us for Change" | ✓ petition (5 fields) | ✓ Applied | PASS |
| hero-media | test-e2e-hero-media | ✓ "Invest in Our Future" | ✓ fundraise (amount btns) | ✓ Applied | PASS |
| hero-story | test-e2e-hero-story | ✓ "Our Story" | ✓ signup (name + email) | ✓ Applied | PASS |
| hero-layered | test-e2e-hero-layered | ✗ Empty page | ✗ No form | ✗ Not applied | **FAIL** |
| hero-split | test-e2e-hero-split | ✗ Empty page | ✗ No form | ✗ Not applied | **FAIL** |

### Critical Bug — hero-layered and hero-split not registered

**Severity: Critical**

Console error observed in Chrome: `[ActionPageRenderer] template not found: hero-layered` (same for `hero-split`).

**Root cause:** `ActionPageIsland.tsx` only registers three templates into the renderer's registry:

```ts
// src/components/ActionPageIsland.tsx (lines 30-35)
if (!templates.has("hero-simple")) {
  templates.register("hero-simple", HeroSimple as any);
  templates.register("hero-media", HeroMedia as any);
  templates.register("hero-story", HeroStory as any);
  // HeroLayered and HeroSplit are MISSING
}
```

Both `HeroLayered.tsx` and `HeroSplit.tsx` exist in the plugin source and are registered in the plugin's own `templates/index.ts`, but `ActionPageIsland.tsx` was never updated when these templates were added.

**Fix:** Add the missing imports and registrations to `ActionPageIsland.tsx`:

```ts
import { HeroLayered } from "../../plugin/src/components/templates/HeroLayered.tsx";
import { HeroSplit } from "../../plugin/src/components/templates/HeroSplit.tsx";

// Inside the guard block:
templates.register("hero-layered", HeroLayered as any);
templates.register("hero-split", HeroSplit as any);
```

### Bug — Disclaimer shows "Paid for by" with no committee name

**Severity: High**

All action pages show `Paid for by` with no committee name, even when `disclaimer.committee` was passed to `create_page`.

**Root cause:** Field name mismatch. The MCP `create_page` handler in `actions.ts` stores the disclaimer as-is (`disclaimer: p.disclaimer`) — so the object is `{committee: "...", address: "..."}`. But `ActionPageRenderer.tsx` reads `page.disclaimer.committee_name`:

```ts
// ActionPageRenderer.tsx line 149
<Disclaimer
  committee_name={page.disclaimer.committee_name}  // reads "committee_name"
  treasurer_name={page.disclaimer.treasurer_name}
/>
```

The `[slug].astro` route passes `pageData.disclaimer` directly. Since the stored field is `committee` (not `committee_name`), it's always `undefined`.

**Fix (Option A — normalize in MCP handler):** Map `committee` → `committee_name` before storing:
```ts
disclaimer: {
  committee_name: (p.disclaimer as any).committee_name ?? (p.disclaimer as any).committee ?? "",
  treasurer_name: (p.disclaimer as any).treasurer_name ?? (p.disclaimer as any).treasurer ?? "",
}
```

**Fix (Option B — normalize in slug.astro):** In `[slug].astro`, when building `actionConfig.disclaimer`, normalize the field names.

**Fix (Option C — normalize in Disclaimer component):** Accept both `committee` and `committee_name` as props.

Option A (normalize at write time) is cleanest.

### Embed Mode (?embed=1)

**PASS** — Embed mode is correctly implemented. The action page has its own standalone `<html>` layout (no site nav/footer). When `?embed=1` is set, a `crafted:resize` postMessage script is injected so the containing iframe auto-sizes. Navigation to `/action/test-e2e-hero-simple?embed=1` confirmed: no site chrome, resize script present.

### form field id/name missing (Low severity)

Console warning: `A form field element should have an id or name attribute`. Affects the FundraiseAction custom amount input. Fix: add `name="custom-amount"` and `id="custom-amount"` to the input field.

---

## 6. Web Component (`/api/_plugin/crafted-action-pages/web-component.js`)

**Severity: High**

The endpoint returns **404** in production. The route handler `web-component.ts` exists in the plugin source but there is no corresponding Astro page or route file to serve it.

**Source code analysis (local):**
- Script size: 4,469 bytes (**exceeds 4KB target by ~370 bytes**)
- Self-registers `crafted-action-page` custom element ✓
- No `innerHTML` usage ✓
- No `eval` usage ✓
- No `document.write` usage ✓
- Slug validated with `SLUG_RE = /^[a-z0-9][a-z0-9-]*$/` before use ✓
- No `sandbox` attribute on iframe (minor security hardening opportunity)

**Fix:** Create `/src/pages/api/_plugin/crafted-action-pages/web-component.js.ts` as an Astro API route that serves the `WEB_COMPONENT_SCRIPT` string from the plugin:

```ts
// src/pages/api/_plugin/crafted-action-pages/web-component.js.ts
import type { APIRoute } from "astro";
import { WEB_COMPONENT_SCRIPT } from "../../../../plugin/src/routes/web-component.ts";

export const GET: APIRoute = () => {
  return new Response(WEB_COMPONENT_SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
```

Also consider trimming the script by ~370 bytes to meet the sub-4KB target.

---

## 7. Mobile Responsive Testing

Tested viewports: Desktop (1440×900), Tablet (768×1024), Mobile iPhone 14 (390×844), Mobile iPhone SE (320×568)

Pages tested: `/`, `/about`, `/contact`, `/action/test-e2e-hero-simple`

| Check | Desktop | Tablet | Mobile | Mobile SE |
|---|---|---|---|---|
| No horizontal overflow | ✓ | ✓ | ✓ | ✓ |
| Home page renders | ✓ | ✓ | ✓ | ✓ |
| About page renders | ✓ | ✓ | ✓ | ✓ |
| Contact form renders | ✓ | ✓ | ✓ | ✓ |
| Action page renders | ✓ | ✓ | ✓ | ✓ |
| Nav links visible | ✓ | ✓ | ✓ | ✓ |

### Touch Target Issues

**Small touch targets found (< 44px on any dimension):**

1. **"Skip to content" link** — 159×40px (height 40px, 4px short). All viewports. Low priority (accessibility aid, rarely interacted with by touch).

2. **Contact form inputs (Name, Email)** — height 32px on mobile. Both inputs fail the 44px minimum height requirement. Medium priority — these are the primary interactive elements on the contact page.
   - Fix: Add `min-height: 44px; padding: 0.5rem;` to contact form inputs.

3. **"X" social link on About page** — 7×44px (width 7px). The link text is a single "X" character with no padding around it, making it essentially untappable on mobile. High priority.
   - Fix: Add `min-width: 44px; display: inline-flex; align-items: center; justify-content: center;` to `.social-link`, or wrap the icon in a larger tap area.

4. **"All" work filter button** — 23×44px (width only 23px). The height is fine but the width is too narrow for reliable touch targeting. Low-medium priority.
   - Fix: Add `min-width: 44px;` to filter buttons.

5. **Nav links at desktop** — "Work" (34×24px), "About" (42×24px), "Contact" (59×24px). These are under 44px tall at desktop. At tablet/mobile (768px+) they expand to 44px height and pass. Desktop-only low priority.

---

## 8. Notifications Package (`@crafted/notifications`)

**PASS — 53/53 tests**

Note: The specification said "35 tests passing" but the actual count is 53. Either additional tests were added since the spec was written, or the spec number was an estimate. All pass.

Test files:
- `util.test.ts` — 15 tests ✓
- `action-network.test.ts` — 9 tests ✓ (includes DRY_RUN, empty env, error cases)
- `everyaction.test.ts` — 10 tests ✓ (includes DRY_RUN, mode override, auth)
- `hubspot.test.ts` — 13 tests ✓ (includes DRY_RUN, 409 upsert conflict)
- `dispatch.test.ts` — 6 tests ✓ (parallel execution, failure isolation)

DRY_RUN mode verified working for: Action Network, EveryAction, HubSpot Forms, HubSpot Contacts adapters.

All adapters gracefully skip when env vars are missing (`isConfigured` returns false, `notifyAll` skips unconfigured adapters without throwing).

---

## 9. Plugin Unit Tests

**PASS — 85/85 tests**

```
✓ tests/disclaimers.test.ts     (11 tests)
✓ tests/geo-ask.test.ts         (4 tests)
✓ tests/validate.test.ts        (10 tests)
✓ tests/web-component.test.ts   (23 tests)
✓ tests/themes.test.ts          (7 tests)
✓ tests/registry.test.ts        (6 tests)
✓ tests/ab-assign.test.ts       (6 tests)
✓ tests/hero-templates.test.ts  (18 tests)

8 test files — 85 tests — 1.10s
```

Note: The web-component test suite passes all 23 tests, but this tests the source `WEB_COMPONENT_SCRIPT` string — not whether the route is actually accessible at production URL. The 404 for the served endpoint is a deployment gap.

---

## 10. Performance

Lighthouse MCP tool ran in navigation mode on `https://adpena.com/` (desktop):

| Category | Score |
|---|---|
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 100 |
| Performance | Not measured (MCP tool limitation — audit categories limited to a11y, best-practices, seo) |

**Best Practices regression from 100 → 96:** One failed audit — `errors-in-console` (React hydration error #418). This is the only factor pulling the Best Practices score from 100 to 96.

For comparison with previous baseline (100/100/96):
- Accessibility: 100 (maintained)
- Best Practices: 96 → 96 (maintained, but now failing due to console error rather than whatever the previous reason was)
- SEO: 100 (maintained)
- Performance: 100 (previous) — not re-measured in this run

The site architecture (Astro SSR, Cloudflare Workers, KV edge cache) remains well-suited for high performance. Network requests on home page load: 13 requests total (CSS, JS modules, Cloudflare RUM, favicon).

---

## 11. Console Errors

### React Hydration Error #418 (Home page — Chrome)

**Severity: Medium**

Observed in Chrome DevTools (not in Playwright Chromium — may be timing-dependent or Chrome-version-specific):

```
Uncaught Error: Minified React error #418; args[0]=text, args[1]=(empty)
```

React error #418 is a hydration mismatch: the server-rendered HTML text node doesn't match what React expects on the client. The error arguments `text` and `` (empty string) indicate a text node present in SSR that is missing/empty on the client (or vice versa).

The affected component is `WorkListing` (loaded as `WorkListing.BWFr_j87.js` React island). This is likely a whitespace or conditional text node that differs between SSR and hydration.

**Fix recommendation:** Inspect the `WorkListing` component for conditional text rendering that may produce different output server-side vs. client-side. Common causes include: browser-only data (`window`, `localStorage`), Date formatting differences, or a `{condition && <text>}` where the condition differs during hydration.

---

## Issues Summary

### Critical (fix before launch)

1. **`hero-layered` and `hero-split` templates not registered in `ActionPageIsland.tsx`** — Both templates render blank pages with `[ActionPageRenderer] template not found` error. These are advertised as available templates in `list_templates`. File: `/src/components/ActionPageIsland.tsx`.

### High (fix soon)

2. **Web component endpoint 404** — `/api/_plugin/crafted-action-pages/web-component.js` returns 404. The embed workflow described in docs is completely broken. Fix: add Astro API route to serve `WEB_COMPONENT_SCRIPT`.

3. **Disclaimer committee name not rendered** — All action pages show "Paid for by" with no committee name. Field key mismatch: MCP stores `disclaimer.committee`, renderer reads `disclaimer.committee_name`. Fix: normalize at write time in `actions.ts` create_page handler.

### Medium

4. **React hydration error #418 on home page** — Intermittent in Chrome. Causes Best Practices score to fail `errors-in-console` audit. Fix: inspect `WorkListing` island for SSR/CSR conditional text mismatch.

5. **Contact form input touch targets below 44px** — Name and Email inputs are 32px tall on mobile. Fix: `min-height: 44px` on inputs.

6. **`generate_theme("warm earthy")` produces unusable accent** — Accent `#1a1a1a` on background `#f5f5f0` with text also `#1a1a1a` — CTA buttons visually invisible. Fix: add contrast check fallback in `generateTheme()`.

7. **`generate_theme("minimal white")` produces invisible accent** — Accent `#ffffff` on background `#ffffff`. Fix: same as above.

8. **Web component script 369 bytes over 4KB target** — Script is 4,469 bytes. Fix: minify string constants, combine style declaration.

### Low

9. **"X" social link tap target 7px wide** — Single character with no padding. Fix: `min-width: 44px` on `.social-link`.

10. **"All" work filter button 23px wide** — Width below 44px tap target. Fix: `min-width: 44px`.

11. **Action form input fields missing `name`/`id` attributes** — Console warning in Chrome. Fix: add `name` and `id` to FundraiseAction custom amount input.

12. **Web component iframe lacks `sandbox` attribute** — Minor security hardening. Consider adding `sandbox="allow-forms allow-scripts allow-same-origin"`.

13. **CSP uses `'unsafe-inline'`** — Required for Astro, but document for future nonce-based hardening.

---

## Production Readiness Assessment

The core site (`adpena.com`) is **production-ready**: endpoints, security headers, scanner blocking, accessibility (100), SEO (100), and responsive layout all pass without issues.

The **Campaign Action Pages plugin** is **not fully production-ready** due to:
- 2 of 5 advertised templates being broken (hero-layered, hero-split)
- Disclaimer committee name never rendered
- Web component endpoint returning 404

These are all **code bugs with known fixes**, not architectural problems. The fixes are localized: one file each for the template registration gap (`ActionPageIsland.tsx`) and the web-component route (new Astro file), and a one-line normalization for the disclaimer.

The **notifications package** is production-ready with comprehensive test coverage.

**Recommended action before next phase:** Fix the 3 critical/high plugin issues (template registration, web component route, disclaimer field name), redeploy, and re-run this test suite to confirm resolution.

---

## Artifacts

- `/tmp/mcp-test-list_templates.json` — MCP list_templates response
- `/tmp/mcp-test-list_actions.json` — MCP list_actions response
- `/tmp/mcp-test-list_themes.json` — MCP list_themes response
- `/tmp/mcp-test-list_pages.json` — MCP list_pages response
- `/tmp/mcp-test-get_submissions.json` — MCP get_submissions response
- `/tmp/mcp-test-generate_theme-*.json` — 5 generate_theme responses
- `/tmp/mcp-test-create_page-*.json` — 5 create_page responses
- `/tmp/screenshot-home-desktop.png` — Home page at 1440×900
- `/tmp/screenshot-action-hero-simple.png` — Hero Simple action page
- `/tmp/screenshot-action-hero-media.png` — Hero Media action page
- `/tmp/screenshot-action-hero-layered.png` — Hero Layered (blank — bug)
- `/tmp/screenshot-*-*.png` — Responsive screenshots (16 total)
- `/var/folders/.../chrome-devtools-mcp-*/report.json` — Lighthouse JSON report
