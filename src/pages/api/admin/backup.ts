/**
 * Authenticated D1 backup endpoint.
 *
 * POST /api/admin/backup
 *   Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Triggers a full D1 dump (NDJSON, one row per line) and uploads it to
 * the R2 bucket bound as `BACKUPS`. Returns the resulting R2 key + stats.
 *
 * Intended to be called from a scheduled Cloudflare Cron Trigger (or ad-hoc
 * by an operator). Idempotent: each invocation produces a new timestamped
 * object in R2; old backups are not deleted here.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";
import { runBackup, type BackupD1, type BackupR2 } from "../../../lib/backup.ts";
import { logAudit } from "../../../lib/audit.ts";

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;

  const token = e.MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const db = e.DB as BackupD1 | undefined;
  if (!db) return json(503, { error: "D1 not bound" });

  const r2 = e.BACKUPS as BackupR2 | undefined;
  if (!r2) {
    return json(503, {
      error:
        "R2 backup bucket not bound. Add an R2 binding named BACKUPS in wrangler.jsonc.",
    });
  }

  try {
    const result = await runBackup(db, r2);

    if (db) {
      await logAudit(db as Parameters<typeof logAudit>[0], {
        action: "d1_backup",
        target: result.key,
        actor: "admin",
        metadata: {
          rows: result.rows,
          bytes: result.bytes,
          table_count: Object.keys(result.tables).length,
        },
        request,
      }).catch(() => {});
    }

    return json(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed";
    console.error("[admin/backup] error:", message);
    return json(500, { error: message });
  }
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
