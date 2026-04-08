/**
 * Authenticated paginated webhook inbox.
 *
 * GET /api/admin/webhook-inbox?source=&since=&limit=50&offset=0
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns webhook inbox entries newest-first.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "webhook_inbox";
const MAX_LIMIT = 500;
const SOURCE_RE = /^[a-z][a-z0-9-]{0,31}$/;

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
      first(): Promise<Record<string, unknown> | null>;
    };
  };
}

interface InboxEntry {
  id: string;
  source: string;
  payload: string;
  ip_hash: string | null;
  user_agent: string | null;
  timestamp: string;
}

export const GET: APIRoute = async ({ url, request }) => {
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const rawLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = isNaN(rawLimit) || rawLimit <= 0 ? 50 : Math.min(rawLimit, MAX_LIMIT);

  const rawOffset = parseInt(url.searchParams.get("offset") ?? "", 10);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const sourceParam = (url.searchParams.get("source") ?? "").slice(0, 32);
  const source = sourceParam && SOURCE_RE.test(sourceParam) ? sourceParam : "";
  const since = (url.searchParams.get("since") ?? "").slice(0, 40); // ISO date

  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  try {
    const filtersActive = Boolean(source || since);
    // Over-fetch capped at 500 to bound Worker memory / D1 read cost.
    const fetchLimit = filtersActive ? Math.min(MAX_LIMIT * 3, 500) : limit;
    const fetchOffset = filtersActive ? 0 : offset;

    const countRow = await db
      .prepare(
        "SELECT COUNT(*) as total FROM _plugin_storage WHERE plugin_id = ? AND collection = ?",
      )
      .bind(PLUGIN_ID, COLLECTION)
      .first();
    const totalAll = (countRow?.total as number) ?? 0;

    const { results } = await db
      .prepare(
        "SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .bind(PLUGIN_ID, COLLECTION, fetchLimit, fetchOffset)
      .all();

    let rows: InboxEntry[] = results.map((r) => {
      try {
        return JSON.parse(r.data as string) as InboxEntry;
      } catch {
        return {
          id: r.id as string,
          source: "",
          payload: "",
          ip_hash: null,
          user_agent: null,
          timestamp: (r.created_at as string) ?? "",
        };
      }
    });

    if (source) rows = rows.filter((r) => r.source === source);
    if (since) rows = rows.filter((r) => r.timestamp >= since);

    rows = rows.map((r) => ({
      ...r,
      source: htmlEscape(r.source),
      user_agent: r.user_agent ? htmlEscape(r.user_agent) : null,
    }));

    const filteredTotal = filtersActive ? rows.length : totalAll;
    if (filtersActive) {
      rows = rows.slice(offset, offset + limit);
    }

    return json(200, {
      data: rows,
      pagination: {
        total: filteredTotal,
        limit,
        offset,
        has_more: offset + rows.length < filteredTotal,
      },
    });
  } catch (err) {
    console.error("[webhook-inbox] D1 query failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Query failed" });
  }
};

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
