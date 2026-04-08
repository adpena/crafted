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
import { verifyBearer, sha256Hex } from "../../../lib/auth.ts";
import {
  getAttributionForPage,
  getAttributionForContact,
} from "../../../lib/attribution.ts";

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
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const db = (env as Record<string, unknown>).DB as D1Like | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

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
