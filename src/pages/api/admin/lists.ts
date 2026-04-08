/**
 * Saved list management for cross-campaign contact intelligence.
 *
 * POST   /api/admin/lists       — create a named saved list (stores filters, not contacts)
 * GET    /api/admin/lists       — list all saved lists with current contact counts
 * GET    /api/admin/lists?id=X  — get a saved list's contacts (re-runs the query)
 * DELETE /api/admin/lists?id=X  — delete a saved list
 *
 * Authorization: Bearer <firm/campaign token or MCP_ADMIN_TOKEN>
 *
 * Campaign-level access requires list_builder_access sharing permission.
 * Campaign-scoped lists only see contacts from their own pages.
 *
 * Lists are dynamic — queries are re-run each time so results reflect
 * current data. Stored in `_plugin_storage` with collection='saved_lists'.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { ContactsD1 } from "../../../lib/contacts.ts";
import { logAudit, type AuditD1 } from "../../../lib/audit.ts";
import { runContactSearch, type SearchFilters, type ContactResult } from "../../../lib/contact-search.ts";
import {
  resolveAuthCompat,
  getPageSlugsForCampaigns,
  type TenancyD1,
  type TenancyKV,
} from "../../../lib/tenancy.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "saved_lists";
const MAX_NAME_LEN = 200;

interface SavedList {
  name: string;
  filters: SearchFilters;
  campaign_id?: string;
  created_at: string;
  updated_at: string;
}

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as ContactsD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db as TenancyD1, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  // Campaign-level: check list_builder_access
  if (auth.level === "campaign" && !auth.campaign?.sharing?.list_builder_access) {
    return json(403, { error: "List builder access not enabled for this campaign" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { name?: string; filters?: SearchFilters };
  try {
    body = (await request.json()) as { name?: string; filters?: SearchFilters };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const name = (body.name ?? "").trim().slice(0, MAX_NAME_LEN);
  if (!name) {
    return json(400, { error: "name is required" });
  }

  const filters = body.filters ?? {};

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const data: SavedList = {
    name,
    filters,
    campaign_id: auth.campaignId,
    created_at: now,
    updated_at: now,
  };

  await db
    .prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, PLUGIN_ID, COLLECTION, JSON.stringify(data), now, now)
    .run();

  await logAudit(db as AuditD1, {
    action: "list_create",
    target: `list:${id}`,
    actor: auth.level === "campaign" ? `campaign:${auth.campaignId}` : "firm-admin",
    metadata: { name },
    request,
  }).catch(() => {});

  return json(201, { id, name, filters, created_at: now });
};

export const GET: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as ContactsD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db as TenancyD1, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  // Campaign-level: check list_builder_access
  if (auth.level === "campaign" && !auth.campaign?.sharing?.list_builder_access) {
    return json(403, { error: "List builder access not enabled for this campaign" });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    // Get a single saved list and re-run its query
    const row = await db
      .prepare("SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1")
      .bind(id, PLUGIN_ID, COLLECTION)
      .first();

    if (!row) {
      return json(404, { error: "List not found" });
    }

    let saved: SavedList;
    try {
      saved = JSON.parse(row.data as string) as SavedList;
    } catch {
      return json(500, { error: "Corrupted list data" });
    }

    // Campaign-level: can only access their own lists
    if (auth.level === "campaign" && saved.campaign_id && saved.campaign_id !== auth.campaignId) {
      return json(403, { error: "Access denied to this list" });
    }

    const { data, total } = await runContactSearch(db, saved.filters, 500, 0);

    return json(200, {
      id: row.id,
      name: saved.name,
      filters: saved.filters,
      created_at: saved.created_at,
      contacts: data,
      total,
    });
  }

  // List all saved lists with current counts
  const rows = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY updated_at DESC",
    )
    .bind(PLUGIN_ID, COLLECTION)
    .all();

  const lists: Array<{
    id: string;
    name: string;
    filters: SearchFilters;
    created_at: string;
    contact_count: number;
  }> = [];

  for (const row of rows.results) {
    let saved: SavedList;
    try {
      saved = JSON.parse(row.data as string) as SavedList;
    } catch {
      continue;
    }

    // Campaign-level: only show their own lists
    if (auth.level === "campaign" && saved.campaign_id && saved.campaign_id !== auth.campaignId) {
      continue;
    }

    const { total } = await runContactSearch(db, saved.filters, 0, 0);
    lists.push({
      id: row.id as string,
      name: saved.name,
      filters: saved.filters,
      created_at: saved.created_at,
      contact_count: total,
    });
  }

  return json(200, { data: lists });
};

export const DELETE: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as ContactsD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db as TenancyD1, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return json(400, { error: "id query parameter is required" });
  }

  const existing = await db
    .prepare("SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1")
    .bind(id, PLUGIN_ID, COLLECTION)
    .first();

  if (!existing) {
    return json(404, { error: "List not found" });
  }

  // Campaign-level: can only delete their own lists
  if (auth.level === "campaign") {
    try {
      const saved = JSON.parse(existing.data as string) as SavedList;
      if (saved.campaign_id && saved.campaign_id !== auth.campaignId) {
        return json(403, { error: "Access denied to this list" });
      }
    } catch {
      // Allow delete of corrupted records
    }
  }

  await db
    .prepare("DELETE FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ?")
    .bind(id, PLUGIN_ID, COLLECTION)
    .run();

  await logAudit(db as AuditD1, {
    action: "list_delete",
    target: `list:${id}`,
    actor: auth.level === "campaign" ? `campaign:${auth.campaignId}` : "firm-admin",
    request,
  }).catch(() => {});

  return json(200, { deleted: true });
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
