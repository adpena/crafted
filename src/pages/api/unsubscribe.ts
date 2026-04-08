/**
 * Public unsubscribe endpoint.
 *
 * GET /api/unsubscribe?email=foo@bar.com&t=<hmac-token>
 *
 * Verifies the HMAC token (timing-safe), then writes a suppression marker
 * to KV under `suppressed:{sha256(email)}` with a 1-year TTL.
 *
 * Rate limited to 20 req/min per IP via the shared rate-limit helper.
 *
 * Requires UNSUBSCRIBE_SECRET to be configured — otherwise returns 503.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { KVNamespace } from "../../lib/cf-types.ts";
import { verifyUnsubscribeToken } from "../../lib/email-blast.ts";
import { checkRateLimit } from "../../lib/rate-limit.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONE_YEAR_SEC = 86400 * 365;

export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  const e = env as Record<string, unknown>;
  const secret = e.UNSUBSCRIBE_SECRET as string | undefined;
  const kv = e.KV as KVNamespace | undefined;

  if (!secret || !kv) {
    return htmlResponse(503, page("Unsubscribe unavailable", "This service is not configured. Please contact support."));
  }

  // --- Rate limit ---
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    clientAddress ??
    "unknown";
  try {
    const rl = await checkRateLimit(kv, ip, { max: 20, windowSec: 60 });
    if (!rl.allowed) {
      return new Response(
        page("Too many requests", "Please wait a moment and try again."),
        {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": String(rl.retryAfter ?? 60),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  } catch {
    // If rate-limit infra fails, allow the request through.
  }

  const emailRaw = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = (url.searchParams.get("t") ?? "").trim();

  if (!emailRaw || emailRaw.length > 254 || !EMAIL_RE.test(emailRaw)) {
    return htmlResponse(400, page("Invalid request", "The unsubscribe link is malformed."));
  }
  if (!token || token.length > 200) {
    return htmlResponse(400, page("Invalid request", "The unsubscribe link is malformed."));
  }

  let valid = false;
  try {
    valid = await verifyUnsubscribeToken(secret, emailRaw, token);
  } catch {
    valid = false;
  }
  if (!valid) {
    return htmlResponse(403, page("Invalid link", "This unsubscribe link is invalid or has expired."));
  }

  // Write suppression marker.
  try {
    const hashed = await sha256Hex(emailRaw);
    await kv.put(`suppressed:${hashed}`, "1", { expirationTtl: ONE_YEAR_SEC });
  } catch (err) {
    console.error(
      "[unsubscribe] KV write failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return htmlResponse(500, page("Something went wrong", "We could not record your request. Please try again later."));
  }

  return htmlResponse(
    200,
    page(
      "Unsubscribed",
      "You have been removed from our mailing list. You will no longer receive bulk emails. If you change your mind, you can opt back in by signing up again.",
    ),
  );
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return hex;
}

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title: string, message: string): string {
  // Defensive HTML escaping — current callers pass constants, but future
  // callers might pass user-derived strings. Always escape.
  const safeTitle = htmlEscape(title);
  const safeMessage = htmlEscape(message);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a;
         line-height: 1.5; }
  h1 { font-size: 24px; margin-bottom: 12px; }
  p  { font-size: 16px; color: #444; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    p { color: #bbb; }
  }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeMessage}</p>
</body>
</html>`;
}
