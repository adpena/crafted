import { defineMiddleware } from "astro:middleware";

// Note: 'unsafe-inline' in script-src is required because Astro inlines scripts
// at build time. The long-term goal is nonce-based CSP, but that requires Astro
// nonce support or a post-build injection step. This is a known Astro limitation.
// wasm-unsafe-eval allows WebAssembly.compile without full unsafe-eval
const BASE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": BASE_CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "0",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

// Scanner paths that should never reach the application.
// Primary defense is the Cloudflare WAF rule (blocks at the edge).
// This is defense-in-depth for cases where the WAF rule is misconfigured.
const SCANNER_PATTERNS = [
  "/.env",
  "/.git",
  "/.aws",
  "/.ssh",
  "/.DS_Store",
  "/wp-login",
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/administrator",
  "/config.php",
  "/config.yml",
  "/database.yml",
  "/.htaccess",
  "/.htpasswd",
  "/cgi-bin",
  "/server-status",
  "/debug",
  "/console",
  "/actuator",
  "/telescope",
];

function isScannerPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return SCANNER_PATTERNS.some((p) => lower.startsWith(p));
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Block scanners early — return 403 without invoking the route handler.
  if (isScannerPath(context.url.pathname)) {
    return new Response(null, { status: 403 });
  }

  const response = await next();

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Content-hash fingerprinted assets can be cached forever
  if (context.url.pathname.startsWith("/_astro/")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  // Action pages and demos are public embeddable widgets.
  if (context.url.pathname.startsWith("/action/") || context.url.pathname.startsWith("/demo/")) {
    response.headers.delete("X-Frame-Options");
    response.headers.set(
      "Content-Security-Policy",
      BASE_CSP + "; frame-ancestors *",
    );
  }

  return response;
});
