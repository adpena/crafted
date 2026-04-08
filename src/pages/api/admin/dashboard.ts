/**
 * Campaign ROI Dashboard API.
 *
 * GET /api/admin/dashboard              — firm-wide summary
 * GET /api/admin/dashboard?campaign_id=X — campaign-scoped
 * Authorization: Bearer <token>
 *
 * Returns submission trends, action type breakdown, per-page stats,
 * attribution sources, and revenue totals for the last 30 days.
 * Response is cached in KV for 5 minutes.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  resolveAuthCompat,
  canAccess,
  getVisibleCampaigns,
  getPageSlugsForCampaigns,
  type TenancyD1,
  type TenancyKV,
  type AuthContext,
} from "../../../lib/tenancy.ts";

const PLUGIN_ID = "action-pages";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DayBucket {
  date: string;
  submissions: number;
  raised: number;
}

interface PageStat {
  slug: string;
  title: string;
  submissions: number;
  raised: number;
  conversion: number;
}

interface SourceStat {
  submissions: number;
  raised: number;
  cost_per_action: number | null;
}

interface DashboardPayload {
  period: string;
  summary: {
    total_submissions: number;
    total_pages: number;
    total_donors: number;
    total_raised: number;
    conversion_rate: number;
    top_page: { slug: string; submissions: number } | null;
  };
  by_day: DayBucket[];
  by_action_type: Record<string, number>;
  by_page: PageStat[];
  attribution: Record<string, SourceStat>;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export const GET: APIRoute = async ({ url, request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const auth = await resolveAuthCompat(db, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) return json(401, { error: "Unauthorized" });

  const campaignId = url.searchParams.get("campaign_id") ?? undefined;

  // Campaign-level tokens can only see their own campaign
  if (auth.level === "campaign" && campaignId && auth.campaignId !== campaignId) {
    return json(403, { error: "Access denied" });
  }

  const effectiveCampaignId = auth.level === "campaign" ? auth.campaignId : campaignId;
  const cacheKey = `dashboard:${effectiveCampaignId || "firm"}`;

  // Check KV cache
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      try {
        return json(200, JSON.parse(cached));
      } catch { /* fall through */ }
    }
  }

  try {
    const payload = await buildDashboard(db, auth, effectiveCampaignId);

    // Cache for 5 minutes
    if (kv) {
      await kv.put(cacheKey, JSON.stringify(payload), { expirationTtl: 300 });
    }

    return json(200, payload);
  } catch (err) {
    console.error("[dashboard] query failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Query failed" });
  }
};

/* ------------------------------------------------------------------ */
/*  Dashboard builder                                                  */
/* ------------------------------------------------------------------ */

async function buildDashboard(
  db: TenancyD1,
  auth: AuthContext,
  campaignId?: string,
): Promise<DashboardPayload> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since = thirtyDaysAgo.toISOString();

  // Determine which slugs are visible
  let slugFilter: string[] | null = null;
  if (campaignId) {
    slugFilter = await getPageSlugsForCampaigns(db, [campaignId]);
  } else if (auth.level === "campaign" && auth.campaignId) {
    slugFilter = await getPageSlugsForCampaigns(db, [auth.campaignId]);
  }

  // --- Submissions by day ---
  const byDayRows = await querySubmissionsByDay(db, since, slugFilter);

  // --- Submissions by action type ---
  const byActionType = await querySubmissionsByActionType(db, since, slugFilter);

  // --- Per-page stats ---
  const byPage = await queryPerPageStats(db, since, slugFilter);

  // --- Attribution source breakdown ---
  const attribution = await queryAttributionSources(db, since, slugFilter);

  // --- Compute totals ---
  let totalSubmissions = 0;
  let totalRaised = 0;
  for (const day of byDayRows) {
    totalSubmissions += day.submissions;
    totalRaised += day.raised;
  }

  // Count unique donors from attribution events
  const totalDonors = await countDonors(db, since, slugFilter);

  // Find top page
  let topPage: { slug: string; submissions: number } | null = null;
  for (const p of byPage) {
    if (!topPage || p.submissions > topPage.submissions) {
      topPage = { slug: p.slug, submissions: p.submissions };
    }
  }

  const conversionRate = totalSubmissions > 0
    ? Math.round((totalDonors / totalSubmissions) * 1000) / 1000
    : 0;

  return {
    period: "last_30_days",
    summary: {
      total_submissions: totalSubmissions,
      total_pages: byPage.length,
      total_donors: totalDonors,
      total_raised: totalRaised,
      conversion_rate: conversionRate,
      top_page: topPage,
    },
    by_day: byDayRows,
    by_action_type: byActionType,
    by_page: byPage,
    attribution,
  };
}

/* ------------------------------------------------------------------ */
/*  SQL query helpers (D1 aggregation, not JS loops)                   */
/* ------------------------------------------------------------------ */

async function querySubmissionsByDay(
  db: TenancyD1,
  since: string,
  slugFilter: string[] | null,
): Promise<DayBucket[]> {
  // D1 stores data as JSON text — use json_extract for aggregation
  const slugClause = slugFilter
    ? `AND json_extract(data, '$.slug') IN (${slugFilter.map(() => "?").join(",")})`
    : "";

  const sql = `
    SELECT
      substr(created_at, 1, 10) AS date,
      COUNT(*) AS submissions,
      COALESCE(SUM(CAST(json_extract(data, '$.amount') AS REAL)), 0) AS raised
    FROM _plugin_storage
    WHERE plugin_id = ? AND collection = 'submissions'
      AND created_at >= ?
      ${slugClause}
    GROUP BY substr(created_at, 1, 10)
    ORDER BY date ASC
  `;

  const binds: unknown[] = [PLUGIN_ID, since];
  if (slugFilter) binds.push(...slugFilter);

  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map((r) => ({
    date: r.date as string,
    submissions: r.submissions as number,
    raised: Math.round((r.raised as number) * 100) / 100,
  }));
}

async function querySubmissionsByActionType(
  db: TenancyD1,
  since: string,
  slugFilter: string[] | null,
): Promise<Record<string, number>> {
  const slugClause = slugFilter
    ? `AND json_extract(data, '$.slug') IN (${slugFilter.map(() => "?").join(",")})`
    : "";

  const sql = `
    SELECT
      json_extract(data, '$.type') AS action_type,
      COUNT(*) AS cnt
    FROM _plugin_storage
    WHERE plugin_id = ? AND collection = 'submissions'
      AND created_at >= ?
      ${slugClause}
    GROUP BY json_extract(data, '$.type')
    ORDER BY cnt DESC
  `;

  const binds: unknown[] = [PLUGIN_ID, since];
  if (slugFilter) binds.push(...slugFilter);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const out: Record<string, number> = {};
  for (const r of results) {
    const key = (r.action_type as string) ?? "unknown";
    out[key] = r.cnt as number;
  }
  return out;
}

async function queryPerPageStats(
  db: TenancyD1,
  since: string,
  slugFilter: string[] | null,
): Promise<PageStat[]> {
  const slugClause = slugFilter
    ? `AND json_extract(data, '$.slug') IN (${slugFilter.map(() => "?").join(",")})`
    : "";

  const sql = `
    SELECT
      json_extract(data, '$.slug') AS slug,
      json_extract(data, '$.pageTitle') AS title,
      COUNT(*) AS submissions,
      COALESCE(SUM(CAST(json_extract(data, '$.amount') AS REAL)), 0) AS raised
    FROM _plugin_storage
    WHERE plugin_id = ? AND collection = 'submissions'
      AND created_at >= ?
      ${slugClause}
    GROUP BY json_extract(data, '$.slug')
    ORDER BY submissions DESC
  `;

  const binds: unknown[] = [PLUGIN_ID, since];
  if (slugFilter) binds.push(...slugFilter);

  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map((r) => {
    const subs = r.submissions as number;
    const raised = Math.round((r.raised as number) * 100) / 100;
    return {
      slug: (r.slug as string) ?? "unknown",
      title: (r.title as string) ?? (r.slug as string) ?? "Untitled",
      submissions: subs,
      raised,
      conversion: subs > 0 ? Math.round((raised / subs) * 100) / 100 : 0,
    };
  });
}

async function queryAttributionSources(
  db: TenancyD1,
  since: string,
  slugFilter: string[] | null,
): Promise<Record<string, SourceStat>> {
  const slugClause = slugFilter
    ? `AND json_extract(data, '$.slug') IN (${slugFilter.map(() => "?").join(",")})`
    : "";

  const sql = `
    SELECT
      COALESCE(json_extract(data, '$.source'), 'organic') AS source,
      COUNT(*) AS submissions,
      COALESCE(SUM(CAST(json_extract(data, '$.amount') AS REAL)), 0) AS raised
    FROM _plugin_storage
    WHERE plugin_id = ? AND collection = 'submissions'
      AND created_at >= ?
      ${slugClause}
    GROUP BY COALESCE(json_extract(data, '$.source'), 'organic')
    ORDER BY submissions DESC
  `;

  const binds: unknown[] = [PLUGIN_ID, since];
  if (slugFilter) binds.push(...slugFilter);

  const { results } = await db.prepare(sql).bind(...binds).all();
  const out: Record<string, SourceStat> = {};
  for (const r of results) {
    out[r.source as string] = {
      submissions: r.submissions as number,
      raised: Math.round((r.raised as number) * 100) / 100,
      cost_per_action: null,
    };
  }
  return out;
}

async function countDonors(
  db: TenancyD1,
  since: string,
  slugFilter: string[] | null,
): Promise<number> {
  const slugClause = slugFilter
    ? `AND json_extract(data, '$.slug') IN (${slugFilter.map(() => "?").join(",")})`
    : "";

  const sql = `
    SELECT COUNT(*) AS cnt
    FROM _plugin_storage
    WHERE plugin_id = ? AND collection = 'attribution_events'
      AND json_extract(data, '$.event_type') = 'donation'
      AND created_at >= ?
      ${slugClause}
  `;

  const binds: unknown[] = [PLUGIN_ID, since];
  if (slugFilter) binds.push(...slugFilter);

  const row = await db.prepare(sql).bind(...binds).first();
  return (row?.cnt as number) ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Response helper                                                    */
/* ------------------------------------------------------------------ */

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
