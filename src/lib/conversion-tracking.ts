/**
 * Server-side conversion tracking for ad platforms.
 *
 * Fires conversion events to Meta Conversions API and Google Ads
 * after form submissions. Uses hashed PII (SHA-256) per platform requirements.
 * All hashing uses Web Crypto API (no Node crypto — Workers compatible).
 */

export interface ConversionData {
  /** Action type maps to conversion event name */
  type: "petition_sign" | "gotv_pledge" | "signup" | "donation_click";
  /** Hashed or raw email (will be hashed before sending) */
  email?: string;
  /** Client IP for event dedup */
  clientIp?: string;
  /** User agent */
  userAgent?: string;
  /** Click attribution from form submission */
  attribution?: {
    fbclid?: string;
    gclid?: string;
    fbc?: string;
    fbp?: string;
  };
  /** Event source URL */
  sourceUrl?: string;
}

export interface TrackingConfig {
  /** Meta Conversions API */
  meta?: {
    pixelId: string;
    accessToken: string;
  };
  /** Google Ads conversion tracking */
  google?: {
    conversionId: string;
    conversionLabel: string;
  };
}

/** Map action types to platform-standard event names */
const META_EVENT_MAP: Record<string, string> = {
  petition_sign: "Lead",
  gotv_pledge: "Lead",
  signup: "CompleteRegistration",
  donation_click: "InitiateCheckout",
};

/**
 * Fire conversion events to all configured platforms.
 * Non-blocking — errors are logged but don't fail the request.
 */
export async function fireConversions(
  data: ConversionData,
  config: TrackingConfig,
): Promise<{ meta?: boolean; google?: boolean }> {
  const results: { meta?: boolean; google?: boolean } = {};

  const tasks: Promise<void>[] = [];

  if (config.meta) {
    tasks.push(
      fireMetaCAPI(data, config.meta)
        .then(() => { results.meta = true; })
        .catch((err) => {
          console.error("[conversion] Meta CAPI error:", err instanceof Error ? err.message : "unknown");
          results.meta = false;
        }),
    );
  }

  if (config.google) {
    tasks.push(
      fireGoogleAds(data, config.google)
        .then(() => { results.google = true; })
        .catch((err) => {
          console.error("[conversion] Google Ads error:", err instanceof Error ? err.message : "unknown");
          results.google = false;
        }),
    );
  }

  await Promise.allSettled(tasks);
  return results;
}

/**
 * Meta Conversions API (server-side pixel).
 * https://developers.facebook.com/docs/marketing-api/conversions-api
 */
async function fireMetaCAPI(
  data: ConversionData,
  config: { pixelId: string; accessToken: string },
): Promise<void> {
  const eventName = META_EVENT_MAP[data.type] ?? "Lead";
  const hashedEmail = data.email ? await sha256Hash(data.email.toLowerCase().trim()) : undefined;

  const eventData: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: data.sourceUrl,
    action_source: "website",
    user_data: {
      ...(hashedEmail && { em: [hashedEmail] }),
      ...(data.clientIp && { client_ip_address: data.clientIp }),
      ...(data.userAgent && { client_user_agent: data.userAgent }),
      ...(data.attribution?.fbc && { fbc: data.attribution.fbc }),
      ...(data.attribution?.fbp && { fbp: data.attribution.fbp }),
      ...(data.attribution?.fbclid && { fbclid: data.attribution.fbclid }),
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${config.pixelId}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ data: [eventData] }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta CAPI ${res.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * Google Ads conversion tracking (measurement protocol).
 */
async function fireGoogleAds(
  data: ConversionData,
  config: { conversionId: string; conversionLabel: string },
): Promise<void> {
  const gclid = data.attribution?.gclid;
  if (!gclid) return; // Google Ads requires gclid for server-side

  const params = new URLSearchParams({
    v: "1",
    tid: config.conversionId,
    cid: gclid,
    t: "event",
    ea: data.type,
    el: config.conversionLabel,
  });

  const res = await fetch(`https://www.google-analytics.com/collect?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Google Ads ${res.status}`);
  }
}

/**
 * SHA-256 hash using Web Crypto API.
 * Returns lowercase hex string per Meta CAPI spec.
 */
async function sha256Hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
