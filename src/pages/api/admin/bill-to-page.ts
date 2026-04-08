/**
 * Bill-to-Page generator endpoint.
 *
 * POST /api/admin/bill-to-page
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Body: { bill: string, action: "letter" | "call" }
 *
 * Parses a Congress.gov URL or bill reference (e.g. "HR 4532"),
 * fetches the bill summary, and generates a complete action page
 * via the Anthropic API.
 *
 * KV cached for 24 hours by bill URL + action type.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generatePageFromBill } from "../../../lib/bill-to-page.ts";
import { verifyBearer } from "../../../lib/auth.ts";

const OUTER_TIMEOUT_MS = 30_000;

export const POST: APIRoute = async ({ request }) => {
  // Auth — timing-safe
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { bill?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (typeof body.bill !== "string" || !body.bill.trim()) {
    return json(400, { error: "Missing 'bill' — provide a Congress.gov URL or bill reference (e.g. 'HR 4532')" });
  }

  const bill = body.bill.trim();
  if (bill.length > 512) {
    return json(400, { error: "'bill' too long" });
  }

  const actionType = body.action;
  if (actionType !== "letter" && actionType !== "call") {
    return json(400, { error: "'action' must be 'letter' or 'call'" });
  }

  const anthropicApiKey = (env as Record<string, unknown>).ANTHROPIC_API_KEY as string | undefined;
  if (!anthropicApiKey) {
    return json(503, { error: "AI generator not configured" });
  }

  const congressApiKey = (env as Record<string, unknown>).CONGRESS_API_KEY as string | undefined;

  // KV cache — 24 hours by bill + action type
  const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
  const cacheKey = `bill-page:${await sha256(`${bill}|${actionType}`)}`;
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }
    } catch {
      // Non-fatal
    }
  }

  // Outer timeout
  const outerTimer = AbortSignal.timeout(OUTER_TIMEOUT_MS);
  try {
    const result = await Promise.race([
      generatePageFromBill({
        billUrl: bill,
        actionType,
        anthropicApiKey,
        congressApiKey,
      }),
      new Promise<never>((_, reject) => {
        outerTimer.addEventListener("abort", () => reject(new Error("Outer timeout")));
      }),
    ]);

    const responseBody = JSON.stringify(result);
    if (kv) {
      try {
        await kv.put(cacheKey, responseBody, { expirationTtl: 86400 });
      } catch {
        // Non-fatal
      }
    }

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    const safe =
      err instanceof Error && err.message === "Outer timeout"
        ? "Generation timed out — Congress.gov may be slow"
        : err instanceof Error && (err.message.includes("parse") || err.message.includes("Congress"))
          ? err.message
          : "Generation failed";
    console.error("[bill-to-page] error:", safe);
    return json(502, { error: safe });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
