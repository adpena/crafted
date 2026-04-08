/**
 * KV-based rate limiting for action page submissions.
 *
 * Uses a fixed window counter per IP, stored in KV with TTL.
 * Configurable max requests per window.
 */

import type { KVNamespace } from "./cf-types.ts";

export interface RateLimitConfig {
  /** Max submissions per window (default: 5) */
  max: number;
  /** Window duration in seconds (default: 60) */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = { max: 5, windowSec: 60 };

/**
 * RACE-2: KV race condition — read-modify-write is not atomic.
 *
 * Under burst concurrency, N simultaneous requests can all read the same
 * counter value, pass the check, and then each write count+1. This means
 * the effective limit can be exceeded by up to N-1 extra requests.
 *
 * This is acceptable for abuse deterrence (not hard enforcement):
 *  - The fixed-window key (`rl:submit:{hash}:{window}`) ensures the counter
 *    self-corrects within windowSec — the next window starts fresh.
 *  - Real-world burst concurrency from a single IP is rare for form submissions.
 *  - Durable Objects would provide truly atomic counters but require the
 *    Cloudflare paid tier.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  config: Partial<RateLimitConfig> = {},
): Promise<RateLimitResult> {
  const { max, windowSec } = { ...DEFAULT_CONFIG, ...config };
  // Fixed window: key includes the current time window so TTL doesn't slide
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:submit:${hashIP(ip)}:${window}`;

  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= max) {
    const windowEnd = (window + 1) * windowSec;
    const retryAfter = windowEnd - Math.floor(Date.now() / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  // Increment counter — TTL set to windowSec so key auto-expires after window
  await kv.put(key, String(count + 1), { expirationTtl: windowSec });

  return { allowed: true, remaining: max - count - 1 };
}

/**
 * Hash IP for privacy — we don't store raw IPs.
 * Uses simple djb2 hash (same as ab-assign).
 */
function hashIP(ip: string): string {
  let hash = 5381;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

