/**
 * Pure Mailchimp webhook event dispatcher.
 *
 * Separated from the Astro route file so it can be unit-tested without the
 * cloudflare:workers runtime import. The route is a thin wrapper that adds
 * HTTP auth, rate limiting, and body reading.
 *
 * See src/pages/api/webhooks/mailchimp.ts for the full route + protocol docs.
 */

import { sha256Hex } from "../auth.ts";
import { markContactOptedOut, type ContactsD1 } from "../contacts.ts";
import { storeAttributionEvent, type AttributionEvent } from "../attribution.ts";

/** ~13 months — longest compliance window for unsubscribe suppression. */
export const SUPPRESSION_TTL_SEC = 395 * 86400;

export interface MailchimpKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface ProcessDeps {
  db?: ContactsD1;
  kv?: MailchimpKV;
}

export interface ProcessResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Parse and handle a single Mailchimp webhook event. Accepts the raw
 * form-encoded body and storage handles, returns an HTTP-shaped result.
 */
export async function processMailchimpEvent(
  raw: string,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const params = new URLSearchParams(raw);
  const type = params.get("type") ?? "";
  const email = params.get("data[email]")?.trim().toLowerCase() ?? "";
  const listId = params.get("data[list_id]") ?? undefined;
  const reason = params.get("data[reason]") ?? undefined;
  const firedAt = params.get("fired_at") ?? new Date().toISOString();

  if (!type) {
    return { status: 422, body: { error: "Missing type" } };
  }

  // Events we deliberately ignore — return 200 so Mailchimp does not retry.
  if (type === "subscribe" || type === "profile" || type === "campaign") {
    return { status: 200, body: { ok: true, ignored: type } };
  }

  if (type === "upemail") {
    // Email address change. We don't mutate contact records here — an
    // explicit admin-driven migration is safer. Just ack.
    return { status: 200, body: { ok: true, recorded: "upemail" } };
  }

  if (type !== "unsubscribe" && type !== "cleaned") {
    console.info(`[mailchimp-webhook] unknown type: ${type}`);
    return { status: 200, body: { ok: true, ignored: type } };
  }

  // --- Opt-out path ---
  if (!email || !email.includes("@")) {
    return { status: 422, body: { error: "Missing or invalid data[email]" } };
  }

  // Map Mailchimp's reason/action to a normalized string.
  //   unsubscribe:              user-initiated opt-out
  //   cleaned w/ reason=abuse:  spam complaint
  //   cleaned w/ other reason:  hard bounce / invalid address
  const optOutReason =
    type === "cleaned"
      ? reason === "abuse"
        ? "spam"
        : "bounce"
      : reason ?? "unsubscribe";

  const emailHash = await sha256Hex(email);

  // KV suppression — non-fatal on failure.
  if (deps.kv) {
    try {
      await deps.kv.put(`suppressed:${emailHash}`, optOutReason, {
        expirationTtl: SUPPRESSION_TTL_SEC,
      });
    } catch (err) {
      console.error(
        "[mailchimp-webhook] KV suppression write failed:",
        err instanceof Error ? err.message : "unknown",
      );
    }
  }

  // D1 contact record — authoritative, must succeed.
  if (!deps.db) {
    return { status: 503, body: { error: "Storage not available" } };
  }
  try {
    await markContactOptedOut(deps.db, email, optOutReason, firedAt);
  } catch (err) {
    console.error(
      "[mailchimp-webhook] markContactOptedOut failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return { status: 500, body: { error: "Storage failed" } };
  }

  // Attribution event — non-fatal.
  try {
    const event: AttributionEvent = {
      id: crypto.randomUUID(),
      source: "mailchimp",
      event_type:
        type === "cleaned" && reason !== "abuse" ? "bounce" : "unsubscribe",
      email_hash: emailHash,
      metadata: {
        list_id: listId,
        reason: optOutReason,
      },
      timestamp: firedAt,
    };
    await storeAttributionEvent(deps.db as never, event);
  } catch (err) {
    console.error(
      "[mailchimp-webhook] attribution insert failed:",
      err instanceof Error ? err.message : "unknown",
    );
  }

  return { status: 200, body: { ok: true, recorded: type } };
}
