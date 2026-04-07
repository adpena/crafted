# Embedding a Crafted Action Page

The `@crafted/action-pages` plugin renders petitions, fundraisers, GOTV pledges, and signup forms. There are eight ways to embed an action page on another site, ranging from a single `<script>` tag to a fully-typed React component. Pick the one that matches the host stack — they all hit the same plugin endpoints, fire the same webhooks, and respect the same theme tokens.

All examples assume the plugin is mounted at `https://adpena.com`. Replace the domain with your own deployment.

---

## 1. Iframe (zero JS)

Drop one script tag, get a Shadow-DOM-isolated iframe rendered inline.

```html
<script
  src="https://adpena.com/api/_plugin/crafted-action-pages/embed?slug=my-petition"
  async
></script>
```

**You need:** nothing — works in any HTML page.
**Pros:** zero JS dependencies, hardest isolation, framework-agnostic.
**Cons:** the host page can't read submission events; no resize handshake.
**Use when:** you just need the form to appear and you don't care about post-submit hooks on the host.

---

## 2. Web Component (any framework)

Load the loader script once, then use `<crafted-action-page>` anywhere — React, Vue, Solid, Svelte, Astro, plain HTML. The custom element handles iframe insertion, postMessage, and host event re-emission.

```html
<script
  src="https://adpena.com/api/_plugin/crafted-action-pages/web-component.js"
  async
></script>

<crafted-action-page
  slug="my-petition"
  campaign="texas-aft"
  theme="warm"
  domain="https://adpena.com"
></crafted-action-page>

<script>
  document.querySelector("crafted-action-page")
    .addEventListener("craftedSubmit", (event) => {
      console.log("submitted:", event.detail);
    });
</script>
```

**Attributes:** `slug` (required), `campaign`, `theme`, `domain`.
**Events on the host element:**
- `craftedSubmit` — `event.detail` is the submission payload
- `craftedResize` — `event.detail = { height }` after the iframe reports a height change

**You need:** one `<script>` tag.
**Pros:** works in every framework that speaks DOM; events bubble like native events.
**Cons:** still iframe-backed (not in-document React).
**Use when:** you want one embed strategy that works everywhere.

---

## 3. React (with the existing react-island pattern)

If the host site already uses React (e.g. via `react-island` like the main `crafted` site), wrap the custom element in a thin component:

```tsx
import { useEffect, useRef } from "react";

export function CraftedActionPage(props: {
  slug: string;
  campaign?: string;
  theme?: string;
  domain?: string;
  onSubmit?: (data: unknown) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !props.onSubmit) return;
    const handler = (e: Event) => props.onSubmit?.((e as CustomEvent).detail);
    el.addEventListener("craftedSubmit", handler);
    return () => el.removeEventListener("craftedSubmit", handler);
  }, [props.onSubmit]);

  return (
    // @ts-expect-error — custom element
    <crafted-action-page
      ref={ref}
      slug={props.slug}
      campaign={props.campaign}
      theme={props.theme}
      domain={props.domain}
    />
  );
}
```

Make sure the loader script is included once on the page (in your layout's `<head>` or via `<script src=... async>` near the root).

**You need:** the loader script + the wrapper above.
**Pros:** typed component, fits the WorkListing / react-island pattern already used in the main site.
**Cons:** still wraps an iframe; no SSR markup.
**Use when:** you already have React on the page and you want a typed prop API.

---

## 4. Vue 3

Vue 3 supports custom elements natively. After loading the script, just use the tag.

```vue
<template>
  <crafted-action-page
    slug="my-petition"
    theme="warm"
    domain="https://adpena.com"
    @crafted-submit="onSubmit"
  />
</template>

<script setup lang="ts">
function onSubmit(event: CustomEvent) {
  console.log("submitted:", event.detail);
}
</script>
```

If Vue warns about the unknown element, register it with `app.config.compilerOptions.isCustomElement = (tag) => tag === "crafted-action-page"`.

**You need:** loader script + Vue's `isCustomElement` hint.
**Pros:** native event syntax (`@crafted-submit`).
**Use when:** Vue is the host framework.

---

## 5. Svelte

Svelte forwards everything it doesn't recognise as a DOM element to the actual DOM, so the custom element works as-is.

```svelte
<script>
  function handleSubmit(e) {
    console.log("submitted:", e.detail);
  }
</script>

<svelte:head>
  <script src="https://adpena.com/api/_plugin/crafted-action-pages/web-component.js" async></script>
</svelte:head>

<crafted-action-page
  slug="my-petition"
  theme="warm"
  domain="https://adpena.com"
  on:craftedSubmit={handleSubmit}
/>
```

**You need:** loader script.
**Pros:** Svelte's `on:craftedSubmit` syntax just works.
**Use when:** Svelte is the host framework.

---

## 6. Solid

```tsx
import { onMount } from "solid-js";

export function CraftedActionPage() {
  let el: HTMLElement | undefined;
  onMount(() => {
    el?.addEventListener("craftedSubmit", (e) => {
      console.log("submitted:", (e as CustomEvent).detail);
    });
  });
  return (
    // @ts-expect-error — custom element
    <crafted-action-page
      ref={el}
      slug="my-petition"
      theme="warm"
      domain="https://adpena.com"
    />
  );
}
```

**You need:** loader script.
**Pros:** ref + native event listener, no extra wrappers.
**Use when:** Solid is the host framework.

---

## 7. HTMX (HTML form fallback)

For zero-build setups, the plugin can generate a plain HTML `<form>` with `hx-*` attributes. Server-render it with `generateHtmlForm`:

```ts
import { generateHtmlForm } from "@crafted/action-pages/src/web-component/html-form";

const formHtml = generateHtmlForm({
  slug: "my-petition",
  action: "petition",
  domain: "https://adpena.com",
  theme: "warm",
  htmx: true, // emit hx-post / hx-target / hx-swap
});

// Drop `formHtml` into your template.
```

The rendered form posts to `/api/_plugin/crafted-action-pages/submit` with HTMX, and HTMX swaps the form with the response. With JS disabled, the form falls back to a native POST.

**You need:** a way to call `generateHtmlForm` server-side (Node, Deno, Bun, Cloudflare Worker, etc.) plus HTMX on the page.
**Pros:** progressive enhancement, no client-side framework.
**Use when:** the host runs HTMX or wants both JS and no-JS support.

---

## 8. Pure HTML (no JavaScript at all)

Same generator, but omit `htmx: true`. The form will submit natively.

```ts
const formHtml = generateHtmlForm({
  slug: "my-petition",
  action: "petition",
  domain: "https://adpena.com",
  theme: "warm",
});
```

```html
<!-- the rendered form -->
<form id="crafted-form-my-petition"
      method="post"
      action="https://adpena.com/api/_plugin/crafted-action-pages/submit">
  <input type="hidden" name="page_id" value="my-petition">
  <input type="hidden" name="type" value="petition_sign">
  <!-- fields ... -->
  <button type="submit">Sign the petition</button>
</form>
```

**You need:** a server (any language) that can render the generator output, or copy-paste the markup.
**Pros:** works with JavaScript disabled; ideal for newsletters, email landing pages, accessibility-first builds.
**Cons:** no inline confirmation UX — the browser navigates to the response.
**Use when:** you need the lowest possible footprint.

---

## Quick comparison

| Approach          | JS required | Framework agnostic | Submission events on host | Inline confirmation |
| ----------------- | ----------- | ------------------ | ------------------------- | ------------------- |
| Iframe script     | no (script) | yes                | no                        | yes (in iframe)     |
| Web Component     | yes         | yes                | yes (`craftedSubmit`)     | yes                 |
| React wrapper     | yes         | React only         | yes (`onSubmit` prop)     | yes                 |
| Vue               | yes         | Vue only           | yes (`@crafted-submit`)   | yes                 |
| Svelte            | yes         | Svelte only        | yes (`on:craftedSubmit`)  | yes                 |
| Solid             | yes         | Solid only         | yes (DOM listener)        | yes                 |
| HTMX form         | yes (HTMX)  | yes                | via HTMX events           | yes (HTMX swap)     |
| Pure HTML form    | no          | yes                | no                        | no (full nav)       |

When in doubt, use the **Web Component** — it gives you the broadest compatibility for the smallest amount of glue code.
