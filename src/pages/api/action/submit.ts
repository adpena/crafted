/**
 * Action page form submission endpoint.
 *
 * Full pipeline:
 * 1. Parse + validate input
 * 2. Rate limit (KV-based, per IP)
 * 3. Turnstile verification (if configured)
 * 4. Geo filter (whitelist/blacklist per page)
 * 5. Email deduplication (same email can't sign twice per page)
 * 6. Store in D1
 * 7. Async post-submit pipeline (KV cache, email, tracking, webhooks)
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { checkRateLimit } from "../../../lib/rate-limit.ts";
import { checkGeoFilter, type GeoFilterConfig } from "../../../lib/geo-filter.ts";
import { checkDedup } from "../../../lib/dedup.ts";
import { runPostSubmitPipeline } from "../../../lib/post-submit.ts";
import { SLUG_RE } from "../../../lib/slug.ts";
// Validation logic also extracted to src/lib/validate-submission.ts for
// independent testing. This file keeps its own inline copies to avoid a
// multi-file refactor; both are kept in sync.
import { incrementWindow, detectSpike, isAlreadyNotified, markNotified } from "../../../lib/spike-detector.ts";
import { notifyAll as dispatch, type NotifyEnv } from "@adpena/notifications";

const PLUGIN_ID = "action-pages";
const ALLOWED_TYPES = new Set([
  "donation_click",
  "petition_sign",
  "gotv_pledge",
  "signup",
  "letter_sent",
  "event_rsvp",
  "call_made",
  "step_form",
]);

type Env = Record<string, unknown>;

export const POST: APIRoute = async (context) => {
  const { request } = context;
  const e = env as Env;
  const kv = e.CACHE as KV | undefined;
  const db = e.DB as D1;

  // --- 0a. Content-Type check (CSRF prevention — forces CORS preflight) ---
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return error(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }

  // --- 0b. Payload size guard (16 KB max) — enforced by reading bytes, not trusting header ---
  const MAX_BYTES = 16_384;
  const rawText = await request.text();
  if (rawText.length > MAX_BYTES) {
    return error(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 16 KB limit.");
  }

  // --- 1. Parse input ---
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return error(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const type = body.type as string;
  if (!type || !ALLOWED_TYPES.has(type)) {
    return error(400, "INVALID_TYPE", `Unknown type: ${String(type).slice(0, 32)}`);
  }

  const slug = String(body.page_id ?? body.pageId ?? "");
  if (!slug || !SLUG_RE.test(slug)) {
    return error(400, "INVALID_SLUG", "page_id must be lowercase alphanumeric with hyphens");
  }

  const rawData = (body.data ?? {}) as Record<string, unknown>;
  // Allowlist data fields — only store known keys, never arbitrary client payloads
  const ALLOWED_DATA_KEYS = new Set([
    "first_name", "last_name", "email", "zip", "phone", "comment", "amount",
    // Letter action
    "letter_subject", "letter_body", "rep_names",
    // Event RSVP
    "guest_count", "notes",
    // Call action
    "calls_completed",
    // Click attribution
    "fbclid", "gclid", "ttclid", "twclid", "li_fat_id", "rdt_cid", "scid", "msclkid",
    "fbc", "fbp", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  ]);
  // Field-specific length caps (some fields like letter_body need to be larger)
  const FIELD_MAX: Record<string, number> = {
    letter_body: 5000,
    letter_subject: 200,
    rep_names: 500,
    comment: 1000,
    notes: 500,
  };
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawData)) {
    if (ALLOWED_DATA_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      const maxLen = FIELD_MAX[k] ?? 1000;
      data[k] = typeof v === "string" ? v.slice(0, maxLen) : v;
    }
  }
  const email = typeof data.email === "string" ? (data.email as string).trim() : undefined;
  const firstName = typeof data.first_name === "string" ? (data.first_name as string).trim() : undefined;
  const lastName = typeof data.last_name === "string" ? (data.last_name as string).trim() : undefined;
  const zip = typeof data.zip === "string" ? (data.zip as string).trim() : undefined;
  const phone = typeof data.phone === "string" ? (data.phone as string).trim() : undefined;

  // --- 2. Rate limit ---
  if (kv) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const rl = await checkRateLimit(kv, ip);
    if (!rl.allowed) {
      return error(429, "RATE_LIMITED", "Too many submissions. Please try again later.", {
        "Retry-After": String(rl.retryAfter ?? 60),
      });
    }
  }

  // --- 3. Turnstile (if client sends a token, verify it) ---
  // Turnstile is opt-in per page: if a page has turnstile_site_key configured,
  // the client-side form will include a turnstile_token. We verify any token
  // that's provided, but don't require one when no site key is configured.
  // This lets demo pages work without Turnstile while production pages enforce it.
  const turnstileSecret = e.TURNSTILE_SECRET as string | undefined;
  const turnstileToken = body.turnstile_token as string | undefined;
  if (turnstileSecret && turnstileToken) {
    const verified = await verifyTurnstile(
      turnstileSecret,
      turnstileToken,
      request.headers.get("cf-connecting-ip") ?? "",
    );
    if (!verified) {
      return error(403, "TURNSTILE_FAILED", "Verification failed. Please try again.");
    }
  }

  // --- 4. Geo filter ---
  const country = request.headers.get("cf-ipcountry");
  const { geoConfig: pageGeoConfig, pageTitle } = await getPageMetadata(db, slug);
  const geo = checkGeoFilter(country, pageGeoConfig);
  if (!geo.allowed) {
    return error(403, "GEO_BLOCKED", "Submissions are not accepted from your location.");
  }

  // --- 5. Dedup ---
  if (kv && email) {
    const dedup = await checkDedup(kv, email, slug);
    if (dedup.duplicate) {
      // Return success to avoid leaking info about existing signups
      return ok({ ok: true, id: "duplicate", deduplicated: true });
    }
  }

  // --- 6. Store in D1 ---
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const submission = {
    page_id: slug,
    campaign_id: body.campaign_id ?? null,
    type,
    data,
    visitor_id: body.visitor_id ?? body.visitorId ?? null,
    variant: body.variant ?? null,
    country: geo.country,
    created_at: now,
  };

  try {
    await db.prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, PLUGIN_ID, "submissions", JSON.stringify(submission), now, now).run();
  } catch (err) {
    // Log only error name/message — never the full object (may contain PII from constraint violations)
    console.error("[submit] D1 write failed:", err instanceof Error ? err.message : "unknown");
    return error(500, "INTERNAL", "Failed to save submission");
  }

  // Extract optional event platform IDs (only applicable for event_rsvp submissions)
  const eventIds = extractEventIds(body.event_ids);

  // --- 6b. Spike detection (KV window increment + check) ---
  let spikePromise: Promise<void> | undefined;
  if (kv) {
    spikePromise = (async () => {
      try {
        await incrementWindow(kv, slug);
        const spike = await detectSpike(kv, slug);
        if (spike.spiking) {
          const alreadySent = await isAlreadyNotified(kv, slug);
          if (!alreadySent) {
            await markNotified(kv, slug);
            const notifyEnv = e as unknown as NotifyEnv;
            await dispatch(notifyEnv, {
              subject: `${pageTitle ?? slug} is spiking`,
              body: [
                `${spike.currentRate} submissions in the last 15 min (${spike.multiplier}x normal)`,
                `Baseline: ${spike.baselineRate}/15min`,
                `Page: https://adpena.com/action/${slug}`,
                `Stats: https://adpena.com/api/admin/attribution?slug=${slug}`,
              ].join("\n"),
            });
            console.info(`[spike] ${slug}: ${spike.currentRate} submissions (${spike.multiplier}x baseline)`);
          }
        }
      } catch (err) {
        console.error("[spike] detection/notification failed:", err instanceof Error ? err.message : "unknown");
      }
    })();
  }

  // --- 7. Async post-submit pipeline (non-blocking) ---
  // Use waitUntil if available (Cloudflare Workers), else fire-and-forget
  const pipelinePromise = runPostSubmitPipeline({
    kv,
    db,
    submission: {
      type: type as "petition_sign" | "gotv_pledge" | "signup" | "donation_click" | "letter_sent" | "event_rsvp" | "call_made" | "step_form",
      slug,
      email,
      firstName,
      lastName,
      zip,
      phone,
      eventIds,
      pageTitle,
      pageUrl: request.headers.get("referer") ?? undefined,
    },
    request: {
      clientIp: request.headers.get("cf-connecting-ip") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
    attribution: extractAttribution(data),
    env: {
      RESEND_API_KEY: e.RESEND_API_KEY as string | undefined,
      RESEND_FROM_EMAIL: e.RESEND_FROM_EMAIL as string | undefined,
      META_PIXEL_ID: e.META_PIXEL_ID as string | undefined,
      META_ACCESS_TOKEN: e.META_ACCESS_TOKEN as string | undefined,
      GOOGLE_CONVERSION_ID: e.GOOGLE_CONVERSION_ID as string | undefined,
      GOOGLE_CONVERSION_LABEL: e.GOOGLE_CONVERSION_LABEL as string | undefined,
      // Campaign platform integrations
      ACTION_NETWORK_API_KEY: e.ACTION_NETWORK_API_KEY as string | undefined,
      MAILCHIMP_API_KEY: e.MAILCHIMP_API_KEY as string | undefined,
      MAILCHIMP_LIST_ID: e.MAILCHIMP_LIST_ID as string | undefined,
      MAILCHIMP_DC: e.MAILCHIMP_DC as string | undefined,
      NATIONBUILDER_NATION_SLUG: e.NATIONBUILDER_NATION_SLUG as string | undefined,
      NATIONBUILDER_API_TOKEN: e.NATIONBUILDER_API_TOKEN as string | undefined,
      EVERYACTION_API_KEY: e.EVERYACTION_API_KEY as string | undefined,
      EVERYACTION_APP_NAME: e.EVERYACTION_APP_NAME as string | undefined,
      MOBILIZE_API_TOKEN: e.MOBILIZE_API_TOKEN as string | undefined,
      MOBILIZE_ORGANIZATION_ID: e.MOBILIZE_ORGANIZATION_ID as string | undefined,
      MOBILIZE_EVENT_ID: e.MOBILIZE_EVENT_ID as string | undefined,
      MOBILIZE_TIMESLOT_ID: e.MOBILIZE_TIMESLOT_ID as string | undefined,
      MOBILIZE_ACTIVIST_CODE: e.MOBILIZE_ACTIVIST_CODE as string | undefined,
      EVENTBRITE_API_TOKEN: e.EVENTBRITE_API_TOKEN as string | undefined,
      EVENTBRITE_ORGANIZATION_ID: e.EVENTBRITE_ORGANIZATION_ID as string | undefined,
      FACEBOOK_ACCESS_TOKEN: e.FACEBOOK_ACCESS_TOKEN as string | undefined,
      SENDGRID_API_KEY: e.SENDGRID_API_KEY as string | undefined,
      SENDGRID_LIST_ID: e.SENDGRID_LIST_ID as string | undefined,
      CONSTANT_CONTACT_API_KEY: e.CONSTANT_CONTACT_API_KEY as string | undefined,
      CONSTANT_CONTACT_LIST_ID: e.CONSTANT_CONTACT_LIST_ID as string | undefined,
      NGPVAN_API_KEY: e.NGPVAN_API_KEY as string | undefined,
      NGPVAN_APP_NAME: e.NGPVAN_APP_NAME as string | undefined,
      NGPVAN_ACTIVIST_CODE_ID: e.NGPVAN_ACTIVIST_CODE_ID as string | undefined,
      HUSTLE_API_TOKEN: e.HUSTLE_API_TOKEN as string | undefined,
      HUSTLE_ORGANIZATION_ID: e.HUSTLE_ORGANIZATION_ID as string | undefined,
      HUSTLE_GROUP_ID: e.HUSTLE_GROUP_ID as string | undefined,
      SALSA_API_TOKEN: e.SALSA_API_TOKEN as string | undefined,
      SALSA_HOST: e.SALSA_HOST as string | undefined,
      RESEND_DAILY_LIMIT: e.RESEND_DAILY_LIMIT as string | undefined,
    },
  });

  // Astro v6 on Cloudflare: execution context is at context.locals.cfContext
  // (Astro v5 used context.locals.runtime.ctx — removed in v6)
  const cfContext = (context.locals as Record<string, unknown>)?.cfContext as
    | { waitUntil?: (p: Promise<unknown>) => void }
    | undefined;
  if (typeof cfContext?.waitUntil === "function") {
    cfContext.waitUntil(pipelinePromise);
    if (spikePromise) cfContext.waitUntil(spikePromise);
  } else {
    // OBSERVABLE: if this fires in production, waitUntil is not available and
    // the post-submit pipeline (emails, integrations, contacts, tracking) runs
    // detached. The Worker may terminate before completion, silently dropping tasks.
    // Check Cloudflare dashboard logs if you see this message.
    console.warn("[submit] cfContext.waitUntil unavailable — pipeline running detached (tasks may be dropped)");
  }

  return ok({ ok: true, id });
};

// --- Helpers ---

async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5_000),
    });
    const json = await res.json() as { success: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

async function getPageMetadata(
  db: D1,
  slug: string,
): Promise<{ geoConfig: GeoFilterConfig | undefined; pageTitle: string | undefined }> {
  try {
    const row = await db.prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'action_pages' AND json_extract(data, '$.slug') = ? LIMIT 1"
    ).bind(PLUGIN_ID, slug).first();
    if (!row) return { geoConfig: undefined, pageTitle: undefined };
    const pageData = JSON.parse(row.data as string);
    const geoConfig = pageData.action_props?.geo_filter ?? pageData.geo_filter ?? undefined;
    const pageTitle = pageData.template_props?.headline ?? pageData.template_props?.eyebrow ?? undefined;
    return { geoConfig, pageTitle };
  } catch {
    return { geoConfig: undefined, pageTitle: undefined };
  }
}

/**
 * Extract and validate external event platform IDs.
 * Only accepts strings of reasonable length, rejects anything else.
 */
function extractEventIds(raw: unknown): { mobilize?: string; eventbrite?: string; facebook?: string } | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const result: { mobilize?: string; eventbrite?: string; facebook?: string } = {};
  const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  for (const key of ["mobilize", "eventbrite", "facebook"] as const) {
    const v = obj[key];
    if (typeof v === "string" && ID_RE.test(v)) {
      result[key] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function extractAttribution(data: Record<string, unknown>): Record<string, string> | undefined {
  const keys = ["fbclid", "gclid", "ttclid", "twclid", "fbc", "fbp", "msclkid"];
  const result: Record<string, string> = {};
  let found = false;
  for (const key of keys) {
    if (typeof data[key] === "string") {
      result[key] = data[key] as string;
      found = true;
    }
  }
  return found ? result : undefined;
}

function ok(data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function error(
  status: number, code: string, message: string, headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// Minimal type stubs for Cloudflare bindings
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface D1 {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}
