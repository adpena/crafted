/**
 * Submission validation — extracted from submit.ts for independent testability.
 *
 * Handles: type check, slug check, data key allowlisting, field truncation.
 */

import { SLUG_RE } from "./slug.ts";

export const ALLOWED_TYPES = new Set([
  "donation_click",
  "petition_sign",
  "gotv_pledge",
  "signup",
  "letter_sent",
  "event_rsvp",
  "call_made",
  "step_form",
]);

export const ALLOWED_DATA_KEYS = new Set([
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

/** Field-specific length caps (some fields like letter_body need to be larger) */
export const FIELD_MAX: Record<string, number> = {
  letter_body: 5000,
  letter_subject: 200,
  rep_names: 500,
  comment: 1000,
  notes: 500,
};

const DEFAULT_MAX = 1000;

export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidatedSubmission {
  type: string;
  slug: string;
  data: Record<string, unknown>;
  email?: string;
  firstName?: string;
  lastName?: string;
  zip?: string;
  phone?: string;
}

/**
 * Validate and sanitize a raw submission body.
 * Returns either a validated result or a validation error.
 */
export function validateSubmission(
  body: Record<string, unknown>,
): { ok: true; result: ValidatedSubmission } | { ok: false; error: ValidationError } {
  const type = body.type as string;
  if (!type || !ALLOWED_TYPES.has(type)) {
    return {
      ok: false,
      error: { code: "INVALID_TYPE", message: `Unknown type: ${String(type).slice(0, 32)}` },
    };
  }

  const slug = String(body.page_id ?? body.pageId ?? "");
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: { code: "INVALID_SLUG", message: "page_id must be lowercase alphanumeric with hyphens" },
    };
  }

  const rawData = (body.data ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawData)) {
    if (ALLOWED_DATA_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      const maxLen = FIELD_MAX[k] ?? DEFAULT_MAX;
      data[k] = typeof v === "string" ? v.slice(0, maxLen) : v;
    }
  }

  const email = typeof data.email === "string" ? (data.email as string).trim() : undefined;
  const firstName = typeof data.first_name === "string" ? (data.first_name as string).trim() : undefined;
  const lastName = typeof data.last_name === "string" ? (data.last_name as string).trim() : undefined;
  const zip = typeof data.zip === "string" ? (data.zip as string).trim() : undefined;
  const phone = typeof data.phone === "string" ? (data.phone as string).trim() : undefined;

  return {
    ok: true,
    result: { type, slug, data, email, firstName, lastName, zip, phone },
  };
}
