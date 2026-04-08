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
import { verifyBearer } from "../../../../lib/auth.ts";
import type { ContactsD1 } from "../../../../lib/contacts.ts";
import { runContactSearch, type SearchFilters } from "../../../../lib/contact-search.ts";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

interface SearchBody {
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export const POST: APIRoute = async ({ request }) => {
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
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

  const db = (env as Record<string, unknown>).DB as ContactsD1 | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
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
