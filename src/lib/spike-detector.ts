/**
 * Spike detection for action page submissions.
 *
 * Detects when submission rate exceeds 2x the trailing 24-hour average
 * in a 15-minute window. Uses an exponential moving average (EMA) stored
 * in a single KV key per slug to keep KV ops cheap.
 *
 * KV keys used:
 * - `spike-window:{slug}:{bucket}` — count of submissions in current 15-min window (TTL: 24h)
 * - `spike-baseline:{slug}` — EMA baseline JSON: { avg, lastBucket, sampleCount }
 * - `spike-notified:{slug}:{bucket}` — flag to prevent duplicate notifications per window (TTL: 15min)
 *
 * Cost per submission: 1 read + 1 write (window increment) + 1 read (baseline).
 * On bucket transition (every 15 min): +2 reads + 1 write (EMA update).
 */

import type { KVNamespace } from "./cf-types.ts";

export interface SpikeResult {
  spiking: boolean;
  currentRate: number;
  baselineRate: number;
  multiplier: number;
}

interface BaselineData {
  avg: number;
  lastBucket: string;
  sampleCount: number;
}

/** Configurable spike multiplier threshold (default 2x). */
const SPIKE_THRESHOLD = 2;

/** EMA smoothing factor — 0.02 = ~50-bucket half-life (~12.5 hours). */
const EMA_ALPHA = 0.02;

/** Minimum samples before spike detection activates (avoid false positives on new pages). */
const MIN_SAMPLES = 8;

/**
 * Get the current 15-minute bucket identifier.
 * Format: Unix timestamp of the bucket start, floored to 15-min boundary.
 */
export function getCurrentBucket(now = Date.now()): string {
  const bucketMs = 15 * 60 * 1000;
  return String(Math.floor(now / bucketMs) * bucketMs);
}

/**
 * Get the previous bucket identifier.
 */
function getPreviousBucket(currentBucket: string): string {
  const bucketMs = 15 * 60 * 1000;
  return String(parseInt(currentBucket, 10) - bucketMs);
}

/**
 * Increment the submission count for the current 15-minute window.
 * Returns the new count for the current bucket.
 */
export async function incrementWindow(
  kv: KVNamespace,
  slug: string,
  bucket?: string,
): Promise<number> {
  const b = bucket ?? getCurrentBucket();
  const key = `spike-window:${slug}:${b}`;
  const raw = await kv.get(key);
  const newCount = (raw !== null ? parseInt(raw, 10) : 0) + 1;
  await kv.put(key, String(newCount), { expirationTtl: 86400 });
  return newCount;
}

/**
 * Detect whether the current submission rate constitutes a spike.
 *
 * Also handles EMA baseline updates on bucket transitions.
 */
export async function detectSpike(
  kv: KVNamespace,
  slug: string,
): Promise<SpikeResult> {
  const currentBucket = getCurrentBucket();
  const windowKey = `spike-window:${slug}:${currentBucket}`;
  const baselineKey = `spike-baseline:${slug}`;

  // Read current window count and baseline in parallel
  const [windowRaw, baselineRaw] = await Promise.all([
    kv.get(windowKey),
    kv.get(baselineKey),
  ]);

  const currentRate = windowRaw !== null ? parseInt(windowRaw, 10) : 0;

  // Parse or initialize baseline
  let baseline: BaselineData = { avg: 0, lastBucket: "", sampleCount: 0 };
  if (baselineRaw) {
    try {
      baseline = JSON.parse(baselineRaw) as BaselineData;
    } catch {
      // Corrupted baseline — reset
    }
  }

  // Bucket transition: update EMA with the previous bucket's count
  if (baseline.lastBucket && baseline.lastBucket !== currentBucket) {
    const prevBucket = getPreviousBucket(currentBucket);
    // Only update if we haven't already processed this transition
    if (baseline.lastBucket !== prevBucket) {
      // We may have skipped buckets (page was quiet). Just use the last known bucket's count.
      const prevKey = `spike-window:${slug}:${baseline.lastBucket}`;
      const prevRaw = await kv.get(prevKey);
      const prevCount = prevRaw !== null ? parseInt(prevRaw, 10) : 0;

      if (baseline.sampleCount < 2) {
        // Seed the average with the first real sample
        baseline.avg = prevCount;
      } else {
        baseline.avg = baseline.avg * (1 - EMA_ALPHA) + prevCount * EMA_ALPHA;
      }
      baseline.sampleCount++;
    }
    baseline.lastBucket = currentBucket;

    // Write updated baseline (fire-and-forget is fine for detection accuracy)
    await kv.put(baselineKey, JSON.stringify(baseline), { expirationTtl: 86400 * 30 });
  } else if (!baseline.lastBucket) {
    // First ever submission for this slug — initialize
    baseline.lastBucket = currentBucket;
    baseline.sampleCount = 1;
    await kv.put(baselineKey, JSON.stringify(baseline), { expirationTtl: 86400 * 30 });
  }

  const baselineRate = baseline.avg;
  const multiplier = baselineRate > 0 ? currentRate / baselineRate : 0;
  const spiking =
    baseline.sampleCount >= MIN_SAMPLES &&
    baselineRate > 0 &&
    multiplier >= SPIKE_THRESHOLD;

  return { spiking, currentRate, baselineRate: Math.round(baselineRate * 10) / 10, multiplier: Math.round(multiplier * 10) / 10 };
}

/**
 * Check if a spike notification has already been sent for this slug + bucket.
 */
export async function isAlreadyNotified(
  kv: KVNamespace,
  slug: string,
  bucket?: string,
): Promise<boolean> {
  const b = bucket ?? getCurrentBucket();
  const key = `spike-notified:${slug}:${b}`;
  const val = await kv.get(key);
  return val !== null;
}

/**
 * Mark that a spike notification has been sent for this slug + bucket.
 */
export async function markNotified(
  kv: KVNamespace,
  slug: string,
  bucket?: string,
): Promise<void> {
  const b = bucket ?? getCurrentBucket();
  const key = `spike-notified:${slug}:${b}`;
  await kv.put(key, "1", { expirationTtl: 900 }); // 15 minutes
}
