/**
 * ActBlue webhook receiver.
 *
 * POST /api/webhooks/actblue
 * Authorization: Basic <base64(username:password)>
 * Content-Type: application/json
 *
 * Receives donation events from ActBlue. The `refcode` in lineitems maps
 * to our action page slug, closing the attribution loop: petition -> donation.
 *
 * Auth: Basic auth verified against ACTBLUE_WEBHOOK_SECRET env var.
 * Rate limited: 100/min per IP via KV.
 * Email: SHA-256 hashed before storage (no PII in event records).
 */

import type { APIRoute } from "astro";
import { sha256Hex } from "../../../lib/auth.ts";
import { storeAttributionEvent, type AttributionEvent } from "../../../lib/attribution.ts";
import { env } from "cloudflare:workers";

const MAX_BODY = 100 * 1024; // 100 KB
const RATE_MAX = 100;
const RATE_WINDOW_SEC = 60;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

export const POST: APIRoute = async ({ request }) => {
  // --- Auth: Basic auth ---
  const secret = (env as Record<string, unknown>).ACTBLUE_WEBHOOK_SECRET as string | undefined;
  if (!secret) {
    // If no secret configured, reject all requests (fail-closed)
    return json(503, { error: "Webhook not configured" });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!verifyBasicAuth(authHeader, secret)) {
    return json(401, { error: "Unauthorized" });
  }

  // --- Content-Type ---
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  // --- Body size guard ---
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY) {
    return json(413, { error: "Payload exceeds 100 KB limit" });
  }

  // --- Rate limit per IP ---
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";
  const ipHash = (await sha256Hex(ip)).slice(0, 32);

  const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
  if (kv) {
    const window = Math.floor(Date.now() / 1000 / RATE_WINDOW_SEC);
    const rlKey = `rl:webhook:actblue:${ipHash}:${window}`;
    try {
      const raw = await kv.get(rlKey);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= RATE_MAX) {
        return json(429, { error: "Rate limit exceeded" });
      }
      await kv.put(rlKey, String(count + 1), { expirationTtl: RATE_WINDOW_SEC });
    } catch {
      // Fail open on KV errors
    }
  }

  // --- Read and parse body ---
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: "Could not read body" });
  }
  if (raw.length > MAX_BODY) {
    return json(413, { error: "Payload exceeds 100 KB limit" });
  }

  let payload: ActBluePayload;
  try {
    payload = JSON.parse(raw) as ActBluePayload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // --- Validate required fields ---
  const contribution = payload.contribution;
  const donor = payload.donor;
  if (!contribution || !donor?.email) {
    return json(422, { error: "Missing contribution or donor.email" });
  }

  // --- Build attribution event ---
  const emailLower = donor.email.toLowerCase().trim();
  const emailHash = await sha256Hex(emailLower);

  // Extract refcode (action page slug) from first lineitem
  const refcode = payload.lineitems?.[0]?.refcode ?? undefined;

  const isRefund = contribution.refundedAt != null;
  const amount = parseFloat(contribution.amount ?? "0") || 0;

  const event: AttributionEvent = {
    id: crypto.randomUUID(),
    source: "actblue",
    event_type: isRefund ? "refund" : "donation",
    email_hash: emailHash,
    slug: refcode,
    amount,
    recurring: contribution.recurring ?? false,
    metadata: {
      order_number: contribution.orderNumber,
      status: contribution.status,
      zip: donor.zip,
    },
    timestamp: contribution.createdAt ?? new Date().toISOString(),
  };

  // --- Store ---
  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  try {
    await storeAttributionEvent(db, event);
  } catch (err) {
    console.error("[actblue-webhook] insert failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Storage failed" });
  }

  return json(200, { ok: true });
};

// --- Helpers ---

interface ActBluePayload {
  contribution?: {
    createdAt?: string;
    amount?: string;
    recurring?: boolean;
    refundedAt?: string | null;
    status?: string;
    orderNumber?: string;
  };
  donor?: {
    email?: string;
    firstname?: string;
    lastname?: string;
    zip?: string;
  };
  lineitems?: Array<{
    entityId?: number;
    refcode?: string;
    refcodeSecondary?: string;
  }>;
}

/**
 * Verify Basic auth header against expected secret.
 * The secret is the full "username:password" string (base64-encoded in the header).
 */
function verifyBasicAuth(header: string, secret: string): boolean {
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    return decoded === secret;
  } catch {
    return false;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
