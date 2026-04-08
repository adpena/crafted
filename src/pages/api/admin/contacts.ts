/**
 * Authenticated paginated contacts list.
 *
 * GET /api/admin/contacts?limit=50&offset=0&q=search&tag=filter
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns paginated contacts (action-pages plugin) with optional search
 * across email/first_name/last_name and an optional tag filter.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Contact } from "../../../lib/contacts-types.ts";
import { verifyBearer } from "../../../lib/auth.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";
const MAX_LIMIT = 200;

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

  const search = (url.searchParams.get("q") ?? "").slice(0, 100).toLowerCase();
  const tagFilter = (url.searchParams.get("tag") ?? "").slice(0, 50);

  const db = (env as Record<string, unknown>).DB as D1Like;

  try {
    const countRow = await db
      .prepare(
        "SELECT COUNT(*) as total FROM _plugin_storage WHERE plugin_id = ? AND collection = ?",
      )
      .bind(PLUGIN_ID, COLLECTION)
      .first();
    const totalAll = (countRow?.total as number) ?? 0;

    // When filters are active we over-fetch and filter in JS. Cap the
    // over-fetch at 500 rows to bound Worker memory and D1 read cost.
    // For larger result sets the client should use more specific filters
    // or paginate through the full list (offset + limit).
    const filtersActive = Boolean(search || tagFilter);
    const fetchLimit = filtersActive ? Math.min(MAX_LIMIT * 3, 500) : limit;
    const fetchOffset = filtersActive ? 0 : offset;

    const { results } = await db
      .prepare(
        "SELECT id, data, created_at, updated_at FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY json_extract(data, '$.last_action_at') DESC LIMIT ? OFFSET ?",
      )
      .bind(PLUGIN_ID, COLLECTION, fetchLimit, fetchOffset)
      .all();

    let rows = results.map((r) => {
      const c = JSON.parse(r.data as string) as Contact;
      return {
        id: r.id as string,
        email: c.email,
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        zip: c.zip ?? null,
        first_seen_at: c.first_seen_at,
        last_action_at: c.last_action_at,
        total_actions: c.total_actions ?? 0,
        tags: Array.isArray(c.tags) ? c.tags : [],
        // Light summary, not the full action history.
        last_action: Array.isArray(c.action_history) && c.action_history.length > 0
          ? c.action_history[c.action_history.length - 1]
          : null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });

    if (tagFilter) {
      rows = rows.filter((r) => r.tags.includes(tagFilter));
    }

    if (search) {
      rows = rows.filter((r) => {
        return [r.email, r.first_name, r.last_name]
          .filter((v): v is string => typeof v === "string")
          .some((v) => v.toLowerCase().includes(search));
      });
    }

    const filteredTotal = filtersActive ? rows.length : totalAll;

    if (filtersActive) {
      rows = rows.slice(offset, offset + limit);
    }

    return json(200, {
      data: rows,
      pagination: {
        total: filteredTotal,
        total_all: totalAll,
        limit,
        offset,
        has_more: offset + rows.length < filteredTotal,
      },
    });
  } catch (err) {
    console.error("[admin/contacts] D1 query failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Query failed" });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
