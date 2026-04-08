/**
 * Mailchimp webhook receiver.
 *
 *   GET  /api/webhooks/mailchimp?key=<MAILCHIMP_WEBHOOK_SECRET>
 *   POST /api/webhooks/mailchimp?key=<MAILCHIMP_WEBHOOK_SECRET>
 *
 * Mailchimp verifies the endpoint with a bare GET before enabling the
 * webhook, then POSTs events as `application/x-www-form-urlencoded` with
 * bracket-nested keys:
 *
 *   type=unsubscribe
 *   fired_at=2026-04-08 15:22:00
 *   data[action]=unsub
 *   data[reason]=manual
 *   data[email]=foo@bar.com
 *   data[list_id]=abc123
 *
 * What this endpoint does on relevant events:
 *
 *   unsubscribe | cleaned | spam  →  mark contact opted_out in D1,
 *                                     write suppression entry to KV,
 *                                     record attribution event
 *   upemail                       →  record old→new email change (no action)
 *   subscribe | profile | campaign →  ignore (would never re-subscribe from a
 *                                     webhook — must be explicit admin action)
 *
 * Auth:
 *   - Secret URL query param `?key=...` compared in constant time against
 *     MAILCHIMP_WEBHOOK_SECRET (matches Mailchimp's own recommended pattern —
 *     they do not sign webhook payloads).
 *   - Rejects requests when the env secret is unset (fail-closed).
 *   - Rate limited per IP via KV.
 *
 * Email handling:
 *   - Emails are lowercased and trimmed before hashing.
 *   - KV suppression key is `suppressed:<sha256(email)>` with 395-day TTL
 *     (matches the longest CAN-SPAM/CASL unsubscribe obligation window).
 *   - The D1 contact record is persistent beyond the KV TTL.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sha256Hex, timingSafeCompare } from "../../../lib/auth.ts";
import type { ContactsD1 } from "../../../lib/contacts.ts";
import { processMailchimpEvent, type MailchimpKV } from "../../../lib/webhooks/mailchimp.ts";

const MAX_BODY = 64 * 1024; // 64 KB — Mailchimp payloads are small
const RATE_MAX = 100;
const RATE_WINDOW_SEC = 60;

export const GET: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const secret = e.MAILCHIMP_WEBHOOK_SECRET as string | undefined;
  if (!secret) return json(503, { error: "Webhook not configured" });
  const provided = new URL(request.url).searchParams.get("key") ?? "";
  if (!timingSafeCompare(provided, secret, secret)) {
    return json(401, { error: "Unauthorized" });
  }
  // Mailchimp's verification ping — just needs 200 OK.
  return json(200, { ok: true });
};

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;

  // --- Auth: shared-secret query param ---
  const secret = e.MAILCHIMP_WEBHOOK_SECRET as string | undefined;
  if (!secret) return json(503, { error: "Webhook not configured" });
  const provided = new URL(request.url).searchParams.get("key") ?? "";
  if (!timingSafeCompare(provided, secret, secret)) {
    return json(401, { error: "Unauthorized" });
  }

  // --- Content-Type: Mailchimp sends form-urlencoded ---
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return json(415, { error: "Content-Type must be application/x-www-form-urlencoded" });
  }

  // --- Body size guard ---
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY) {
    return json(413, { error: "Payload exceeds 64 KB limit" });
  }

  // --- Rate limit per IP ---
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";
  const ipHash = (await sha256Hex(ip)).slice(0, 32);

  const kv = e.CACHE as MailchimpKV | undefined;
  if (kv) {
    const window = Math.floor(Date.now() / 1000 / RATE_WINDOW_SEC);
    const rlKey = `rl:webhook:mailchimp:${ipHash}:${window}`;
    try {
      const raw = await kv.get(rlKey);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= RATE_MAX) return json(429, { error: "Rate limit exceeded" });
      await kv.put(rlKey, String(count + 1), { expirationTtl: RATE_WINDOW_SEC });
    } catch {
      // Fail open on rate limit infra errors.
    }
  }

  // --- Read body ---
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: "Could not read body" });
  }
  if (raw.length > MAX_BODY) {
    return json(413, { error: "Payload exceeds 64 KB limit" });
  }

  const db = e.DB as ContactsD1 | undefined;
  const result = await processMailchimpEvent(raw, { db, kv });
  return json(result.status, result.body);
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
