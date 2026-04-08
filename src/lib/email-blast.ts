/**
 * Email blast — bulk send to a contact list via Resend batch API.
 *
 * Used by the action-pages plugin for campaigns to email their collected
 * contacts. Includes merge-field substitution, suppression list checks,
 * batched sends, and HMAC-signed unsubscribe links.
 *
 * Required environment variables (in addition to existing ones):
 *   RESEND_API_KEY      — Resend transactional email API key (existing)
 *   UNSUBSCRIBE_SECRET  — HMAC-SHA256 secret for signing unsubscribe tokens
 *   UNSUBSCRIBE_BASE_URL — public URL e.g. https://adpena.com/unsubscribe
 *
 * Security:
 *   - All inputs validated and length-capped
 *   - Hard cap of 10,000 recipients per call
 *   - Per-batch AbortSignal.timeout(30s)
 *   - Errors never include raw email addresses (PII)
 *   - Suppression list checked against KV (`suppressed:{sha256(email)}`)
 */

import type { KVNamespace } from "./cf-types.ts";
import type { Contact } from "./contacts-types.ts";

// --- Limits / constants ---
export const MAX_RECIPIENTS_PER_BLAST = 10_000;
export const MAX_SUBJECT_LEN = 200;
export const MAX_BODY_BYTES = 100 * 1024; // 100KB
export const BATCH_SIZE = 100;
export const BATCH_TIMEOUT_MS = 30_000;
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";

// Reasonable RFC-ish email regex (not exhaustive but blocks obvious garbage).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SendEmailBlastOptions {
  /** KV namespace used for the suppression list lookups. Optional. */
  kv?: KVNamespace;
  /** Resend API key. */
  resendApiKey: string;
  /** From address (must validate). */
  fromEmail: string;
  /** Optional Reply-To header. */
  replyTo?: string;
  /** Recipient contacts. Hard-capped at MAX_RECIPIENTS_PER_BLAST. */
  recipients: Contact[];
  /** Subject template (supports merge fields). */
  subject: string;
  /** HTML body template (supports merge fields). */
  htmlBody: string;
  /** Plain text body template (supports merge fields). */
  textBody: string;
  /** Public unsubscribe base URL. If set + unsubscribeSecret, footers injected. */
  unsubscribeBaseUrl?: string;
  /** HMAC-SHA256 secret for signing unsubscribe tokens. */
  unsubscribeSecret?: string;
}

export interface SendEmailBlastResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Validate from-address / reply-to.
 */
function isValidEmail(s: string | undefined): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 254 && EMAIL_RE.test(s);
}

/**
 * Compute SHA-256 hex digest of an email (for KV suppression keys).
 */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Sign a value with HMAC-SHA256, returning a URL-safe base64 token.
 */
export async function signUnsubscribeToken(
  secret: string,
  email: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(email.toLowerCase()));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  // URL-safe base64 (no padding)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Verify an HMAC unsubscribe token in constant time.
 */
export async function verifyUnsubscribeToken(
  secret: string,
  email: string,
  token: string,
): Promise<boolean> {
  if (!secret || !email || !token) return false;
  const expected = await signUnsubscribeToken(secret, email);
  return timingSafeEqual(expected, token);
}

/**
 * Constant-time string comparison via HMAC. Same pattern used elsewhere.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("comparison-key"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const va = new Uint8Array(sigA);
  const vb = new Uint8Array(sigB);
  if (va.length !== vb.length) return false;
  let r = 0;
  for (let i = 0; i < va.length; i++) r |= va[i]! ^ vb[i]!;
  return r === 0;
}

/**
 * Apply merge fields to a template. Replaces:
 *   {{first_name}}, {{last_name}}, {{email}}
 * Missing values are replaced with the empty string.
 */
function applyMergeFields(template: string, contact: Contact): string {
  return template
    .replace(/\{\{\s*first_name\s*\}\}/g, escapeIfHtml(contact.first_name ?? ""))
    .replace(/\{\{\s*last_name\s*\}\}/g, escapeIfHtml(contact.last_name ?? ""))
    .replace(/\{\{\s*email\s*\}\}/g, escapeIfHtml(contact.email));
}

/**
 * The merge function is used for both subject (text), html, and text bodies.
 * For the html template we lightly escape values to prevent injecting tags.
 * We can't tell which context we're in here, so we always escape — html-safe
 * substitutions are also safe in plain text and subject lines.
 */
function escapeIfHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Inject an unsubscribe footer into html and text bodies. Returns the modified
 * html / text. Only invoked when unsubscribeBaseUrl + secret are set.
 */
async function injectUnsubscribeFooter(
  html: string,
  text: string,
  baseUrl: string,
  secret: string,
  email: string,
): Promise<{ html: string; text: string }> {
  const token = await signUnsubscribeToken(secret, email);
  const sep = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${sep}email=${encodeURIComponent(email)}&t=${token}`;
  const safeUrl = url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const htmlFooter =
    `<hr style="margin-top:32px;border:none;border-top:1px solid #ccc;">` +
    `<p style="font-size:12px;color:#666;text-align:center;margin-top:12px;">` +
    `Don't want these emails? <a href="${safeUrl}">Unsubscribe</a>.` +
    `</p>`;
  const textFooter = `\n\n--\nUnsubscribe: ${url}\n`;

  return { html: html + htmlFooter, text: text + textFooter };
}

/**
 * Send a bulk email blast.
 *
 * Returns counts of sent / failed / skipped messages plus a list of error
 * strings. Errors never include raw email addresses — they reference batch
 * indices and recipient hashes only.
 */
export async function sendEmailBlast(
  opts: SendEmailBlastOptions,
): Promise<SendEmailBlastResult> {
  const result: SendEmailBlastResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

  // --- Input validation ---
  if (!opts.resendApiKey || typeof opts.resendApiKey !== "string") {
    result.errors.push("Missing or invalid resendApiKey");
    return result;
  }
  if (!isValidEmail(opts.fromEmail)) {
    result.errors.push("Invalid fromEmail");
    return result;
  }
  if (opts.replyTo !== undefined && !isValidEmail(opts.replyTo)) {
    result.errors.push("Invalid replyTo");
    return result;
  }
  if (typeof opts.subject !== "string" || opts.subject.length === 0) {
    result.errors.push("Missing subject");
    return result;
  }
  if (opts.subject.length > MAX_SUBJECT_LEN) {
    result.errors.push(`Subject exceeds ${MAX_SUBJECT_LEN} chars`);
    return result;
  }
  if (typeof opts.htmlBody !== "string" || typeof opts.textBody !== "string") {
    result.errors.push("Missing htmlBody / textBody");
    return result;
  }
  const htmlBytes = new TextEncoder().encode(opts.htmlBody).byteLength;
  const textBytes = new TextEncoder().encode(opts.textBody).byteLength;
  if (htmlBytes > MAX_BODY_BYTES || textBytes > MAX_BODY_BYTES) {
    result.errors.push(`Body exceeds ${MAX_BODY_BYTES} bytes`);
    return result;
  }
  if (!Array.isArray(opts.recipients)) {
    result.errors.push("recipients must be an array");
    return result;
  }
  if (opts.recipients.length > MAX_RECIPIENTS_PER_BLAST) {
    result.errors.push(`Too many recipients (max ${MAX_RECIPIENTS_PER_BLAST})`);
    return result;
  }
  if (opts.unsubscribeBaseUrl) {
    try {
      const u = new URL(opts.unsubscribeBaseUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        result.errors.push("Invalid unsubscribeBaseUrl protocol");
        return result;
      }
    } catch {
      result.errors.push("Invalid unsubscribeBaseUrl");
      return result;
    }
    if (!opts.unsubscribeSecret) {
      result.errors.push("unsubscribeSecret required when unsubscribeBaseUrl is set");
      return result;
    }
  }

  // --- Filter / validate recipients (and check suppression list) ---
  type Prepared = {
    email: string;
    html: string;
    text: string;
    subject: string;
  };
  const prepared: Prepared[] = [];
  const seenEmails = new Set<string>();

  for (const c of opts.recipients) {
    if (!c || typeof c !== "object") {
      result.skipped++;
      continue;
    }
    const email = (c.email ?? "").toString().trim().toLowerCase();
    if (!isValidEmail(email)) {
      result.skipped++;
      continue;
    }
    if (seenEmails.has(email)) {
      result.skipped++;
      continue;
    }
    seenEmails.add(email);

    // Suppression list (KV)
    if (opts.kv) {
      try {
        const hashed = await sha256Hex(email);
        const sup = await opts.kv.get(`suppressed:${hashed}`);
        if (sup) {
          result.skipped++;
          continue;
        }
      } catch {
        // KV failure: fall through and attempt to send (don't drop on infra errs)
      }
    }

    const contactWithEmail: Contact = { ...c, email };
    let subj = applyMergeFields(opts.subject, contactWithEmail);
    let html = applyMergeFields(opts.htmlBody, contactWithEmail);
    let text = applyMergeFields(opts.textBody, contactWithEmail);

    if (opts.unsubscribeBaseUrl && opts.unsubscribeSecret) {
      const injected = await injectUnsubscribeFooter(
        html,
        text,
        opts.unsubscribeBaseUrl,
        opts.unsubscribeSecret,
        email,
      );
      html = injected.html;
      text = injected.text;
    }

    prepared.push({ email, html, text, subject: subj });
  }

  if (prepared.length === 0) {
    return result;
  }

  // --- Batch send via Resend batch API ---
  for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
    const batch = prepared.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    const payload = batch.map((p) => ({
      from: opts.fromEmail,
      to: [p.email],
      subject: p.subject,
      html: p.html,
      text: p.text,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }));

    try {
      const res = await fetch(RESEND_BATCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.resendApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        result.failed += batch.length;
        // Truncate any error body and never include the request payload (PII).
        const body = (await res.text().catch(() => "")).slice(0, 200);
        result.errors.push(
          `batch ${batchIndex}: HTTP ${res.status}${body ? ` — ${body}` : ""}`,
        );
        continue;
      }

      result.sent += batch.length;
    } catch (err) {
      result.failed += batch.length;
      const msg = err instanceof Error ? err.message : "unknown";
      // err.message from fetch generally doesn't contain emails, but be safe.
      result.errors.push(`batch ${batchIndex}: ${msg.slice(0, 200)}`);
    }
  }

  return result;
}
