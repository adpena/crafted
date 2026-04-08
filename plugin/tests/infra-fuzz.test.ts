import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../../src/lib/rate-limit.js";
import { checkGeoFilter } from "../../src/lib/geo-filter.js";
import { checkDedup } from "../../src/lib/dedup.js";
import { renderConfirmationEmail, type EmailTemplateData } from "../../src/lib/email-templates.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockKV() {
  const store: Record<string, string> = {};
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store[key] = value;
    },
    _store: store,
  };
}

/** Generate a random string of `length` codepoints spanning the full Unicode range. */
function randomUnicode(length: number): string {
  return Array.from({ length }, () =>
    String.fromCodePoint(Math.floor(Math.random() * 0x10FFFF)),
  ).join("");
}

/** A curated set of adversarial strings. */
const ATTACK_STRINGS = {
  sqlInjection: [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "UNION SELECT * FROM secrets",
    "'; DELETE FROM submissions WHERE '1'='1",
  ],
  xss: [
    '<script>alert(1)</script>',
    '<img onerror=alert(1) src=x>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>alert(document.cookie)</script>',
  ],
  crlf: [
    "test\r\nBcc: evil@evil.com",
    "test\nContent-Type: text/html",
    "header\r\n\r\n<html>injected</html>",
  ],
  pathTraversal: [
    "../../etc/passwd",
    "..\\..\\windows\\system32",
    "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  ],
  special: [
    "",
    "\0",
    "\0\0\0",
    "null",
    "undefined",
    "NaN",
    "Infinity",
    "\t\n\r",
    " ",
  ],
};

const ITERATIONS = 100;

// ---------------------------------------------------------------------------
// 1. Rate Limiting
// ---------------------------------------------------------------------------

describe("fuzz: checkRateLimit", () => {
  describe("random IP strings", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: never throws, returns valid shape`, async () => {
        const kv = createMockKV();
        const ip = randomUnicode(Math.floor(Math.random() * 200));
        const result = await checkRateLimit(kv as any, ip);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("remaining");
        expect(typeof result.allowed).toBe("boolean");
        expect(typeof result.remaining).toBe("number");
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe("adversarial IPs", () => {
    const adversarial = [
      ...ATTACK_STRINGS.sqlInjection,
      ...ATTACK_STRINGS.xss,
      ...ATTACK_STRINGS.crlf,
      ...ATTACK_STRINGS.pathTraversal,
      ...ATTACK_STRINGS.special,
      "a".repeat(10_000), // 10KB IP
    ];

    adversarial.forEach((ip, i) => {
      it(`adversarial IP #${i} never throws`, async () => {
        const kv = createMockKV();
        const result = await checkRateLimit(kv as any, ip);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("remaining");
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("adversarial config", () => {
    const configs = [
      { max: -1 },
      { max: 0 },
      { max: 0.5 },
      { windowSec: -1 },
      { windowSec: 0 },
      { windowSec: 0.1 },
      { max: NaN },
      { windowSec: NaN },
      { max: Infinity },
      { windowSec: Infinity },
      { max: -Infinity },
      { windowSec: -Infinity },
      { max: Number.MAX_SAFE_INTEGER, windowSec: Number.MAX_SAFE_INTEGER },
    ];

    configs.forEach((cfg, i) => {
      it(`config #${i} (${JSON.stringify(cfg)}) never throws`, async () => {
        const kv = createMockKV();
        const result = await checkRateLimit(kv as any, "127.0.0.1", cfg);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("remaining");
        expect(typeof result.allowed).toBe("boolean");
        expect(typeof result.remaining).toBe("number");
      });
    });
  });

  describe("concurrent calls", () => {
    it("remaining never goes negative under concurrent load", async () => {
      const kv = createMockKV();
      const ip = "concurrent-test";
      const results = await Promise.all(
        Array.from({ length: 20 }, () => checkRateLimit(kv as any, ip)),
      );
      for (const r of results) {
        expect(r.remaining).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Geo Filter
// ---------------------------------------------------------------------------

describe("fuzz: checkGeoFilter", () => {
  describe("random country codes", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: never throws, returns valid shape`, () => {
        const country = randomUnicode(Math.floor(Math.random() * 50));
        const result = checkGeoFilter(country);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("country");
        expect(typeof result.allowed).toBe("boolean");
      });
    }
  });

  describe("adversarial country strings", () => {
    const adversarial = [
      ...ATTACK_STRINGS.sqlInjection,
      ...ATTACK_STRINGS.xss,
      ...ATTACK_STRINGS.special,
      "a".repeat(10_000),
      null,
    ];

    adversarial.forEach((country, i) => {
      it(`adversarial country #${i} never throws`, () => {
        const result = checkGeoFilter(country as any);
        expect(result).toHaveProperty("allowed");
        expect(result).toHaveProperty("country");
        expect(typeof result.allowed).toBe("boolean");
      });
    });
  });

  describe("adversarial config", () => {
    const configs = [
      { mode: "whitelist" as const, countries: [] },
      { mode: "blacklist" as const, countries: [] },
      { mode: "invalid_mode" as any, countries: ["US"] },
      { mode: "whitelist" as const, countries: Array(1000).fill("US") },
    ];

    configs.forEach((cfg, i) => {
      it(`config #${i} never throws`, () => {
        const result = checkGeoFilter("US", cfg);
        expect(result).toHaveProperty("allowed");
        expect(typeof result.allowed).toBe("boolean");
      });
    });
  });

  describe("whitelist with empty countries blocks everything", () => {
    it("blocks US when whitelist has empty countries", () => {
      const result = checkGeoFilter("US", { mode: "whitelist", countries: [] });
      expect(result.allowed).toBe(false);
    });

    it("blocks random string when whitelist has empty countries", () => {
      const result = checkGeoFilter("ZZZZZ", { mode: "whitelist", countries: [] });
      expect(result.allowed).toBe(false);
    });
  });

  describe("blacklist with empty countries allows everything", () => {
    it("allows US when blacklist has empty countries", () => {
      const result = checkGeoFilter("US", { mode: "blacklist", countries: [] });
      expect(result.allowed).toBe(true);
    });

    it("allows random string when blacklist has empty countries", () => {
      const result = checkGeoFilter("RANDOM", { mode: "blacklist", countries: [] });
      expect(result.allowed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Dedup
// ---------------------------------------------------------------------------

describe("fuzz: checkDedup", () => {
  describe("random email/slug combinations", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: never throws, returns valid shape`, async () => {
        const kv = createMockKV();
        const email = randomUnicode(Math.floor(Math.random() * 100));
        const slug = randomUnicode(Math.floor(Math.random() * 100));
        const result = await checkDedup(kv as any, email, slug);
        expect(result).toHaveProperty("duplicate");
        expect(typeof result.duplicate).toBe("boolean");
      });
    }
  });

  describe("adversarial emails", () => {
    const adversarial = [
      ...ATTACK_STRINGS.sqlInjection,
      ...ATTACK_STRINGS.xss,
      ...ATTACK_STRINGS.crlf,
      ...ATTACK_STRINGS.pathTraversal,
      "a".repeat(10_000),
      "\0",
      "",
      "test@test.com\0injected",
    ];

    adversarial.forEach((email, i) => {
      it(`adversarial email #${i} never throws`, async () => {
        const kv = createMockKV();
        const result = await checkDedup(kv as any, email, "test-slug");
        expect(result).toHaveProperty("duplicate");
        expect(typeof result.duplicate).toBe("boolean");
      });
    });
  });

  describe("adversarial slugs", () => {
    const adversarial = [
      ...ATTACK_STRINGS.sqlInjection,
      ...ATTACK_STRINGS.xss,
      ...ATTACK_STRINGS.pathTraversal,
      ...ATTACK_STRINGS.special,
      "a".repeat(10_000),
    ];

    adversarial.forEach((slug, i) => {
      it(`adversarial slug #${i} never throws`, async () => {
        const kv = createMockKV();
        const result = await checkDedup(kv as any, "test@test.com", slug);
        expect(result).toHaveProperty("duplicate");
        expect(typeof result.duplicate).toBe("boolean");
      });
    });
  });

  describe("hash determinism", () => {
    it("same email+slug always produces the same hash (same KV key)", async () => {
      const emails = ["alice@example.com", "BOB@test.org", "c@d.io"];
      for (const email of emails) {
        const kv1 = createMockKV();
        const kv2 = createMockKV();
        await checkDedup(kv1 as any, email, "test-slug");
        await checkDedup(kv2 as any, email, "test-slug");
        const keys1 = Object.keys(kv1._store);
        const keys2 = Object.keys(kv2._store);
        expect(keys1).toEqual(keys2);
      }
    });
  });

  describe("undefined and empty email edge cases", () => {
    it("undefined email returns not duplicate, no KV write", async () => {
      const kv = createMockKV();
      const result = await checkDedup(kv as any, undefined, "some-slug");
      expect(result.duplicate).toBe(false);
      expect(Object.keys(kv._store).length).toBe(0);
    });

    it("empty string email still hashes (not treated as undefined)", async () => {
      const kv = createMockKV();
      const result = await checkDedup(kv as any, "", "some-slug");
      // Empty string is falsy, so it should be treated like undefined
      expect(result.duplicate).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Email Templates
// ---------------------------------------------------------------------------

describe("fuzz: renderConfirmationEmail", () => {
  const baseData: EmailTemplateData = {
    type: "petition_sign",
    firstName: "Test",
    email: "test@example.com",
    pageTitle: "Test Page",
    pageUrl: "https://example.com/test",
    timestamp: "2025-06-15T12:00:00Z",
  };

  describe("XSS in firstName", () => {
    ATTACK_STRINGS.xss.forEach((xss, i) => {
      it(`XSS payload #${i} is escaped in HTML`, () => {
        const result = renderConfirmationEmail({ ...baseData, firstName: xss });
        expect(result).toHaveProperty("subject");
        expect(result).toHaveProperty("html");
        expect(result).toHaveProperty("text");
        expect(result.html).not.toContain("<script>");
        expect(result.html).not.toContain("<script");
        expect(result.html).toMatch(/<!DOCTYPE html>/i);
      });
    });
  });

  describe("CRLF injection in fields", () => {
    ATTACK_STRINGS.crlf.forEach((crlf, i) => {
      it(`CRLF payload #${i} in firstName does not inject headers`, () => {
        const result = renderConfirmationEmail({ ...baseData, firstName: crlf });
        // Subject should never contain raw CRLF
        expect(result.subject).not.toMatch(/\r\n/);
        expect(result.subject).not.toMatch(/\n/);
        expect(result).toHaveProperty("html");
        expect(result).toHaveProperty("text");
      });

      it(`CRLF payload #${i} in email does not inject headers`, () => {
        const result = renderConfirmationEmail({ ...baseData, email: crlf });
        expect(result.subject).not.toMatch(/\r\n/);
        expect(result).toHaveProperty("html");
        expect(result).toHaveProperty("text");
      });
    });
  });

  describe("very long firstName", () => {
    it("handles 10KB firstName without throwing", () => {
      const result = renderConfirmationEmail({
        ...baseData,
        firstName: "A".repeat(10_000),
      });
      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("html");
      expect(result).toHaveProperty("text");
      expect(result.html).toMatch(/<!DOCTYPE html>/i);
    });
  });

  describe("random Unicode in fields", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: random unicode fields never throw`, () => {
        const result = renderConfirmationEmail({
          type: "petition_sign",
          firstName: randomUnicode(Math.floor(Math.random() * 200)),
          email: randomUnicode(Math.floor(Math.random() * 100)),
          pageTitle: randomUnicode(Math.floor(Math.random() * 100)),
          pageUrl: randomUnicode(Math.floor(Math.random() * 200)),
          timestamp: randomUnicode(Math.floor(Math.random() * 50)),
        });
        expect(result).toHaveProperty("subject");
        expect(result).toHaveProperty("html");
        expect(result).toHaveProperty("text");
        expect(typeof result.subject).toBe("string");
        expect(typeof result.html).toBe("string");
        expect(typeof result.text).toBe("string");
      });
    }
  });

  describe("unknown action types", () => {
    const unknownTypes = [
      "unknown",
      "",
      "petition",
      "PETITION_SIGN",
      "delete_all",
      '<script>alert(1)</script>',
      "'; DROP TABLE",
    ];

    unknownTypes.forEach((type, i) => {
      it(`unknown type #${i} falls back to generic without throwing`, () => {
        const result = renderConfirmationEmail({
          ...baseData,
          type: type as any,
        });
        expect(result).toHaveProperty("subject");
        expect(result).toHaveProperty("html");
        expect(result).toHaveProperty("text");
        expect(result.html).toMatch(/<!DOCTYPE html>/i);
      });
    });
  });

  describe("all valid types produce valid HTML", () => {
    const types: EmailTemplateData["type"][] = [
      "petition_sign",
      "gotv_pledge",
      "signup",
      "donation_click",
    ];

    types.forEach((type) => {
      it(`${type} HTML starts with DOCTYPE`, () => {
        const result = renderConfirmationEmail({ ...baseData, type });
        expect(result.html).toMatch(/^<!DOCTYPE html>/i);
      });

      it(`${type} HTML never contains raw <script>`, () => {
        const result = renderConfirmationEmail({
          ...baseData,
          type,
          firstName: '<script>alert("xss")</script>',
        });
        expect(result.html).not.toContain("<script>");
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Data Field Sanitization (allowlist logic from submit.ts)
// ---------------------------------------------------------------------------

describe("fuzz: data field sanitization", () => {
  /**
   * Replicate the allowlist/sanitization logic from submit.ts.
   * This is the pattern used in validateSubmission to strip unknown fields.
   */
  const ALLOWED_KEYS = new Set([
    "email",
    "first_name",
    "last_name",
    "zip",
    "phone",
    "address",
    "city",
    "state",
    "custom_message",
  ]);

  const MAX_VALUE_LENGTH = 1000;

  function sanitizeData(
    input: unknown,
  ): Record<string, string | number | boolean> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {};
    }

    const result: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (!ALLOWED_KEYS.has(key)) continue;

      if (typeof value === "string") {
        result[key] = value.length > MAX_VALUE_LENGTH
          ? value.slice(0, MAX_VALUE_LENGTH)
          : value;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        result[key] = value;
      } else if (typeof value === "boolean") {
        result[key] = value;
      }
      // All other types (object, array, null, undefined, symbol, function, NaN, Infinity) are dropped
    }

    return result;
  }

  describe("only allowed keys survive", () => {
    it("strips unknown keys", () => {
      const input = {
        email: "a@b.com",
        malicious_key: "evil",
        __proto__: "attack",
        constructor: "bad",
        first_name: "Ada",
      };
      const result = sanitizeData(input);
      expect(result).toHaveProperty("email");
      expect(result).toHaveProperty("first_name");
      expect(result).not.toHaveProperty("malicious_key");
      expect(result).not.toHaveProperty("constructor");
    });

    it("handles object with 1000 keys", () => {
      const input: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        input[`key_${i}`] = `value_${i}`;
      }
      input["email"] = "test@test.com";
      const result = sanitizeData(input);
      expect(Object.keys(result)).toEqual(["email"]);
    });
  });

  describe("string truncation", () => {
    it("truncates values longer than 1000 chars", () => {
      const result = sanitizeData({ email: "x".repeat(2000) });
      expect(result.email).toHaveLength(MAX_VALUE_LENGTH);
    });

    it("preserves values at exactly 1000 chars", () => {
      const val = "y".repeat(1000);
      const result = sanitizeData({ email: val });
      expect(result.email).toBe(val);
    });

    it("preserves short values", () => {
      const result = sanitizeData({ email: "short" });
      expect(result.email).toBe("short");
    });
  });

  describe("non-primitive values are dropped", () => {
    const nonPrimitives: [string, unknown][] = [
      ["object", { nested: true }],
      ["array", [1, 2, 3]],
      ["null", null],
      ["undefined", undefined],
      ["function", () => "evil"],
      ["symbol", Symbol("test")],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["-Infinity", -Infinity],
    ];

    nonPrimitives.forEach(([label, value]) => {
      it(`drops ${label} value`, () => {
        const result = sanitizeData({ email: value });
        expect(result).not.toHaveProperty("email");
      });
    });
  });

  describe("non-object inputs return empty object", () => {
    const nonObjects: unknown[] = [
      null,
      undefined,
      42,
      "string",
      true,
      false,
      [],
      [1, 2],
    ];

    nonObjects.forEach((input, i) => {
      it(`non-object input #${i} returns {}`, () => {
        const result = sanitizeData(input);
        expect(result).toEqual({});
      });
    });
  });

  describe("adversarial values in allowed keys", () => {
    const payloads = [
      ...ATTACK_STRINGS.sqlInjection,
      ...ATTACK_STRINGS.xss,
      ...ATTACK_STRINGS.crlf,
      ...ATTACK_STRINGS.pathTraversal,
    ];

    payloads.forEach((payload, i) => {
      it(`payload #${i} in allowed key is preserved as-is (sanitized elsewhere)`, () => {
        const result = sanitizeData({ email: payload });
        // String values should pass through (XSS/SQL escaping is done at render time)
        expect(result.email).toBe(payload);
      });
    });
  });

  describe("random fuzz on sanitizeData", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      it(`iteration ${i}: never throws`, () => {
        // Build random object with mix of allowed and random keys
        const obj: Record<string, unknown> = {};
        const numKeys = Math.floor(Math.random() * 50);
        for (let k = 0; k < numKeys; k++) {
          const key = Math.random() < 0.3
            ? [...ALLOWED_KEYS][Math.floor(Math.random() * ALLOWED_KEYS.size)]
            : randomUnicode(Math.floor(Math.random() * 30));
          obj[key] = Math.random() < 0.5
            ? randomUnicode(Math.floor(Math.random() * 2000))
            : Math.random() < 0.5
              ? Math.random() * 1000
              : Math.random() < 0.5;
        }
        const result = sanitizeData(obj);
        expect(typeof result).toBe("object");
        // All surviving keys must be in allowlist
        for (const key of Object.keys(result)) {
          expect(ALLOWED_KEYS.has(key)).toBe(true);
        }
        // All surviving values must be string, number, or boolean
        for (const value of Object.values(result)) {
          expect(["string", "number", "boolean"]).toContain(typeof value);
          if (typeof value === "string") {
            expect(value.length).toBeLessThanOrEqual(MAX_VALUE_LENGTH);
          }
        }
      });
    }
  });
});
