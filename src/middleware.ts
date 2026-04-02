import { defineMiddleware } from "astro:middleware";

// Note: 'unsafe-inline' in script-src is required because Astro inlines scripts
// at build time. The long-term goal is nonce-based CSP, but that requires Astro
// nonce support or a post-build injection step. This is a known Astro limitation.
const BASE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'";

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

  // Action pages are embedded in iframes on third-party sites.
  // Remove X-Frame-Options (which doesn't support wildcard) and use
  // CSP frame-ancestors instead, which is the modern standard.
  if (context.url.pathname.startsWith("/action/")) {
    response.headers.delete("X-Frame-Options");
    response.headers.set(
      "Content-Security-Policy",
      BASE_CSP + "; frame-ancestors *",
    );
  }

  return response;
});
