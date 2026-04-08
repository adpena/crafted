/**
 * Authenticated single-contact endpoint.
 *
 * GET    /api/admin/contacts/{id}  → full contact + complete action history
 * PATCH  /api/admin/contacts/{id}  → update tags { add_tags?, remove_tags? }
 * DELETE /api/admin/contacts/{id}  → CCPA/GDPR erasure (hard delete + anonymize submissions)
 *
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Contact } from "../../../../lib/contacts-types.ts";
import { sanitizeTag, MAX_TAGS_PER_CONTACT } from "../../../../lib/contacts.ts";
import { verifyBearer } from "../../../../lib/auth.ts";
import { logAudit } from "../../../../lib/audit.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
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

export const DELETE: APIRoute = async ({ params, request }) => {
  if (!(await authed(request))) return json(401, { error: "Unauthorized" });

  const id = String(params.id ?? "");
  if (!id || !ID_RE.test(id)) return json(400, { error: "Invalid id" });

  const db = (env as Record<string, unknown>).DB as D1Like;
  const kv = (env as Record<string, unknown>).CACHE as import("../../../../lib/cf-types.ts").KVNamespace | undefined;

  try {
    // 1. Fetch the contact to get their email for submission anonymization
    const row = await db
      .prepare(
        "SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1",
      )
      .bind(id, PLUGIN_ID, COLLECTION)
      .first();

    if (!row) return json(404, { error: "Not found" });

    const contact = JSON.parse(row.data as string) as Contact;
    const email = contact.email;

    // 2. Anonymize submissions containing this email
    let submissionsAnonymized = 0;
    if (email) {
      submissionsAnonymized = await anonymizeSubmissionsByEmail(db, email);
    }

    // 3. Delete KV dedup keys for this email (best-effort — keys are hashed)
    if (email && kv) {
      await deleteDedupKeys(db, kv, email);
    }

    // 4. Hard-delete the contact record
    await db
      .prepare(
        "DELETE FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ?",
      )
      .bind(id, PLUGIN_ID, COLLECTION)
      .run();

    // 5. Audit log (no PII — only record id)
    await logAudit(db, {
      action: "contact_deleted",
      target: `contact:${id}`,
      actor: "admin",
      metadata: { submissions_anonymized: submissionsAnonymized },
      request,
    });

    return json(200, { deleted: true, submissions_anonymized: submissionsAnonymized });
  } catch (err) {
    console.error("[admin/contacts/:id] DELETE failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Delete failed" });
  }
};

/**
 * Find all submissions containing this email and replace PII fields with
 * "[redacted]". Preserves rows for aggregate counts.
 */
async function anonymizeSubmissionsByEmail(db: D1Like, email: string): Promise<number> {
  const normalizedEmail = email.toLowerCase().trim();

  // Submissions are stored in _plugin_storage with collection='submissions'.
  // The data field is JSON; email is stored at $.email.
  const rows = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.email') = ?",
    )
    .bind(PLUGIN_ID, normalizedEmail)
    .all();

  const now = new Date().toISOString();
  let count = 0;

  for (const row of rows.results) {
    const data = JSON.parse(row.data as string) as Record<string, unknown>;

    // Redact PII fields — preserve non-PII (slug, action type, timestamp, etc.)
    const PII_FIELDS = ["email", "first_name", "firstName", "last_name", "lastName", "zip", "postalCode", "postal_code", "name", "phone", "comment"];
    for (const field of PII_FIELDS) {
      if (data[field] !== undefined) {
        data[field] = "[redacted]";
      }
    }

    await db
      .prepare(
        "UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE id = ? AND plugin_id = ? AND collection = 'submissions'",
      )
      .bind(JSON.stringify(data), now, row.id as string, PLUGIN_ID)
      .run();

    count++;
  }

  return count;
}

/**
 * Delete KV dedup keys for this email across all known page slugs.
 * Dedup keys are `dedup:<sha256(email:slug)>` — we query submissions
 * to find which slugs this email appeared on, then delete those keys.
 */
async function deleteDedupKeys(
  db: D1Like,
  kv: import("../../../../lib/cf-types.ts").KVNamespace,
  email: string,
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find distinct slugs this email submitted to
  const rows = await db
    .prepare(
      "SELECT DISTINCT json_extract(data, '$.slug') AS slug FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.email') = ?",
    )
    .bind(PLUGIN_ID, normalizedEmail)
    .all();

  for (const row of rows.results) {
    const slug = row.slug as string | null;
    if (!slug) continue;

    // Reproduce the dedup key hash (same algorithm as src/lib/dedup.ts)
    const data = new TextEncoder().encode(`${normalizedEmail}:${slug}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    try {
      await kv.delete(`dedup:${hash}`);
    } catch {
      // Best-effort — KV delete failures are non-fatal
    }
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
