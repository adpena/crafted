/**
 * Authenticated Figma file metadata import.
 *
 * POST /api/admin/figma-import
 *   Authorization: Bearer <MCP_ADMIN_TOKEN>
 *   Body: { "url": "https://www.figma.com/design/ABC.../My-Page" }
 *
 * Returns:
 *   {
 *     file_key, name, thumbnail_url?, last_modified?,
 *     colors: [{ hex, count }, ...]
 *   }
 *
 * Env: FIGMA_ACCESS_TOKEN — Figma personal access token.
 * KV cache: 1 hour per file URL (keyed on full URL, not just file key,
 * so re-runs from the admin UI stay snappy without being stale for long).
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";
import { fetchFigmaMetadata } from "../../../lib/figma.ts";
import { logAudit } from "../../../lib/audit.ts";

const CACHE_TTL_SEC = 3600;

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;

  const token = e.MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (!body.url || typeof body.url !== "string" || body.url.length > 2048) {
    return json(400, { error: "Missing or invalid 'url' field" });
  }

  const figmaToken = e.FIGMA_ACCESS_TOKEN as string | undefined;
  if (!figmaToken) {
    return json(503, { error: "Figma integration not configured" });
  }

  const kv = e.CACHE as KVNamespace | undefined;
  const cacheKey = `figma:${body.url}`;
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
      // Fall through to live fetch on KV errors.
    }
  }

  try {
    const metadata = await fetchFigmaMetadata(body.url, { token: figmaToken });
    const responseBody = JSON.stringify(metadata);

    if (kv) {
      try {
        await kv.put(cacheKey, responseBody, { expirationTtl: CACHE_TTL_SEC });
      } catch {
        // Non-fatal.
      }
    }

    const db = e.DB as Parameters<typeof logAudit>[0];
    if (db) {
      await logAudit(db, {
        action: "figma_import",
        target: metadata.file_key,
        actor: "admin",
        metadata: { name: metadata.name, colors: metadata.colors.length },
        request,
      }).catch(() => {});
    }

    return new Response(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Figma import failed";
    console.error("[figma-import] error:", message);
    // 400 for user errors (bad URL, invalid token) and 502 for upstream.
    const upstreamFailure = message.includes("Figma API");
    return json(upstreamFailure ? 502 : 400, { error: message });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
