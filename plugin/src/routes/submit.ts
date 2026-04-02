import type { RouteContext, PluginContext } from "emdash";
import { validateSubmission } from "../modules/validate.ts";
import type { SubmissionInput } from "../modules/validate.ts";

const ALLOWED_TYPES = new Set<SubmissionInput["type"]>(["donation_click", "petition_sign", "gotv_pledge"]);
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkRateLimit(ctx: PluginContext, ip: string): Promise<boolean> {
  const minute = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const ipHash = await sha256(ip);
  const key = `rate:${ipHash}:${minute}`;

  const current = await ctx.kv.get<number>(key);
  const count = (current ?? 0) + 1;

  if (count >= RATE_LIMIT) {
    return false;
  }

  await ctx.kv.set(key, count, { ttl: RATE_WINDOW_SECONDS * 2 });
  return true;
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const result = (await response.json()) as { success: boolean };
  return result.success === true;
}

export async function handleSubmit(routeCtx: RouteContext, ctx: PluginContext) {
  const body = routeCtx.input as {
    page_id: string;
    type: SubmissionInput["type"];
    data: Record<string, unknown>;
    visitor_id?: string;
    variant?: string;
    turnstile_token?: string;
  };

  // Validate page_id
  if (!body.page_id || !/^[a-z0-9][a-z0-9-]*$/.test(body.page_id)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid page_id" } } };
  }

  // Validate visitor_id if provided
  if (body.visitor_id && !/^[0-9a-f-]{36}$/.test(body.visitor_id)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid visitor_id" } } };
  }

  // Validate variant if provided
  if (body.variant && body.variant.length > 100) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid variant" } } };
  }

  // Validate type is one of the allowed values
  if (!body.type || !ALLOWED_TYPES.has(body.type)) {
    return { status: 400, body: { error: { code: "INVALID_INPUT", message: "Invalid submission type" } } };
  }

  // Rate limiting
  const clientIp = routeCtx.request.headers.get("cf-connecting-ip") ?? "unknown";
  const allowed = await checkRateLimit(ctx, clientIp);
  if (!allowed) {
    return { status: 429, body: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } } };
  }

  // Turnstile validation (optional -- skipped if no secret configured)
  // TODO: Move to wrangler secret binding once Turnstile is configured
  const turnstileSecret = await ctx.kv.get<string>("turnstile_secret");
  if (turnstileSecret) {
    const token = body.turnstile_token;
    if (!token) {
      return { status: 400, body: { error: { code: "MISSING_TOKEN", message: "Missing turnstile_token" } } };
    }
    const valid = await verifyTurnstile(token, turnstileSecret, clientIp);
    if (!valid) {
      return { status: 403, body: { error: { code: "TURNSTILE_FAILED", message: "Turnstile verification failed" } } };
    }
  }

  const result = validateSubmission({ type: body.type, data: body.data });
  if (!result.valid) {
    return { status: 400, body: { error: { code: "VALIDATION_FAILED", message: result.errors.join("; ") } } };
  }

  const geo = routeCtx.requestMeta.geo;
  const id = crypto.randomUUID();

  await ctx.storage.submissions.put(id, {
    page_id: body.page_id,
    type: body.type,
    data: result.sanitized,
    visitor_id: body.visitor_id ?? null,
    variant: body.variant ?? null,
    country: geo?.country ?? null,
    city: geo?.city ?? null,
    created_at: new Date().toISOString(),
  });

  return { status: 200, body: { data: { ok: true } } };
}
