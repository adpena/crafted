/**
 * Authenticated paginated audit log.
 *
 * GET /api/admin/audit-log?action=&target=&actor=&limit=50&offset=0
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns audit entries newest-first with optional action/target/actor filters.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { AUDIT_PLUGIN_ID, AUDIT_COLLECTION, type AuditRow } from "../../../lib/audit.ts";
import { verifyBearer } from "../../../lib/auth.ts";

const MAX_LIMIT = 500;

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
      first(): Promise<Record<string, unknown> | null>;
    };
  };
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

  const action = (url.searchParams.get("action") ?? "").slice(0, 100);
  const target = (url.searchParams.get("target") ?? "").slice(0, 500);
  const actor = (url.searchParams.get("actor") ?? "").slice(0, 200);

  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  try {
    const filtersActive = Boolean(action || target || actor);
    // Over-fetch capped at 500 to bound Worker memory / D1 read cost.
    const fetchLimit = filtersActive ? Math.min(MAX_LIMIT * 3, 500) : limit;
    const fetchOffset = filtersActive ? 0 : offset;

    const countRow = await db
      .prepare(
        "SELECT COUNT(*) as total FROM _plugin_storage WHERE plugin_id = ? AND collection = ?",
      )
      .bind(AUDIT_PLUGIN_ID, AUDIT_COLLECTION)
      .first();
    const totalAll = (countRow?.total as number) ?? 0;

    const { results } = await db
      .prepare(
        "SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .bind(AUDIT_PLUGIN_ID, AUDIT_COLLECTION, fetchLimit, fetchOffset)
      .all();

    let rows: AuditRow[] = results.map((r) => {
      try {
        return JSON.parse(r.data as string) as AuditRow;
      } catch {
        return {
          id: r.id as string,
          action: "",
          target: "",
          actor: "",
          metadata: null,
          ip_hash: null,
          user_agent: null,
          timestamp: (r.created_at as string) ?? "",
        };
      }
    });

    if (action) rows = rows.filter((r) => r.action === action);
    if (actor) rows = rows.filter((r) => r.actor === actor);
    if (target) rows = rows.filter((r) => r.target.includes(target));

    // HTML-escape user-supplied strings so admin UIs can render directly.
    rows = rows.map((r) => ({
      ...r,
      action: htmlEscape(r.action),
      target: htmlEscape(r.target),
      actor: htmlEscape(r.actor),
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
    console.error("[audit-log] D1 query failed:", err instanceof Error ? err.message : "unknown");
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
