/**
 * Public webhook receiver inbox.
 *
 * POST /api/webhooks/:source
 * Content-Type: application/json
 * Body: arbitrary JSON, max 100 KB
 *
 * Stores the raw payload in `_plugin_storage` (plugin_id='action-pages',
 * collection='webhook_inbox') for later inspection. Never parses or
 * validates the payload beyond confirming it is JSON.
 *
 * PUBLIC — no auth. Rate-limited per IP.
 */

import type { APIRoute } from "astro";
import { sha256Hex } from "../../../lib/auth.ts";
import { env } from "cloudflare:workers";

const PLUGIN_ID = "action-pages";
const COLLECTION = "webhook_inbox";
const MAX_BODY = 100 * 1024; // 100 KB
const SOURCE_RE = /^[a-z][a-z0-9-]{0,31}$/;
const RATE_MAX = 20;
const RATE_WINDOW_SEC = 60;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
    };
  };
}

export const POST: APIRoute = async ({ params, request }) => {
  const source = String(params.source ?? "");
  if (!SOURCE_RE.test(source)) {
    return json(400, { error: "Invalid source" });
  }

  // Content-Type check
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  // Body size guard
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY) {
    return json(413, { error: "Payload exceeds 100 KB limit" });
  }

  // Rate limit per IP — SHA-256 prefix for privacy-preserving storage
  const ip = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "0.0.0.0";
  const ipHash = (await sha256Hex(ip)).slice(0, 32);

  const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
  if (kv) {
    const window = Math.floor(Date.now() / 1000 / RATE_WINDOW_SEC);
    const rlKey = `rl:webhook:${ipHash}:${window}`;
    try {
      const raw = await kv.get(rlKey);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= RATE_MAX) {
        return json(429, { error: "Rate limit exceeded" });
      }
      await kv.put(rlKey, String(count + 1), { expirationTtl: RATE_WINDOW_SEC });
    } catch {
      // Fail open on KV errors — webhook delivery is best-effort.
    }
  }

  // Read raw body, validate JSON without parsing further
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: "Could not read body" });
  }
  if (raw.length > MAX_BODY) {
    return json(413, { error: "Payload exceeds 100 KB limit" });
  }
  try {
    JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const record = {
    id,
    source,
    payload: raw, // store as a string to preserve exact bytes
    ip_hash: ipHash,
    user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    timestamp,
  };

  try {
    await db
      .prepare(
        "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, PLUGIN_ID, COLLECTION, JSON.stringify(record), timestamp, timestamp)
      .run();
  } catch (err) {
    console.error("[webhook] insert failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Storage failed" });
  }

  return json(200, { ok: true });
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
