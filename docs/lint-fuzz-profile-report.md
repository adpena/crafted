# Lint, Fuzz, and Profile Report

**Date:** 2026-04-07
**Projects:** crafted (main site + plugin), notifications (shared package)

---

## Task 1: TypeScript Strict Mode (`npx tsc --noEmit`)

### crafted/ (main site) — 13 errors in 7 files

**HIGH — crashes/type safety breakdowns:**

| File | Line | Code | Issue |
|------|------|------|-------|
| `src/pages/rss.xml.ts` | 34, 35, 43, 46, 47 | TS2769, TS2345 | `new Date({})` and `String({})` — schema types are `{}` instead of typed fields; 7 errors total |
| `src/pages/sitemap.xml.ts` | 44 | TS2769 | Same issue — `new Date({})` from untyped CMS query result |
| `src/pages/api/mcp/actions.ts` | 12 | TS2307 | Cannot find module `'cloudflare:workers'` — missing type declaration |

**MEDIUM — interface/integration mismatches:**

| File | Line | Code | Issue |
|------|------|------|-------|
| `plugin/src/index.ts` | 17 | TS2353 | `'admin'` not in `PluginDescriptor` type — plugin descriptor is extending beyond its declared shape |
| `plugin/src/lib/integrations.ts` | 1 | TS2305 | `'SubmissionData'` not exported from `@crafted/notifications` — import target wrong (it lives in `ActionPageRenderer.tsx`) |
| `plugin/src/routes/test-notification.ts` | 70 | TS2353 | `'HUBSPOT_PORTAL_ID'` not in `NotifyEnv` — env interface missing HubSpot portal ID field |

**LOW — test file type cast:**

| File | Line | Code | Issue |
|------|------|------|-------|
| `plugin/tests/themes.test.ts` | 68 | TS2352 | `Theme as Record<string, string>` — cast may be a mistake; `Theme` lacks string index signature |

### crafted/plugin/ — 5 errors in 5 files

Same four errors as above (plugin errors appear in both contexts), plus:

| File | Line | Code | Issue |
|------|------|------|-------|
| `node_modules/@crafted/notifications/src/sheets.ts` | 97 | TS2322 | `string | undefined` assigned to `string` — upstream type guard missing in sheets adapter |

### notifications/ — 0 errors

Clean. TypeScript compilation passes.

---

## Task 2: Test Results

### crafted/plugin/ — vitest run

```
Test Files:  8 passed (8)
Tests:       85 passed (85)   [expected: 85]
Duration:    745ms
```

All 85 tests pass. Suites: geo-ask, ab-assign, registry, validate, themes, disclaimers, web-component, hero-templates.

### crafted/ (notify.test.ts) — vitest run

```
Tests:  42 passed, 3 failed   [expected: 15 — actual file has 15 describe blocks]
```

**FAIL: `notifyAll skips all adapters when none are configured`** — runs 3 times (once from main, once from each of 2 active worktrees: `agent-a62dc295`, `agent-acd7935d`).

Root cause: vitest is picking up the test file from `.claude/worktrees/agent-*/` directories in addition to `src/lib/`. The test itself expects `result.skipped.length` to be **6** but gets **10** — meaning `notifyAll` now dispatches to 10 adapters while the test was written when it had 6. The assertion count is stale.

The 3 failures are all the same logical test; only the stale count `6` vs actual `10` matters. The worktree discovery is a vitest root config issue.

### notifications/ — vitest run

```
Test Files:  5 passed (5)
Tests:       53 passed (53)   [expected: 35]
```

53 tests pass (exceeds the expected 35 — the suite has grown). All 5 files clean: util, everyaction, action-network, hubspot, dispatch. The 4 `stderr` lines from dispatch tests are expected console output from designed failure paths (`[notify] Broken failed: send failed`, etc.).

**Total: 85 + 42 + 53 = 180 tests run; 3 failures (all same root cause in notify.test.ts).**

---

## Task 3: react-doctor Static Analysis

| Project | Score | Warnings | Files scanned |
|---------|-------|----------|---------------|
| crafted/ (main site) | **98 / 100** | 53 warnings across 37/80 files | 80 |
| crafted/plugin/ | N/A | No React dep in package.json | — |
| notifications/ | N/A | No React dep in package.json | — |

react-doctor only runs on the main site (plugin and notifications are framework-agnostic — React is a peer dependency, not declared in their own package.json).

**Issues found (crafted/):**

- **Unused files (20):** The following files are not imported by any other file in the project. These are mostly plugin entry points and admin components that are loaded dynamically or bundled separately. The react-doctor scanner cannot trace the plugin's runtime registry pattern.
  - `src/live.config.ts`
  - `plugin/src/admin/PageBuilder.tsx` and all admin components (7 files)
  - `plugin/src/lib/embed-resize.ts`, `plugin/src/lib/integrations.ts`
  - `plugin/src/web-component/action-page.ts`, `loader.ts`
  - `plugin/src/components/actions/index.ts`

- **Unused export: `HeroSimple`** — exported from `plugin/src/components/templates/index.ts` but never imported.

- **Unused types (17 files):** `ResolvedEntry` type exported in multiple files but never consumed externally. Likely intended for consumers of the published package.

- Lint checks failed (non-fatal): ESLint not configured at project root, so react-doctor's lint pass was skipped. Score may be conservative.

Score of **98/100 (Great)** with no functional bugs detected.

---

## Task 4: Bundle Size Analysis

### Main site (`npm run build`)

Build: **success** in 13.33s. Output: `dist/`.

**Vite warning: chunks larger than 500KB after minification.**

Largest chunks:

| File | Size | Notes |
|------|------|-------|
| `dist/client/_astro/PluginRegistry.CnfHfYq_.js` | **2.1 MB** | Client-side plugin registry — largest chunk, over limit |
| `dist/server/chunks/adapt-sandbox-entry_WdC0X5q0.mjs` | **1.4 MB** | Server sandbox entry |
| `dist/server/chunks/worker-entry_CyYxlcVs.mjs` | **1.1 MB** | Worker entry |
| `dist/server/virtual_astro_middleware.mjs` | **869 KB** | Middleware bundle |
| `dist/server/chunks/Base_BJ8T7_AL.mjs` | **560 KB** | Base chunk — over 500KB limit |
| `dist/client/_astro/index.BxrRSK16.js` | **444 KB** | Shared client chunk |
| `dist/client/_astro/client.BrVvuY-8.js` | **178 KB** | React runtime + hydration |
| `dist/client/_astro/ActionPageIsland.BBDhQn4i.js` | **22 KB** | Action page island (good) |
| `dist/client/_astro/WorkListing.BWFr_j87.js` | (small) | Work listing component |

**Client chunks over 500KB: 1 (PluginRegistry.js at 2.1MB)**
**Server chunks over 500KB: 3 (adapt-sandbox-entry, worker-entry, virtual_astro_middleware)**

The `PluginRegistry` 2.1MB client chunk is the primary concern. It bundles all plugin components for client-side rendering. Consider dynamic imports per plugin or lazy-loading the registry.

### Plugin (`@crafted/action-pages`)

The plugin has no build step — it ships TypeScript source files directly (`"main": "src/index.ts"`). Bundle analysis at this level is deferred to the consumer (crafted/).

React and Preact are peer dependencies (not in `package.json`), so action components are fully tree-shakeable per consumer. Templates and actions are individually importable via the registry pattern. No dead code included at the library level.

---

## Task 5: Fuzz Testing

### `validateSubmission` (plugin/src/modules/validate.ts)

**1000 random inputs. Result: 104 failures (throws instead of returning `{ valid: false }`).**

Two distinct crash patterns:

**1. `data: null` — TypeError: Cannot convert undefined or null to object**
Triggered by: `{ type: "donation_click", data: null }`
Root cause: `Object.entries(input.data)` at line 61 called on `null`.
All four submission types affected.

**2. `data: undefined` — TypeError: Cannot read properties of undefined**
Triggered by: `{ type: "signup" }` (data field omitted entirely)
Root cause: `input.data[field]` and `Object.entries(input.data)` both crash when `data` is `undefined`.
All types with required fields affected.

**Fix:** Add a guard at the top of `validateSubmission`:
```typescript
if (!input?.data || typeof input.data !== "object" || Array.isArray(input.data)) {
  return { valid: false, errors: ["Missing or invalid data payload"] };
}
```

### `sanitizeText`, `escapeHtml`, `isValidEmail`, `validateUrl` (notifications/src/util.ts)

**6000 checks (1000 inputs × 6 checks each). Result: 0 failures.**

- `sanitizeText`: handles non-string gracefully (returns `""` via `typeof text !== "string"` guard)
- `escapeHtml`: same guard, never throws
- `isValidEmail`: pure regex + length check, never throws
- `validateUrl`: throws `Error` objects by design for invalid URLs — all throws are proper `Error` instances (no `throw "string"` or panics)

**notifications/util.ts is fuzz-clean.**

---

## Task 6: Performance Profiling — https://adpena.com/

### Lighthouse (desktop, navigation mode)

| Category | Score | Baseline |
|----------|-------|---------|
| Accessibility | **100** | 100 |
| Best Practices | **96** | 96 |
| SEO | **100** | 100 |
| Performance | N/A (requires trace) | — |

**Passed audits: 48. Failed: 1.**

**Failed audit: `errors-in-console` (score: 0)**
> React error #418 thrown during hydration.
> Source: `https://adpena.com/_astro/client.BrVvuY-8.js:8:31372`
> React error 418 = hydration text mismatch — SSR-rendered text node differs from client-rendered text.

### Performance Trace (Chrome DevTools, no throttling)

| Metric | Value |
|--------|-------|
| LCP | **888 ms** |
| TTFB | 445 ms |
| Render delay | 442 ms |
| CLS | **0.00** |
| FCP | not measured separately |

**LCP breakdown:** TTFB (445ms) + Render delay (442ms). The render delay is entirely due to render-blocking CSS.

**Render-blocking resource identified:**
- `https://adpena.com/_astro/Base.BWw3wC15.css`
- Queued: 452ms, downloaded in 0.3ms (cached/fast), but blocked render for **437ms**
- Cache-control: `public, max-age=0, must-revalidate` — no long-term caching
- Protocol: h3

**Estimated savings if fixed: FCP -437ms, LCP -437ms** (LCP would drop from 888ms to ~451ms).

Other insights:
- Network dependency tree has chained critical requests
- Third-party impact: minimal (1 third-party request window, 1.2ms)
- Cache headers suboptimal: `max-age=0, must-revalidate` on CSS means every visit revalidates

**Scores match previous baseline (100/100/96).** The new finding is the React #418 hydration error (console failure).

---

## Task 7: Sharp Edges Check — plugin/src/components/

### FundraiseAction.tsx

- **Input validation:** `actblue_url` passed to `new URL()` — wrapped in try/catch, returns `"#"` on failure. Safe.
- **`amounts` array:** Defensive fallback `Array.isArray(amounts) && amounts.length > 0` handles missing/empty arrays.
- **`parseFloat(custom)`:** Returns `NaN` on bad input; `|| 0` coerces to 0, button is disabled when `activeAmount <= 0`. Safe.
- **Async:** `handleDonate` is synchronous (redirect only); no async operations.
- **No unbounded loops, no recursion.**
- **Sharp edge:** `actblue_url` is not validated against a URL scheme whitelist. A `javascript:` URL would pass `new URL()` and would be assigned to `window.location.href`. The try/catch only catches `invalid URL` parse errors, not protocol filtering. Should validate `url.protocol === "https:"`.

### PetitionAction.tsx

- **Async `handleSubmit`:** try/catch/finally with `setLoading(false)` in finally. Safe.
- **`fetch(submitUrl)`:** `submitUrl` defaults to `/api/action/submit`. No URL validation on the prop.
- **Email validation:** CLIENT-SIDE ONLY (`EMAIL_RE`). No CRLF injection check (unlike the notifications util). Not exploitable here since it's a UI validator, but inconsistent with the server-side validator pattern.
- **Unbounded comment textarea:** no `maxLength` attribute on the `<textarea>`. User can type arbitrarily long strings. The server-side `validateSubmission` enforces `MAX_LENGTHS["comment"] ?? 1000`, so this is caught server-side, but there is no client-side max.
- **No unbounded loops, no recursion.**

### GOTVAction.tsx

- **Async `handleSubmit`:** try/catch/finally. Safe.
- **`zip` field:** `inputMode="numeric"` but `type="text"` — accepts non-numeric input client-side. Only validated as non-empty. No max-length attribute (server enforces 10 chars).
- **No unbounded loops, no recursion.**

### SignupAction.tsx

- **Async `handleSubmit`:** try/catch/finally. Safe.
- **Email regex:** Same `EMAIL_RE` as PetitionAction, no CRLF check.
- **`firstName`:** No max-length attribute or validation; accepted as-is.
- **No unbounded loops, no recursion.**

### ActionPageRenderer.tsx

- **`templates.get()` / `actions.get()`:** Returns `undefined` for unknown keys — handled with `console.error` + `return null`. Safe, no throw.
- **`fireWebhooks` in `handleComplete`:** async, no await, no error handling at the call site. If webhooks fail, the error is silently dropped (fire-and-forget is likely intentional but worth noting for observability).
- **`page.followup_props` spread:** `{...page.followup_props}` — if undefined, spread is a no-op in React JSX. Safe.

### HeroLayered.tsx / HeroSplit.tsx

- **`useIsMobile` hook:** `window.matchMedia` called in `useEffect` only — safe for SSR (effect doesn't run on server).
- **`parseInt(base, 10)` in `getSplashMaxWidth`:** `SPLASH_SIZE_MAP` values are all valid `"NNpx"` strings — radix 10 parse is safe, no NaN path reachable in practice.
- **No unbounded loops, no recursion.**
- **Sharp edge (HeroSplit):** `media_url` is rendered as `<img src={media_url}>` or `<video src={media_url}>` with no URL validation or sanitization. A `data:` URI or `javascript:` scheme would be emitted to the DOM. Low risk in practice (prop comes from CMS config, not user input), but defensible.

### Summary of Sharp Edges

| File | Edge | Severity |
|------|------|---------|
| `FundraiseAction.tsx` | `actblue_url` not filtered for `javascript:` scheme before `window.location.href` assignment | Medium |
| `PetitionAction.tsx` | Comment `<textarea>` has no `maxLength` attribute (only server-enforced) | Low |
| `PetitionAction.tsx` / `SignupAction.tsx` | Client-side email regex lacks CRLF injection check | Low |
| `ActionPageRenderer.tsx` | `fireWebhooks` errors are silently dropped (no await, no catch) | Low |
| `HeroSplit.tsx` | `media_url` emitted to `src` attribute without scheme validation | Low |
| `validate.ts` | `data: null` / `data: undefined` causes throws instead of `{ valid: false }` | **HIGH (confirmed by fuzz)** |

---

## Task 8: Bundle for OSS — @crafted/notifications

### package.json readiness

| Field | Status | Notes |
|-------|--------|-------|
| `name` | `@crafted/notifications` | Scoped — requires npm org or `--access public` on publish |
| `version` | `0.1.0` | Pre-1.0, acceptable |
| `description` | Present | Good |
| `license` | `MIT` | Present |
| `main` | `src/index.ts` | Ships TypeScript source — consumers need to handle TS or use a bundler |
| `types` | `src/index.ts` | Same as `main` |
| `exports` | Present | Named subpath exports for adapters, webhooks, sheets |
| `files` | `["src"]` | Only `src/` published |
| `keywords` | **Missing** | Should add for npm discoverability |
| `repository` | **Missing** | Should add GitHub URL |
| `homepage` | **Missing** | Optional but recommended |
| `publishConfig` | **Missing** | Should add `{ "access": "public" }` for scoped package |
| `peerDependencies` | **Missing** | No external deps (by design — zero dep library) |
| `engines` | **Missing** | Consider `{ "node": ">=18" }` for Fetch API requirement |
| `exports["./adapters/*"]` | `"./src/adapters/*.ts"` | Consumers get raw `.ts` — no compiled output |

### Files that would be published (`npm pack --dry-run`)

Only `src/` is included. Dev files excluded: `tests/`, `docs/`, `examples/`, `tsconfig.json`, `.gitignore`, `package-lock.json`.

### Required docs

| File | Status |
|------|--------|
| `LICENSE` | Present (MIT) |
| `README.md` | Present (14.9KB — detailed) |
| `CHANGELOG.md` | Present (2.5KB) |
| `CONTRIBUTING.md` | Present (5.2KB) |
| `SECURITY.md` | Present |

### Issues

1. **No compiled output.** `main` and `types` point to `.ts` source. Consumers that don't use TypeScript or a bundler cannot use the package. Recommend adding a build step (`tsc` to `dist/`) and pointing `main`/`types` at `dist/index.js` / `dist/index.d.ts`.
2. **`publishConfig.access` missing.** Scoped packages default to private on npm. Must add `"publishConfig": { "access": "public" }` or pass `--access public` to `npm publish`.
3. **`keywords` missing.** Add `["cloudflare", "workers", "notifications", "discord", "slack", "telegram", "email"]` for discoverability.
4. **`repository` missing.** Standard for OSS packages.
5. **`engines` missing.** The package uses the Fetch API which requires Node 18+. Should document this.
6. **`SubmissionData` not exported.** The TS error `Module '"@crafted/notifications"' has no exported member 'SubmissionData'` found in crafted/plugin indicates a consumer expects this type. It lives in `plugin/src/components/ActionPageRenderer.tsx` instead. Either export it from notifications or update the plugin import.

---

## Production Readiness Assessment

### crafted/ (main site)

| Area | Status |
|------|--------|
| TypeScript | 13 errors — `rss.xml.ts` and `sitemap.xml.ts` have untyped CMS date fields; `cloudflare:workers` types missing |
| Tests | 85/85 plugin tests passing; notify.test.ts has 1 stale assertion (`skipped.length === 6` should be `10`) |
| Bundle | 1 client chunk at 2.1MB (PluginRegistry) needs code-splitting |
| Perf | LCP 888ms; 437ms of that is render-blocking CSS with `max-age=0` |
| Console errors | React hydration mismatch error #418 on every page load |
| Accessibility | 100/100 |
| SEO | 100/100 |
| Best Practices | 96/100 |

### crafted/plugin/

| Area | Status |
|------|--------|
| TypeScript | 5 errors — `SubmissionData` wrong import path; `HUBSPOT_PORTAL_ID` missing from `NotifyEnv`; `admin` field not in `PluginDescriptor` |
| Tests | 85/85 passing |
| Sharp edges | `actblue_url` allows `javascript:` scheme; `validateSubmission` throws on `data: null/undefined` |
| react-doctor | 20 "unused files" (false positives from registry pattern) |

### notifications/

| Area | Status |
|------|--------|
| TypeScript | Clean |
| Tests | 53/53 passing |
| Fuzz | Clean (6000 checks, 0 failures) |
| OSS readiness | Missing `publishConfig.access`, `keywords`, `repository`, compiled output |
| `sheets.ts` | TS2322 in upstream — `string | undefined` assignment; not caught by own tsconfig |

### Priority Fixes (ordered)

1. **CRITICAL:** `validateSubmission` throws on `data: null` or `data: undefined` — add null guard (API surface exposed to untrusted input via `POST /api/action/submit`)
2. **HIGH:** React hydration error #418 — SSR/client text mismatch causes console error on every page load
3. **HIGH:** `notify.test.ts` stale assertion — `skipped.length` expected `6`, actual `10` (test was written before 4 adapters were added)
4. **MEDIUM:** `actblue_url` scheme validation — filter `javascript:` before `window.location.href` assignment
5. **MEDIUM:** `PluginRegistry.js` 2.1MB client chunk — needs `manualChunks` or dynamic imports
6. **MEDIUM:** CSS cache headers — `max-age=0, must-revalidate` adds 437ms render-blocking latency on each visit; set long `max-age` with content-hash fingerprinting (already using hashed filenames)
7. **LOW:** `notifications/` package.json — add `publishConfig.access: "public"`, `keywords`, `repository`, compiled output before npm publish
8. **LOW:** `SubmissionData` import path — move or re-export from `@crafted/notifications` to fix TS2305
9. **LOW:** `HUBSPOT_PORTAL_ID` missing from `NotifyEnv` interface
10. **LOW:** `admin` field missing from `PluginDescriptor` type
