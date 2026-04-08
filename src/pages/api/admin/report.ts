/**
 * Dashboard report endpoints.
 *
 * GET  /api/admin/report?preview=1  — returns the HTML email for preview
 * POST /api/admin/report             — sends the dashboard report via Resend
 *
 * Both require Bearer auth.
 *
 * POST body (optional):
 *   { "to": "team@example.com", "campaign_id": "..." }
 *
 * If `to` is omitted, reads REPORT_EMAIL from env.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  resolveAuthCompat,
  type TenancyD1,
  type TenancyKV,
} from "../../../lib/tenancy.ts";
import { generateReportEmail, type DashboardPayload } from "../../../lib/email-report.ts";

const PLUGIN_ID = "action-pages";

/* ------------------------------------------------------------------ */
/*  Fetch dashboard data (reuse the same logic as dashboard.ts)        */
/* ------------------------------------------------------------------ */

async function fetchDashboardPayload(
  origin: string,
  authHeader: string,
  campaignId?: string,
): Promise<DashboardPayload> {
  const url = new URL("/api/admin/dashboard", origin);
  if (campaignId) url.searchParams.set("campaign_id", campaignId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) {
    throw new Error(`Dashboard API returned ${res.status}`);
  }
  return res.json() as Promise<DashboardPayload>;
}

/* ------------------------------------------------------------------ */
/*  GET — preview                                                      */
/* ------------------------------------------------------------------ */

export const GET: APIRoute = async ({ url, request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });

  const authHeader = request.headers.get("Authorization");
  const auth = await resolveAuthCompat(db, kv, authHeader, mcpToken);
  if (!auth) return json(401, { error: "Unauthorized" });

  const campaignId = url.searchParams.get("campaign_id") ?? undefined;

  try {
    const data = await fetchDashboardPayload(url.origin, authHeader!, campaignId);
    const dashboardUrl = `${url.origin}/admin/action-pages`;
    const { subject, html } = generateReportEmail(data, { dashboardUrl });

    // Return HTML for preview
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Report-Subject": subject,
      },
    });
  } catch (err) {
    console.error("[report] preview failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Failed to generate preview" });
  }
};

/* ------------------------------------------------------------------ */
/*  POST — send                                                        */
/* ------------------------------------------------------------------ */

export const POST: APIRoute = async ({ url, request }) => {
  const e = env as Record<string, unknown>;
  const db = e.DB as TenancyD1 | undefined;
  const kv = e.CACHE as TenancyKV | undefined;
  const mcpToken = e.MCP_ADMIN_TOKEN as string | undefined;
  const resendKey = e.RESEND_API_KEY as string | undefined;
  const defaultEmail = e.REPORT_EMAIL as string | undefined;

  if (!db) return json(503, { error: "Storage not available" });
  if (!resendKey) return json(503, { error: "Email service not configured (RESEND_API_KEY)" });

  const authHeader = request.headers.get("Authorization");
  const auth = await resolveAuthCompat(db, kv, authHeader, mcpToken);
  if (!auth) return json(401, { error: "Unauthorized" });

  // Parse body
  let to: string | undefined;
  let campaignId: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    to = (body.to as string) || undefined;
    campaignId = (body.campaign_id as string) || undefined;
  } catch {
    // No body or invalid JSON — use defaults
  }

  const recipient = to || defaultEmail;
  if (!recipient || !recipient.includes("@")) {
    return json(400, { error: "No recipient. Provide 'to' in body or set REPORT_EMAIL." });
  }

  try {
    const data = await fetchDashboardPayload(url.origin, authHeader!, campaignId);
    const dashboardUrl = `${url.origin}/admin/action-pages`;
    const { subject, html, text } = generateReportEmail(data, { dashboardUrl });

    // Send via Resend
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Campaign Reports <reports@adpena.com>",
        to: [recipient],
        subject,
        html,
        text,
      }),
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error("[report] Resend error:", sendRes.status, errBody.slice(0, 200));
      return json(502, { error: `Email send failed (${sendRes.status})` });
    }

    const result = await sendRes.json() as Record<string, unknown>;
    return json(200, { sent: true, to: recipient, id: result.id });
  } catch (err) {
    console.error("[report] send failed:", err instanceof Error ? err.message : "unknown");
    return json(500, { error: "Failed to send report" });
  }
};

/* ------------------------------------------------------------------ */
/*  Response helper                                                    */
/* ------------------------------------------------------------------ */

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
