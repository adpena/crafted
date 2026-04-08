/**
 * Authenticated single-contact endpoint.
 *
 * GET   /api/admin/contacts/{id}  → full contact + complete action history
 * PATCH /api/admin/contacts/{id}  → update tags { add_tags?, remove_tags? }
 *
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Contact } from "../../../../lib/contacts-types.ts";
import { sanitizeTag, MAX_TAGS_PER_CONTACT } from "../../../../lib/contacts.ts";
import { verifyBearer } from "../../../../lib/auth.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
    };
  };
}

async function authed(request: Request): Promise<boolean> {
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  return verifyBearer(request.headers.get("Authorization"), token);
}

export const GET: APIRoute = async ({ params, request }) => {
  if (!(await authed(request))) return json(401, { error: "Unauthorized" });

  const id = String(params.id ?? "");
  if (!id || !ID_RE.test(id)) return json(400, { error: "Invalid id" });

  const db = (env as Record<string, unknown>).DB as D1Like;

  try {
    const row = await db
      .prepare(
        "SELECT id, data, created_at, updated_at FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1",
      )
      .bind(id, PLUGIN_ID, COLLECTION)
      .first();

    if (!row) return json(404, { error: "Not found" });

    const contact = JSON.parse(row.data as string) as Contact;
    return json(200, {
      data: {
        id: row.id as string,
        ...contact,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      },
    });
  } catch (err) {
    console.error("[admin/contacts/:id] GET failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Query failed" });
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  if (!(await authed(request))) return json(401, { error: "Unauthorized" });

  const id = String(params.id ?? "");
  if (!id || !ID_RE.test(id)) return json(400, { error: "Invalid id" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { add_tags?: unknown; remove_tags?: unknown };
  try {
    body = (await request.json()) as { add_tags?: unknown; remove_tags?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const addRaw = Array.isArray(body.add_tags) ? body.add_tags : [];
  const removeRaw = Array.isArray(body.remove_tags) ? body.remove_tags : [];

  const addTags = addRaw
    .map((t) => sanitizeTag(t))
    .filter((t): t is string => t !== null);
  const removeTags = removeRaw
    .map((t) => sanitizeTag(t))
    .filter((t): t is string => t !== null);

  if (addTags.length === 0 && removeTags.length === 0) {
    return json(400, { error: "No valid tag changes provided" });
  }

  const db = (env as Record<string, unknown>).DB as D1Like;

  try {
    const row = await db
      .prepare(
        "SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1",
      )
      .bind(id, PLUGIN_ID, COLLECTION)
      .first();

    if (!row) return json(404, { error: "Not found" });

    const contact = JSON.parse(row.data as string) as Contact;
    const currentTags = Array.isArray(contact.tags) ? contact.tags : [];

    // Build the new tag set: remove first, then add (dedup), then enforce cap.
    const removeSet = new Set(removeTags);
    const next = currentTags.filter((t) => !removeSet.has(t));
    for (const t of addTags) {
      if (!next.includes(t)) next.push(t);
    }
    if (next.length > MAX_TAGS_PER_CONTACT) {
      return json(400, { error: `Tag limit exceeded (max ${MAX_TAGS_PER_CONTACT})` });
    }

    const now = new Date().toISOString();
    const updated: Contact = { ...contact, tags: next };

    await db
      .prepare(
        "UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE id = ? AND plugin_id = ? AND collection = ?",
      )
      .bind(JSON.stringify(updated), now, id, PLUGIN_ID, COLLECTION)
      .run();

    return json(200, {
      data: {
        id,
        tags: next,
        updated_at: now,
      },
    });
  } catch (err) {
    console.error("[admin/contacts/:id] PATCH failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Update failed" });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
