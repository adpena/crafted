/**
 * Submission deduplication by email per page.
 *
 * Uses KV with SHA-256 hash of email+slug as key.
 * Never stores raw PII — only hashed identifiers.
 */

import type { KVNamespace } from "./cf-types.ts";

export interface DedupResult {
  duplicate: boolean;
}

/**
 * Check if this email has already submitted to this page.
 * If not, marks it as submitted (with 30-day TTL).
 *
 * RACE-3: KV race condition — check-then-set is not atomic.
 *
 * Two simultaneous submissions from the same email+slug can both read
 * "no existing key" and both pass the dedup check. This is mitigated by:
 *  - The contacts upsert layer provides a second dedup gate via
 *    last-write-wins merge on the email+slug composite key in D1.
 *  - The confirmation email may fire twice under extreme concurrency —
 *    this is acceptable (idempotent side-effect).
 *  - KV dedup is best-effort, not a hard guarantee.
 */
export async function checkDedup(
  kv: KVNamespace,
  email: string | undefined,
  slug: string,
): Promise<DedupResult> {
  if (!email) return { duplicate: false };

  const hash = await hashEmailSlug(email.toLowerCase().trim(), slug);
  const key = `dedup:${hash}`;

  const existing = await kv.get(key);
  if (existing) {
    return { duplicate: true };
  }

  // Mark as submitted — 30-day TTL
  await kv.put(key, "1", { expirationTtl: 86400 * 30 });
  return { duplicate: false };
}

/**
 * SHA-256 hash of email+slug for dedup key.
 * Uses Web Crypto API (available in Workers and browsers).
 */
async function hashEmailSlug(email: string, slug: string): Promise<string> {
  const data = new TextEncoder().encode(`${email}:${slug}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 16))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

