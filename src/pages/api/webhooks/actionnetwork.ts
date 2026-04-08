/**
 * Action Network webhook receiver.
 *
 * POST /api/webhooks/actionnetwork
 * X-Action-Network-Signature: sha256=<hex>
 * Content-Type: application/json
 *
 * Receives events: action taken, attendance recorded, submission created,
 * outreach sent, donation made. Each contains the person's email and the
 * action type.
 *
 * Auth: HMAC-SHA256 signature verification (timing-safe). If no secret
 * configured, accepts unsigned requests (some AN plans lack webhook signing).
 * Rate limited: 100/min per IP via KV.
 * Email: SHA-256 hashed before storage.
 */

import type { APIRoute } from "astro";
import { sha256Hex } from "../../../lib/auth.ts";
import { storeAttributionEvent, type AttributionEvent, type AttributionEventType } from "../../../lib/attribution.ts";
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
    const rlKey = `rl:webhook:actionnetwork:${ipHash}:${window}`;
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

  // --- Read body (need raw bytes for HMAC verification) ---
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: "Could not read body" });
  }
  if (raw.length > MAX_BODY) {
    return json(413, { error: "Payload exceeds 100 KB limit" });
  }

  // --- HMAC-SHA256 signature verification ---
  const secret = (env as Record<string, unknown>).AN_WEBHOOK_SECRET as string | undefined;
  const sigHeader = request.headers.get("x-action-network-signature");

  if (secret) {
    // If we have a secret configured, require a valid signature
    if (!sigHeader) {
      return json(401, { error: "Missing signature" });
    }
    const valid = await verifyHmacSignature(raw, sigHeader, secret);
    if (!valid) {
      return json(401, { error: "Invalid signature" });
    }
  }
  // If no secret configured, accept anyway (some AN plans don't support signing)

  // --- Parse payload ---
  let payload: ANPayload;
  try {
    payload = JSON.parse(raw) as ANPayload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // --- Extract email ---
  const email = extractEmail(payload);
  if (!email) {
    return json(422, { error: "No email found in payload" });
  }

  const emailHash = await sha256Hex(email.toLowerCase().trim());

  // --- Determine event type and extract metadata ---
  const eventType = mapEventType(payload);
  const resourceUrl = extractResourceUrl(payload);
  const slug = extractSlug(payload);

  const event: AttributionEvent = {
    id: crypto.randomUUID(),
    source: "actionnetwork",
    event_type: eventType,
    email_hash: emailHash,
    slug,
    amount: extractAmount(payload),
    recurring: payload["osdi:donation"]?.recurrence?.recurring ?? undefined,
    metadata: {
      action_type: payload["action_type"] ?? eventType,
      resource_url: resourceUrl,
    },
    timestamp: payload.created_date ?? new Date().toISOString(),
  };

  // --- Store ---
  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  try {
    await storeAttributionEvent(db, event);
  } catch (err) {
    console.error("[an-webhook] insert failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Storage failed" });
  }

  return json(200, { ok: true });
};

// --- Types ---

interface ANPayload {
  action_type?: string;
  created_date?: string;
  "osdi:person"?: {
    email_addresses?: Array<{ address?: string }>;
  };
  "osdi:donation"?: {
    amount?: string | number;
    recurrence?: { recurring?: boolean };
  };
  "osdi:attendance"?: Record<string, unknown>;
  "osdi:submission"?: Record<string, unknown>;
  "osdi:outreach"?: Record<string, unknown>;
  _links?: {
    "osdi:action"?: { href?: string };
    "osdi:event"?: { href?: string };
    "osdi:form"?: { href?: string };
    self?: { href?: string };
  };
  // Allow arbitrary fields
  [key: string]: unknown;
}

// --- Helpers ---

function extractEmail(payload: ANPayload): string | undefined {
  const addresses = payload["osdi:person"]?.email_addresses;
  if (Array.isArray(addresses) && addresses.length > 0) {
    return addresses[0]?.address;
  }
  return undefined;
}

function mapEventType(payload: ANPayload): AttributionEventType {
  const actionType = (payload.action_type ?? "").toLowerCase();
  if (actionType.includes("donation") || payload["osdi:donation"]) return "donation";
  if (actionType.includes("attendance") || payload["osdi:attendance"]) return "attendance";
  if (actionType.includes("outreach") || payload["osdi:outreach"]) return "email_open";
  return "action";
}

function extractResourceUrl(payload: ANPayload): string | undefined {
  const links = payload._links;
  if (!links) return undefined;
  return (
    links["osdi:action"]?.href ??
    links["osdi:event"]?.href ??
    links["osdi:form"]?.href ??
    links.self?.href
  );
}

/**
 * Extract action page slug from AN resource URL or payload metadata.
 * AN doesn't have a native refcode field, so we check for UTM-style
 * tracking parameters or parse the action title.
 */
function extractSlug(payload: ANPayload): string | undefined {
  // Check for explicit slug in payload metadata
  if (typeof payload.slug === "string") return payload.slug;
  if (typeof payload.refcode === "string") return payload.refcode;

  // Try to extract from resource URL query params
  const resourceUrl = extractResourceUrl(payload);
  if (resourceUrl) {
    try {
      const url = new URL(resourceUrl);
      const source = url.searchParams.get("source") ?? url.searchParams.get("refcode");
      if (source) return source;
    } catch {
      // Not a valid URL, skip
    }
  }

  return undefined;
}

function extractAmount(payload: ANPayload): number | undefined {
  const donation = payload["osdi:donation"];
  if (!donation?.amount) return undefined;
  const val = parseFloat(String(donation.amount));
  return isNaN(val) ? undefined : val;
}

/**
 * Timing-safe HMAC-SHA256 signature verification.
 *
 * AN sends: X-Action-Network-Signature: sha256=<hex>
 * We compute HMAC-SHA256(body, secret) and compare in constant time.
 */
async function verifyHmacSignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Parse "sha256=abc123..." format
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const receivedHex = signatureHeader.slice(prefix.length);

  const encoder = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return false;
  }

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison: always compare full length
  if (computedHex.length !== receivedHex.length) return false;
  let result = 0;
  for (let i = 0; i < computedHex.length; i++) {
    result |= computedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return result === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
