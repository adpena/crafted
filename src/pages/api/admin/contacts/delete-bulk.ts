/**
 * Bulk contact deletion endpoint for CCPA/GDPR right-to-erasure.
 *
 * POST /api/admin/contacts/delete-bulk
 * Body: { "email": "ada@example.com" } or { "ids": ["id1", "id2"] }
 *
 * - Finds ALL contacts matching the email (or the given IDs) across all campaigns
 * - Hard-deletes the contact records
 * - Anonymizes all their submission records (replaces PII with "[redacted]")
 * - Removes KV dedup keys
 * - Returns count of records affected
 *
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../../lib/auth.ts";
import { logAudit } from "../../../../lib/audit.ts";
import type { KVNamespace } from "../../../../lib/cf-types.ts";

const PLUGIN_ID = "action-pages";
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const POST: APIRoute = async ({ request }) => {
  if (!(await authed(request))) return json(401, { error: "Unauthorized" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { email?: unknown; ids?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; ids?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const db = (env as Record<string, unknown>).DB as D1Like;
  const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;

  try {
    if (typeof body.email === "string" && body.email.trim()) {
      return await deleteByEmail(db, kv, body.email.trim(), request);
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      return await deleteByIds(db, kv, body.ids, request);
    }

    return json(400, { error: "Provide either 'email' (string) or 'ids' (array)" });
  } catch (err) {
    console.error("[admin/contacts/delete-bulk] failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Bulk delete failed" });
  }
};

async function deleteByEmail(
  db: D1Like,
  kv: KVNamespace | undefined,
  email: string,
  request: Request,
): Promise<Response> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return json(400, { error: "Invalid email format" });
  }

  // Find all contacts with this email
  const contactRows = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'contacts' AND json_extract(data, '$.email') = ?",
    )
    .bind(PLUGIN_ID, normalizedEmail)
    .all();

  // Anonymize all submissions from this email
  const submissionsAnonymized = await anonymizeSubmissionsByEmail(db, normalizedEmail);

  // Delete KV dedup keys
  if (kv) {
    await deleteDedupKeys(db, kv, normalizedEmail);
  }

  // Hard-delete all matching contact records
  let contactsDeleted = 0;
  for (const row of contactRows.results) {
    await db
      .prepare(
        "DELETE FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = 'contacts'",
      )
      .bind(row.id as string, PLUGIN_ID)
      .run();
    contactsDeleted++;
  }

  // Audit log (no raw PII — only counts)
  await logAudit(db, {
    action: "bulk_contact_delete",
    target: `email_erasure`,
    actor: "admin",
    metadata: { contacts_deleted: contactsDeleted, submissions_anonymized: submissionsAnonymized },
    request,
  });

  return json(200, {
    deleted: true,
    contacts_deleted: contactsDeleted,
    submissions_anonymized: submissionsAnonymized,
  });
}

async function deleteByIds(
  db: D1Like,
  kv: KVNamespace | undefined,
  ids: unknown[],
  request: Request,
): Promise<Response> {
  const validIds = ids
    .filter((id): id is string => typeof id === "string" && ID_RE.test(id))
    .slice(0, 100); // Cap at 100 per request

  if (validIds.length === 0) {
    return json(400, { error: "No valid IDs provided" });
  }

  let contactsDeleted = 0;
  let totalSubmissionsAnonymized = 0;

  for (const id of validIds) {
    // Fetch contact to get email
    const row = await db
      .prepare(
        "SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = 'contacts' LIMIT 1",
      )
      .bind(id, PLUGIN_ID)
      .first();

    if (!row) continue;

    const contact = JSON.parse(row.data as string) as { email?: string };
    const email = contact.email?.toLowerCase().trim();

    // Anonymize submissions for this email
    if (email) {
      totalSubmissionsAnonymized += await anonymizeSubmissionsByEmail(db, email);
      if (kv) await deleteDedupKeys(db, kv, email);
    }

    // Hard-delete the contact
    await db
      .prepare(
        "DELETE FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = 'contacts'",
      )
      .bind(id, PLUGIN_ID)
      .run();
    contactsDeleted++;
  }

  await logAudit(db, {
    action: "bulk_contact_delete",
    target: `ids_erasure:${contactsDeleted}`,
    actor: "admin",
    metadata: { contacts_deleted: contactsDeleted, submissions_anonymized: totalSubmissionsAnonymized },
    request,
  });

  return json(200, {
    deleted: true,
    contacts_deleted: contactsDeleted,
    submissions_anonymized: totalSubmissionsAnonymized,
  });
}

async function anonymizeSubmissionsByEmail(db: D1Like, email: string): Promise<number> {
  const rows = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.email') = ?",
    )
    .bind(PLUGIN_ID, email)
    .all();

  const now = new Date().toISOString();
  let count = 0;

  for (const row of rows.results) {
    const data = JSON.parse(row.data as string) as Record<string, unknown>;

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

async function deleteDedupKeys(
  db: D1Like,
  kv: KVNamespace,
  email: string,
): Promise<void> {
  const rows = await db
    .prepare(
      "SELECT DISTINCT json_extract(data, '$.slug') AS slug FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.email') = ?",
    )
    .bind(PLUGIN_ID, email)
    .all();

  for (const row of rows.results) {
    const slug = row.slug as string | null;
    if (!slug) continue;

    const data = new TextEncoder().encode(`${email}:${slug}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    try {
      await kv.delete(`dedup:${hash}`);
    } catch {
      // Best-effort
    }
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
