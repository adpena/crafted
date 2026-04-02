import { defineMiddleware } from "astro:middleware";

// Note: 'unsafe-inline' in script-src is required because Astro inlines scripts
// at build time. The long-term goal is nonce-based CSP, but that requires Astro
// nonce support or a post-build injection step. This is a known Astro limitation.
// wasm-unsafe-eval allows WebAssembly.compile without full unsafe-eval
const BASE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": BASE_CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "0",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Design decision: action pages are public embeddable widgets.
  // frame-ancestors * allows any site to embed them via iframe.
  // This is intentional — action pages are read-only, contain no
  // auth state, and perform no state-changing actions. If interactive
  // or authenticated features are ever added to action pages, this
  // must be tightened to a domain allowlist.
  if (context.url.pathname.startsWith("/action/") || context.url.pathname.startsWith("/demo/")) {
    response.headers.delete("X-Frame-Options");
    response.headers.set(
      "Content-Security-Policy",
      BASE_CSP + "; frame-ancestors *",
    );
  }

  return response;
});
