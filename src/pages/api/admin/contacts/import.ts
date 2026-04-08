/**
 * Authenticated CSV contact import.
 *
 * POST /api/admin/contacts/import
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Content-Type: multipart/form-data
 * Form field: "file" (CSV, max 5 MB, max 5000 rows per request)
 *
 * Headers:
 *   - Required: email
 *   - Optional: first_name, last_name, zip, tags (comma-separated)
 *
 * Response:
 *   {
 *     total_rows, imported, updated, skipped,
 *     errors: [{ row, error }]   // capped at 100
 *   }
 *
 * NEVER logs raw email addresses — only counts.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { upsertContact, sanitizeTag, MAX_TAGS_PER_CONTACT, type ContactsD1 } from "../../../../lib/contacts.ts";
import { logAudit, type AuditD1 } from "../../../../lib/audit.ts";
import { verifyBearer } from "../../../../lib/auth.ts";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
// Cap to 5,000 rows per import to stay within Worker CPU time limits.
// Each row triggers 1-2 D1 queries via upsertContact, so 5k rows ≈ 10k queries.
// For larger imports, callers should batch client-side across multiple requests.
const MAX_ROWS = 5_000;
const MAX_ERRORS = 100;
const BATCH_SIZE = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_HEADERS = ["email"] as const;
const OPTIONAL_HEADERS = ["first_name", "last_name", "zip", "tags"] as const;
const KNOWN_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);

interface ImportError {
  row: number;
  error: string;
}

interface ImportResult {
  total_rows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export const POST: APIRoute = async ({ request }) => {
  // Auth
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  // Content-Type
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json(415, { error: "Content-Type must be multipart/form-data" });
  }

  // Size guard
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_SIZE + 8192) {
    return json(413, { error: "File exceeds 5 MB limit" });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json(400, { error: "Invalid form data" });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return json(400, { error: "Missing 'file' field" });
  }

  if (file.size > MAX_SIZE) {
    return json(413, { error: "File exceeds 5 MB limit" });
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return json(400, { error: "Could not read file" });
  }

  // Parse CSV
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (err) {
    return json(400, { error: err instanceof Error ? err.message : "CSV parse failed" });
  }

  if (rows.length === 0) {
    return json(400, { error: "CSV is empty" });
  }

  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  const headerIdx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!;
    if (KNOWN_HEADERS.has(h)) headerIdx[h] = i;
  }

  for (const req of REQUIRED_HEADERS) {
    if (!(req in headerIdx)) {
      return json(400, { error: `Missing required header: ${req}` });
    }
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return json(413, { error: `Too many rows (max ${MAX_ROWS})` });
  }

  const db = (env as Record<string, unknown>).DB as ContactsD1 | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  const result: ImportResult = {
    total_rows: dataRows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const importStartedAt = new Date().toISOString();

  // Process in batches
  for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
    const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
    for (let i = 0; i < batch.length; i++) {
      const rowNum = batchStart + i + 2; // 1-indexed + header row
      const row = batch[i]!;

      // Skip empty rows
      if (row.length === 0 || (row.length === 1 && row[0]!.trim() === "")) {
        result.skipped++;
        continue;
      }

      const emailRaw = (row[headerIdx.email!] ?? "").trim();
      if (!emailRaw) {
        pushError(result, rowNum, "missing email");
        result.skipped++;
        continue;
      }
      if (emailRaw.length > 320 || !EMAIL_RE.test(emailRaw)) {
        pushError(result, rowNum, "invalid email format");
        result.skipped++;
        continue;
      }

      const firstName = sliceField(row, headerIdx.first_name, 100);
      const lastName = sliceField(row, headerIdx.last_name, 100);
      const zip = sliceField(row, headerIdx.zip, 10);

      // Tags: comma-separated, sanitized, capped
      let tags: string[] = [];
      if (headerIdx.tags !== undefined) {
        const raw = row[headerIdx.tags] ?? "";
        tags = raw
          .split(",")
          .map((t) => sanitizeTag(t))
          .filter((t): t is string => t !== null)
          .slice(0, MAX_TAGS_PER_CONTACT);
      }

      try {
        const upsertResult = await upsertContact(db, {
          email: emailRaw,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          zip: zip || undefined,
          slug: "csv-import",
          type: "csv_import",
          timestamp: importStartedAt,
        });

        // Apply tags by merging into the contact record (separate update,
        // since upsertContact does not handle tags).
        if (tags.length > 0) {
          await mergeTags(db, upsertResult.id, tags);
        }

        if (upsertResult.isNew) result.imported++;
        else result.updated++;
      } catch (err) {
        pushError(result, rowNum, err instanceof Error ? err.message.slice(0, 200) : "upsert failed");
        result.skipped++;
      }
    }
  }

  // Audit log — no PII, only counts
  if (db) {
    await logAudit(db as AuditD1, {
      action: "contacts_import",
      target: `csv:${file.name.slice(0, 100)}`,
      actor: "admin",
      metadata: {
        total_rows: result.total_rows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      request,
    }).catch(() => {});
  }

  console.log(
    `[contacts/import] total=${result.total_rows} imported=${result.imported} updated=${result.updated} skipped=${result.skipped}`,
  );

  return json(200, result);
};

function sliceField(row: string[], idx: number | undefined, maxLen: number): string {
  if (idx === undefined) return "";
  const v = (row[idx] ?? "").trim();
  return v.slice(0, maxLen);
}

function pushError(result: ImportResult, row: number, error: string): void {
  if (result.errors.length < MAX_ERRORS) {
    result.errors.push({ row, error });
  }
}

/**
 * Merge tags into an existing contact, deduped, capped at MAX_TAGS_PER_CONTACT.
 */
async function mergeTags(db: ContactsD1, id: string, newTags: string[]): Promise<void> {
  const existing = await db
    .prepare("SELECT data FROM _plugin_storage WHERE id = ? LIMIT 1")
    .bind(id)
    .first();
  if (!existing) return;
  let parsed: { tags?: string[] };
  try {
    parsed = JSON.parse(existing.data as string);
  } catch {
    return;
  }
  const current = Array.isArray(parsed.tags) ? parsed.tags : [];
  const merged = Array.from(new Set([...current, ...newTags])).slice(0, MAX_TAGS_PER_CONTACT);
  parsed.tags = merged;
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(parsed), now, id)
    .run();
}

/**
 * Minimal RFC4180-ish CSV parser.
 * Handles:
 *  - Quoted fields with commas
 *  - Escaped quotes ("")
 *  - CRLF and LF line endings
 *  - Empty lines (returned as empty rows; skipped by caller)
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = input.length;

  // Strip BOM
  if (len > 0 && input.charCodeAt(0) === 0xfeff) i = 1;

  while (i < len) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Treat \r\n or bare \r as a line terminator
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      if (i < len && input[i] === "\n") i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush last field/row if non-empty
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing fully-empty rows
  while (rows.length > 0 && rows[rows.length - 1]!.every((f) => f === "")) {
    rows.pop();
  }

  return rows;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
