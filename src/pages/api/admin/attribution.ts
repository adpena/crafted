/**
 * Attribution dashboard endpoints.
 *
 * GET /api/admin/attribution?slug=fund-public-schools
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Returns AttributionSummary for the given action page slug.
 *
 * GET /api/admin/attribution?contact=ada@example.com
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Returns the full attribution journey for a single contact.
 * Email is hashed server-side before querying.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sha256Hex } from "../../../lib/auth.ts";
import {
  getAttributionForPage,
  getAttributionForContact,
} from "../../../lib/attribution.ts";
import {
  resolveAuthCompat,
  getCampaignForPage,
  canAccess,
  type TenancyD1,
  type TenancyKV,
} from "../../../lib/tenancy.ts";

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const GET: APIRoute = async ({ url, request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as D1Like | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  const auth = await resolveAuthCompat(db as TenancyD1, kv, request.headers.get("Authorization"), mcpToken);
  if (!auth) {
    return json(401, { error: "Unauthorized" });
  }

  // Campaign-level: check cross_campaign_attribution permission
  // (they can always see their own pages' attribution)

  const slug = url.searchParams.get("slug");
  const contactEmail = url.searchParams.get("contact");

  // --- Contact attribution journey ---
  if (contactEmail) {
    const emailTrimmed = contactEmail.toLowerCase().trim();
    if (!emailTrimmed || !emailTrimmed.includes("@")) {
      return json(400, { error: "Invalid email" });
    }
    const emailHash = await sha256Hex(emailTrimmed);
    try {
      const events = await getAttributionForContact(db, emailHash);
      return json(200, { email_hash: emailHash, events });
    } catch (err) {
      console.error("[attribution] contact query failed:", err instanceof Error ? err.message : "unknown");
      return json(500, { error: "Query failed" });
    }
  }

  // --- Page attribution summary ---
  if (slug) {
    if (!SLUG_RE.test(slug)) {
      return json(400, { error: "Invalid slug" });
    }

    // Campaign-level: verify this page belongs to their campaign
    if (auth.level === "campaign" && auth.campaignId) {
      const pageCampaign = await getCampaignForPage(db as TenancyD1, slug);
      if (pageCampaign && !canAccess(auth, pageCampaign)) {
        return json(403, { error: "Access denied to this page's attribution" });
      }
    }

    try {
      const summary = await getAttributionForPage(db, slug);
      return json(200, summary);
    } catch (err) {
      console.error("[attribution] page query failed:", err instanceof Error ? err.message : "unknown");
      return json(500, { error: "Query failed" });
    }
  }

  return json(400, { error: "Provide ?slug= or ?contact= parameter" });
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
