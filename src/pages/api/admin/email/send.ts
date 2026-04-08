/**
 * Authenticated email blast endpoint.
 *
 * POST /api/admin/email/send
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Content-Type: application/json
 *
 * Body:
 *   {
 *     "subject":     "Hello {{first_name}}",
 *     "html":        "<p>...</p>",
 *     "text":        "...",
 *     "tag_filter":  "donor",        // optional
 *     "limit":       1000,            // optional, max 10000
 *     "dry_run":     false            // optional
 *   }
 *
 * Returns:
 *   { sent, failed, skipped, errors }
 *
 * dry_run=true returns the count of eligible recipients without sending.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Contact } from "../../../../lib/contacts-types.ts";
import type { KVNamespace } from "../../../../lib/cf-types.ts";
import {
  sendEmailBlast,
  MAX_RECIPIENTS_PER_BLAST,
  MAX_SUBJECT_LEN,
  MAX_BODY_BYTES,
} from "../../../../lib/email-blast.ts";
import { verifyBearer } from "../../../../lib/auth.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";
const MAX_PAYLOAD_BYTES = 500 * 1024; // 500KB
const MAX_TAG_LEN = 50;

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
      first(): Promise<Record<string, unknown> | null>;
    };
  };
}

interface BlastRequestBody {
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  tag_filter?: unknown;
  limit?: unknown;
  dry_run?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  // --- Auth ---
  const e = env as Record<string, unknown>;
  const token = e.MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  // --- Content-Type check ---
  const ctype = (request.headers.get("Content-Type") ?? "").toLowerCase();
  if (!ctype.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  // --- Payload size limit ---
  const contentLength = parseInt(request.headers.get("Content-Length") ?? "", 10);
  if (!isNaN(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
    return json(413, { error: "Payload too large" });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return json(400, { error: "Failed to read body" });
  }
  if (bodyText.length > MAX_PAYLOAD_BYTES) {
    return json(413, { error: "Payload too large" });
  }

  let body: BlastRequestBody;
  try {
    body = JSON.parse(bodyText) as BlastRequestBody;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!body || typeof body !== "object") {
    return json(400, { error: "Invalid body" });
  }

  // --- Validate fields ---
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";
  const text = typeof body.text === "string" ? body.text : "";

  if (!subject || subject.length > MAX_SUBJECT_LEN) {
    return json(400, { error: "Invalid subject" });
  }
  if (!html || !text) {
    return json(400, { error: "Missing html or text body" });
  }
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  const textBytes = new TextEncoder().encode(text).byteLength;
  if (htmlBytes > MAX_BODY_BYTES || textBytes > MAX_BODY_BYTES) {
    return json(400, { error: "Body exceeds maximum size" });
  }

  const tagFilter =
    typeof body.tag_filter === "string"
      ? body.tag_filter.slice(0, MAX_TAG_LEN).trim()
      : "";

  const rawLimit = typeof body.limit === "number" ? body.limit : parseInt(String(body.limit ?? ""), 10);
  const limit =
    isNaN(rawLimit) || rawLimit <= 0
      ? MAX_RECIPIENTS_PER_BLAST
      : Math.min(rawLimit, MAX_RECIPIENTS_PER_BLAST);

  const dryRun = body.dry_run === true;

  // --- Required env (Resend) ---
  const resendApiKey = e.RESEND_API_KEY as string | undefined;
  const fromEmail = e.RESEND_FROM_EMAIL as string | undefined;
  if (!dryRun && (!resendApiKey || !fromEmail)) {
    return json(503, { error: "Email service not configured" });
  }

  const unsubscribeBaseUrl = e.UNSUBSCRIBE_BASE_URL as string | undefined;
  const unsubscribeSecret = e.UNSUBSCRIBE_SECRET as string | undefined;

  const db = e.DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Database not configured" });
  }
  const kv = e.KV as KVNamespace | undefined;

  // --- Query contacts ---
  let recipients: Contact[];
  try {
    const { results } = await db
      .prepare(
        "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY json_extract(data, '$.last_action_at') DESC LIMIT ?",
      )
      .bind(PLUGIN_ID, COLLECTION, limit)
      .all();

    recipients = [];
    for (const r of results) {
      try {
        const c = JSON.parse(r.data as string) as Contact;
        if (tagFilter && !(Array.isArray(c.tags) && c.tags.includes(tagFilter))) {
          continue;
        }
        recipients.push(c);
      } catch {
        // skip corrupted row
      }
    }
  } catch (err) {
    console.error(
      "[admin/email/send] D1 query failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return json(500, { error: "Query failed" });
  }

  if (dryRun) {
    return json(200, {
      dry_run: true,
      eligible: recipients.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });
  }

  // --- Send ---
  try {
    const result = await sendEmailBlast({
      kv,
      resendApiKey: resendApiKey!,
      fromEmail: fromEmail!,
      recipients,
      subject,
      htmlBody: html,
      textBody: text,
      unsubscribeBaseUrl,
      unsubscribeSecret,
    });

    // Sanitize errors — sendEmailBlast already strips PII, but double-check
    // there are no '@' characters in any error string before returning.
    const safeErrors = result.errors.map((e) => e.replace(/[\w.+-]+@[\w.-]+/g, "[redacted]"));

    console.log(
      `[admin/email/send] sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
    );

    return json(200, {
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      errors: safeErrors,
    });
  } catch (err) {
    console.error(
      "[admin/email/send] blast failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return json(500, { error: "Send failed" });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
