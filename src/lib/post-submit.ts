/**
 * Post-submit pipeline — orchestrates all async tasks after a form submission.
 *
 * This is the "everything that happens after we store the submission" layer.
 * All tasks are fire-and-forget (non-blocking to the user response).
 *
 * Pipeline:
 * 1. KV count cache increment
 * 2. Confirmation email via Resend
 * 3. Conversion tracking (Meta CAPI, Google Ads)
 * 4. Campaign platform integrations (Action Network, Mailchimp, NationBuilder,
 *    EveryAction, Mobilize)
 * 5. Contact upsert (D1 dedup)
 *
 * Each step is independent — if one fails, the others still run.
 * Errors are logged but never surface to the user.
 */

import type { KVNamespace } from "./cf-types.ts";
import { sha256Hex } from "./auth.ts";
import { renderConfirmationEmail, type ActionType } from "./email-templates.ts";
import { fireConversions, type ConversionData, type TrackingConfig } from "./conversion-tracking.ts";
import { upsertContact, type ContactsD1 } from "./contacts.ts";
import {
  dispatchIntegrations,
  type IntegrationEnv,
  type IntegrationsSummary,
} from "./integrations/index.ts";

export interface PostSubmitContext {
  /** Cloudflare KV binding */
  kv?: KVNamespace;
  /** Cloudflare D1 binding (used for contacts dedup) */
  db?: ContactsD1;
  /** Submission details */
  submission: {
    type: ActionType;
    slug: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    zip?: string;
    phone?: string;
    pageTitle?: string;
    pageUrl?: string;
    /** External event platform IDs (event_rsvp only) */
    eventIds?: { mobilize?: string; eventbrite?: string; facebook?: string };
    /** Per-page VAN activist code (overrides global NGPVAN_ACTIVIST_CODE_ID) */
    vanActivistCodeId?: string;
    /** Per-page VAN activist code array (preferred over single). */
    vanActivistCodeIds?: Array<string | number>;
    /** Per-page VAN survey responses to differentiate action types. */
    vanSurveyResponses?: Array<{ surveyQuestionId: number; surveyResponseId: number }>;
    /** Per-page VAN source code id for attribution. */
    vanSourceCodeId?: number;
  };
  /** Request context for tracking */
  request?: {
    clientIp?: string;
    userAgent?: string;
  };
  /** Click attribution data */
  attribution?: Record<string, string>;
  /** Environment variables */
  env: {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    META_PIXEL_ID?: string;
    META_ACCESS_TOKEN?: string;
    GOOGLE_CONVERSION_ID?: string;
    GOOGLE_CONVERSION_LABEL?: string;
    // Campaign platform integrations
    ACTION_NETWORK_API_KEY?: string;
    MAILCHIMP_API_KEY?: string;
    MAILCHIMP_LIST_ID?: string;
    MAILCHIMP_DC?: string;
    NATIONBUILDER_NATION_SLUG?: string;
    NATIONBUILDER_API_TOKEN?: string;
    EVERYACTION_API_KEY?: string;
    EVERYACTION_APP_NAME?: string;
    MOBILIZE_API_TOKEN?: string;
    MOBILIZE_ORGANIZATION_ID?: string;
    MOBILIZE_EVENT_ID?: string;
    MOBILIZE_TIMESLOT_ID?: string;
    MOBILIZE_ACTIVIST_CODE?: string;
    EVENTBRITE_API_TOKEN?: string;
    EVENTBRITE_ORGANIZATION_ID?: string;
    FACEBOOK_ACCESS_TOKEN?: string;
    SENDGRID_API_KEY?: string;
    SENDGRID_LIST_ID?: string;
    CONSTANT_CONTACT_API_KEY?: string;
    CONSTANT_CONTACT_LIST_ID?: string;
    NGPVAN_API_KEY?: string;
    NGPVAN_APP_NAME?: string;
    NGPVAN_ACTIVIST_CODE_ID?: string;
    NGPVAN_ACTIVIST_CODES_JSON?: string;
    HUSTLE_API_TOKEN?: string;
    HUSTLE_ORGANIZATION_ID?: string;
    HUSTLE_GROUP_ID?: string;
    SALSA_API_TOKEN?: string;
    SALSA_HOST?: string;
    /** Max emails per day via Resend (default 500) */
    RESEND_DAILY_LIMIT?: string;
  };
}

export interface PostSubmitResult {
  kvCache: boolean;
  email: boolean;
  conversions: { meta?: boolean; google?: boolean };
  contact: boolean;
  integrations: IntegrationsSummary;
}

/**
 * Run the full post-submit pipeline.
 * Call this inside waitUntil() to not block the response.
 */
export async function runPostSubmitPipeline(
  ctx: PostSubmitContext,
): Promise<PostSubmitResult> {
  const result: PostSubmitResult = {
    kvCache: false,
    email: false,
    conversions: {},
    contact: false,
    integrations: {},
  };

  // Run all tasks in parallel
  const tasks: Promise<void>[] = [];

  // 1. KV count cache
  tasks.push(
    incrementKVCount(ctx.kv, ctx.submission.slug)
      .then(() => { result.kvCache = true; })
      .catch((err) => console.error("[post-submit] KV count error:", err instanceof Error ? err.message : "unknown")),
  );

  // 2. Confirmation email
  if (ctx.submission.email && ctx.env.RESEND_API_KEY && ctx.env.RESEND_FROM_EMAIL) {
    tasks.push(
      sendConfirmationEmail(ctx)
        .then(() => { result.email = true; })
        .catch((err) => console.error("[post-submit] email error:", err instanceof Error ? err.message : "unknown")),
    );
  }

  // 3. Conversion tracking
  const trackingConfig = buildTrackingConfig(ctx.env);
  if (trackingConfig.meta || trackingConfig.google) {
    tasks.push(
      fireConversions(
        {
          type: ctx.submission.type,
          email: ctx.submission.email,
          clientIp: ctx.request?.clientIp,
          userAgent: ctx.request?.userAgent,
          attribution: ctx.attribution as ConversionData["attribution"],
          sourceUrl: sanitizeUrl(ctx.submission.pageUrl),
        },
        trackingConfig,
      )
        .then((r) => { result.conversions = r; })
        .catch((err) => console.error("[post-submit] conversion error:", err instanceof Error ? err.message : "unknown")),
    );
  }

  // 4. Campaign platform integrations (Action Network, Mailchimp, etc.)
  tasks.push(
    dispatchIntegrations({
      submission: {
        type: ctx.submission.type,
        slug: ctx.submission.slug,
        email: ctx.submission.email,
        firstName: ctx.submission.firstName,
        lastName: ctx.submission.lastName,
        postalCode: ctx.submission.zip,
        phone: ctx.submission.phone,
        pageTitle: ctx.submission.pageTitle,
        pageUrl: ctx.submission.pageUrl,
        eventIds: ctx.submission.eventIds,
        activist_code_id: ctx.submission.vanActivistCodeId,
        activist_code_ids: ctx.submission.vanActivistCodeIds,
        survey_responses: ctx.submission.vanSurveyResponses,
        van_source_code_id: ctx.submission.vanSourceCodeId,
      },
      env: ctx.env as IntegrationEnv,
      kv: ctx.kv,
    })
      .then((summary) => { result.integrations = summary; })
      .catch((err) => console.error("[post-submit] integrations error:", err instanceof Error ? err.message : "unknown")),
  );

  // 5. Contact upsert (dedup by email)
  if (ctx.db && ctx.submission.email) {
    tasks.push(
      upsertContact(ctx.db, {
        email: ctx.submission.email,
        first_name: ctx.submission.firstName,
        last_name: ctx.submission.lastName,
        zip: ctx.submission.zip,
        slug: ctx.submission.slug,
        type: ctx.submission.type,
        timestamp: new Date().toISOString(),
      })
        .then(() => { result.contact = true; })
        .catch((err) => console.error("[post-submit] contact upsert error:", err instanceof Error ? err.message : "unknown")),
    );
  }

  await Promise.allSettled(tasks);

  const integrationKeys = Object.keys(result.integrations) as (keyof IntegrationsSummary)[];
  const integrationStr = integrationKeys.length
    ? integrationKeys.map((k) => `${k}=${result.integrations[k]}`).join(" ")
    : "integrations=n/a";

  console.info(
    `[post-submit] ${ctx.submission.slug}/${ctx.submission.type}: ` +
    `kv=${result.kvCache} email=${result.email} ` +
    `meta=${result.conversions.meta ?? "n/a"} google=${result.conversions.google ?? "n/a"} ` +
    `contact=${result.contact} ${integrationStr}`,
  );

  return result;
}

// --- Internal helpers ---

/** Validate URL is safe https/http — rejects javascript:, data:, etc. */
function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Increment the KV count cache for a slug.
 *
 * NOTE: KV read-modify-write is not atomic — concurrent submissions may
 * undercount by 1 per race. This is acceptable because:
 * 1. KV count is advisory (for progress bar display)
 * 2. The count endpoint falls back to D1 (authoritative) on cache miss
 * 3. Durable Objects (atomic counters) require Workers Paid ($5/mo)
 *
 * The displayed count may lag the true D1 count under burst load but
 * will self-correct on the next non-racing submission.
 */
async function incrementKVCount(
  kv: KVNamespace | undefined,
  slug: string,
): Promise<void> {
  if (!kv) return;
  const key = `action-count:${slug}`;
  const current = parseInt(await kv.get(key) ?? "0", 10);
  await kv.put(key, String(current + 1), { expirationTtl: 86400 * 30 });
}

async function sendConfirmationEmail(ctx: PostSubmitContext): Promise<void> {
  const { submission, env, kv } = ctx;
  if (!submission.email) return;

  // Suppression list check — honor unsubscribes / bounces / spam reports
  // before consuming the daily cap. Fail open on KV errors so infra
  // problems don't silently drop every confirmation email.
  if (kv) {
    try {
      const normalized = submission.email.trim().toLowerCase();
      const hashed = await sha256Hex(normalized);
      const suppressed = await kv.get(`suppressed:${hashed}`);
      if (suppressed) {
        console.info("[post-submit] suppressed email, skipping confirmation");
        return;
      }
    } catch {
      // Fall through — better to send than to silently drop on KV errors.
    }
  }

  // Daily send cap — prevent bot attacks from burning Resend credits
  const dailyLimit = parseInt(String(env.RESEND_DAILY_LIMIT ?? "500"), 10) || 500;
  if (kv) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const countKey = `resend-daily-count:${today}`;
    const current = parseInt(await kv.get(countKey) ?? "0", 10);
    if (current >= dailyLimit) {
      console.info("[post-submit] daily email limit reached");
      return;
    }
    // Increment after check (non-atomic, acceptable for advisory cap)
    await kv.put(countKey, String(current + 1), { expirationTtl: 86400 });
  }

  const template = renderConfirmationEmail({
    type: submission.type,
    firstName: submission.firstName,
    email: submission.email!,
    pageTitle: submission.pageTitle,
    pageUrl: submission.pageUrl,
    timestamp: new Date().toISOString(),
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [submission.email],
      subject: template.subject,
      html: template.html,
      text: template.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

function buildTrackingConfig(env: PostSubmitContext["env"]): TrackingConfig {
  const config: TrackingConfig = {};

  if (env.META_PIXEL_ID && env.META_ACCESS_TOKEN) {
    config.meta = {
      pixelId: env.META_PIXEL_ID,
      accessToken: env.META_ACCESS_TOKEN,
    };
  }

  if (env.GOOGLE_CONVERSION_ID && env.GOOGLE_CONVERSION_LABEL) {
    config.google = {
      conversionId: env.GOOGLE_CONVERSION_ID,
      conversionLabel: env.GOOGLE_CONVERSION_LABEL,
    };
  }

  return config;
}

