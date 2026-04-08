/**
 * Campaign management endpoints (firm-level only).
 *
 * POST   /api/admin/campaigns          — create a campaign (returns token ONCE)
 * GET    /api/admin/campaigns          — list all campaigns
 * GET    /api/admin/campaigns?id=X     — get campaign details
 * PATCH  /api/admin/campaigns?id=X     — update campaign (name, sharing, status)
 * DELETE /api/admin/campaigns?id=X     — archive a campaign
 *
 * Authorization: Bearer <firm admin token or MCP_ADMIN_TOKEN>
 * All endpoints require firm-level access.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  resolveAuthCompat,
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  type TenancyD1,
  type TenancyKV,
  type CampaignSharing,
} from "../../../lib/tenancy.ts";
import { logAudit, type AuditD1 } from "../../../lib/audit.ts";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAX_NAME_LEN = 200;

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth || auth.level !== "firm") {
    return json(auth ? 403 : 401, { error: auth ? "Firm-level access required" : "Unauthorized" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { name?: string; slug?: string };
  try {
    body = (await request.json()) as { name?: string; slug?: string };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const name = (body.name ?? "").trim().slice(0, MAX_NAME_LEN);
  if (!name) return json(400, { error: "name is required" });

  const slug = (body.slug ?? "").trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) {
    return json(400, { error: "slug must be lowercase alphanumeric with hyphens, 1-63 chars" });
  }

  // Check for duplicate slug
  const existing = await listCampaigns(db, auth.firmId);
  if (existing.some((c) => c.slug === slug)) {
    return json(409, { error: `Campaign slug "${slug}" already exists` });
  }

  try {
    const { campaign, token } = await createCampaign(db, kv, {
      name,
      slug,
      firmId: auth.firmId,
    });

    await logAudit(db as AuditD1, {
      action: "campaign_create",
      target: `campaign:${campaign.id}`,
      actor: "firm-admin",
      metadata: { name, slug },
      request,
    }).catch(() => {});

    // Return the token in plain text — this is the ONLY time it's visible
    return json(201, {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      api_token: token,
      created_at: campaign.created_at,
      message: "Save this API token now — it will not be shown again.",
    });
  } catch (err) {
    console.error("[campaigns] create failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Failed to create campaign" });
  }
};

export const GET: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth || auth.level !== "firm") {
    return json(auth ? 403 : 401, { error: auth ? "Firm-level access required" : "Unauthorized" });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const campaign = await getCampaign(db, kv, id);
    if (!campaign) return json(404, { error: "Campaign not found" });

    // Count pages and submissions for this campaign
    const [pageCount, subCount] = await Promise.all([
      countByJsonField(db, "action_pages", "campaign_id", id),
      countByCampaignPages(db, id),
    ]);

    return json(200, {
      ...campaign,
      api_token_hash: undefined, // Never expose the hash
      page_count: pageCount,
      submission_count: subCount,
    });
  }

  const campaigns = await listCampaigns(db, auth.firmId);

  // Enrich with page/submission counts
  const enriched = await Promise.all(
    campaigns.map(async (c) => {
      const [pageCount, subCount] = await Promise.all([
        countByJsonField(db, "action_pages", "campaign_id", c.id),
        countByCampaignPages(db, c.id),
      ]);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        status: c.status,
        sharing: c.sharing,
        created_at: c.created_at,
        page_count: pageCount,
        submission_count: subCount,
      };
    }),
  );

  return json(200, { data: enriched });
};

export const PATCH: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth || auth.level !== "firm") {
    return json(auth ? 403 : 401, { error: auth ? "Firm-level access required" : "Unauthorized" });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json(400, { error: "id query parameter is required" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: { name?: string; sharing?: CampaignSharing; status?: "active" | "archived" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  // Validate sharing if provided
  if (body.sharing) {
    if (typeof body.sharing.cross_campaign_contacts !== "boolean" ||
        typeof body.sharing.cross_campaign_attribution !== "boolean" ||
        typeof body.sharing.list_builder_access !== "boolean" ||
        !Array.isArray(body.sharing.visible_tags)) {
      return json(400, { error: "Invalid sharing configuration" });
    }
    // Sanitize visible_tags
    body.sharing.visible_tags = body.sharing.visible_tags
      .filter((t: unknown) => typeof t === "string")
      .map((t: string) => t.trim().slice(0, 50))
      .filter((t: string) => t.length > 0)
      .slice(0, 50);
  }

  if (body.status && !["active", "archived"].includes(body.status)) {
    return json(400, { error: "status must be 'active' or 'archived'" });
  }

  const updated = await updateCampaign(db, kv, id, {
    name: body.name?.trim().slice(0, MAX_NAME_LEN),
    sharing: body.sharing,
    status: body.status,
  });

  if (!updated) return json(404, { error: "Campaign not found" });

  await logAudit(db as AuditD1, {
    action: "campaign_update",
    target: `campaign:${id}`,
    actor: "firm-admin",
    metadata: { fields: Object.keys(body) },
    request,
  }).catch(() => {});

  return json(200, {
    ...updated,
    api_token_hash: undefined,
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth || auth.level !== "firm") {
    return json(auth ? 403 : 401, { error: auth ? "Firm-level access required" : "Unauthorized" });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json(400, { error: "id query parameter is required" });

  // Archive instead of delete — data preservation
  const updated = await updateCampaign(db, kv, id, { status: "archived" });
  if (!updated) return json(404, { error: "Campaign not found" });

  await logAudit(db as AuditD1, {
    action: "campaign_archive",
    target: `campaign:${id}`,
    actor: "firm-admin",
    request,
  }).catch(() => {});

  return json(200, { archived: true, id });
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PLUGIN_ID = "action-pages";

async function countByJsonField(
  db: TenancyD1,
  collection: string,
  field: string,
  value: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM _plugin_storage
       WHERE plugin_id = ? AND collection = ? AND json_extract(data, '$.${field}') = ?`,
    )
    .bind(PLUGIN_ID, collection, value)
    .first();
  return (row?.cnt as number) ?? 0;
}

async function countByCampaignPages(db: TenancyD1, campaignId: string): Promise<number> {
  // Get page slugs for this campaign, then count submissions for those pages
  const pageRows = await db
    .prepare(
      `SELECT data FROM _plugin_storage
       WHERE plugin_id = ? AND collection = 'action_pages'
       AND json_extract(data, '$.campaign_id') = ?`,
    )
    .bind(PLUGIN_ID, campaignId)
    .all();

  let total = 0;
  for (const row of pageRows.results) {
    try {
      const page = JSON.parse(row.data as string) as { slug?: string };
      if (!page.slug) continue;
      const countRow = await db
        .prepare(
          `SELECT COUNT(*) as cnt FROM _plugin_storage
           WHERE plugin_id = ? AND collection = 'submissions'
           AND json_extract(data, '$.page_id') = ?`,
        )
        .bind(PLUGIN_ID, page.slug)
        .first();
      total += (countRow?.cnt as number) ?? 0;
    } catch {
      // Skip
    }
  }
  return total;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
