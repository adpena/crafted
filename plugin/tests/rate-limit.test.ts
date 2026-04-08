import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../../src/lib/rate-limit.js";

function createMockKV() {
  const store: Record<string, string> = {};
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store[key] = value;
    },
    /** Expose store for assertions */
    _store: store,
  };
}

describe("checkRateLimit", () => {
  it("allows first request with remaining = max - 1", async () => {
    const kv = createMockKV();
    const result = await checkRateLimit(kv as any, "192.168.1.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // default max is 5
    expect(result.retryAfter).toBeUndefined();
  });

  it("allows requests up to max", async () => {
    const kv = createMockKV();
    const ip = "10.0.0.1";

    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(kv as any, ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("blocks request at max with retryAfter", async () => {
    const kv = createMockKV();
    const ip = "10.0.0.2";

    // Exhaust all 5 requests
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv as any, ip);
    }

    // 6th request should be blocked
    const result = await checkRateLimit(kv as any, ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Fixed window: retryAfter is time until window end (0–60s range)
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it("tracks different IPs independently", async () => {
    const kv = createMockKV();

    // Exhaust IP A
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(kv as any, "1.1.1.1");
    }
    const blockedA = await checkRateLimit(kv as any, "1.1.1.1");
    expect(blockedA.allowed).toBe(false);

    // IP B should still be allowed
    const resultB = await checkRateLimit(kv as any, "2.2.2.2");
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(4);
  });

  it("supports custom config (max, windowSec)", async () => {
    const kv = createMockKV();
    const ip = "172.16.0.1";

    // Custom: max 2, window 120s
    const r1 = await checkRateLimit(kv as any, ip, { max: 2, windowSec: 120 });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await checkRateLimit(kv as any, ip, { max: 2, windowSec: 120 });
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await checkRateLimit(kv as any, ip, { max: 2, windowSec: 120 });
    expect(r3.allowed).toBe(false);
    // Fixed window: retryAfter is time until window end (0–120s range)
    expect(r3.retryAfter).toBeGreaterThan(0);
    expect(r3.retryAfter).toBeLessThanOrEqual(120);
  });

  it("hashes IP — never stores raw IP in KV keys", async () => {
    const kv = createMockKV();
    const ip = "203.0.113.42";

    await checkRateLimit(kv as any, ip);

    const keys = Object.keys(kv._store);
    expect(keys.length).toBe(1);
    // Key should start with "rl:submit:" but NOT contain the raw IP
    expect(keys[0]).toMatch(/^rl:submit:/);
    expect(keys[0]).not.toContain(ip);
  });

  it("partial config merges with defaults", async () => {
    const kv = createMockKV();
    // Only override max, windowSec should default to 60
    const r1 = await checkRateLimit(kv as any, "10.10.10.10", { max: 1 });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(0);

    const r2 = await checkRateLimit(kv as any, "10.10.10.10", { max: 1 });
    expect(r2.allowed).toBe(false);
    // Fixed window: retryAfter is time until window end
    expect(r2.retryAfter).toBeGreaterThan(0);
    expect(r2.retryAfter).toBeLessThanOrEqual(60);
  });
});
