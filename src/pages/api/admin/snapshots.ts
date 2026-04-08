/**
 * Page snapshot archive for FEC audit trail.
 *
 * GET /api/admin/snapshots?slug=X
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns all snapshots for a page, ordered by date descending.
 * Each snapshot captures the full page config at publish time,
 * including committee name, treasurer, context (IE/PAC), and all
 * template/action props — so compliance counsel can reconstruct
 * what the page looked like on any given date.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";

const PLUGIN_ID = "action-pages";

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

export const GET: APIRoute = async ({ url, request }) => {
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const slug = url.searchParams.get("slug");
  if (!slug) {
    return json(400, { error: "slug query parameter is required" });
  }

  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  try {
    const { results } = await db
      .prepare(
        "SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = 'page_snapshots' AND json_extract(data, '$.slug') = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(PLUGIN_ID, slug)
      .all();

    const snapshots = (results ?? []).map((row) => {
      try {
        const d = JSON.parse(row.data as string);
        return { id: row.id, ...d };
      } catch {
        return { id: row.id, error: "corrupt_snapshot" };
      }
    });

    return json(200, { data: snapshots });
  } catch (err) {
    console.error("[snapshots] D1 query failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Query failed" });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
