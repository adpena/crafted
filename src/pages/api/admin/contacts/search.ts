/**
 * Cross-campaign contact search.
 *
 * POST /api/admin/contacts/search
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Content-Type: application/json
 *
 * Queries the contacts collection in D1 and filters by action types,
 * campaigns, tags, geography, and activity thresholds. Designed for
 * agencies managing multiple campaigns who need to build targeted
 * supporter lists across all their pages.
 *
 * All queries are parameterized. No PII is logged.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { ContactsD1 } from "../../../../lib/contacts.ts";
import { runContactSearch, type SearchFilters } from "../../../../lib/contact-search.ts";
import {
  resolveAuthCompat,
  getPageSlugsForCampaigns,
  type TenancyD1,
  type TenancyKV,
} from "../../../../lib/tenancy.ts";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

interface SearchBody {
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export const POST: APIRoute = async ({ request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as ContactsD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  const auth = await resolveAuthCompat(db as TenancyD1, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  let body: SearchBody;
  try {
    body = (await request.json()) as SearchBody;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const filters = body.filters ?? {};
  const limit = Math.min(Math.max(1, body.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(0, body.offset ?? 0);

  // Campaign-level: scope search to only this campaign's page slugs
  if (auth.level === "campaign" && auth.campaignId) {
    const campaignSlugs = await getPageSlugsForCampaigns(db as TenancyD1, [auth.campaignId]);
    if (campaignSlugs.length === 0) {
      return json(200, { data: [], pagination: { total: 0, limit, offset, has_more: false } });
    }
    // Override campaigns filter to only include this campaign's pages
    filters.campaigns = campaignSlugs;
  }

  const { data, total } = await runContactSearch(db, filters, limit, offset);

  return json(200, {
    data,
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + data.length < total,
    },
  });
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
