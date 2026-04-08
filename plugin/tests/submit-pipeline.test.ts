/**
 * Submit pipeline validation tests.
 *
 * Tests the core data flow logic (type checking, slug validation, data key
 * allowlisting, field truncation) WITHOUT hitting real D1/KV.
 */

import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  ALLOWED_TYPES,
  ALLOWED_DATA_KEYS,
  FIELD_MAX,
} from "../../src/lib/validate-submission.ts";

describe("ALLOWED_TYPES", () => {
  it("rejects unknown types", () => {
    const result = validateSubmission({ type: "hacked_type", page_id: "test-page", data: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_TYPE");
    }
  });

  it("step_form is in ALLOWED_TYPES", () => {
    expect(ALLOWED_TYPES.has("step_form")).toBe(true);
  });

  it("accepts all 8 expected types", () => {
    const expected = [
      "donation_click", "petition_sign", "gotv_pledge", "signup",
      "letter_sent", "event_rsvp", "call_made", "step_form",
    ];
    expect(ALLOWED_TYPES.size).toBe(8);
    for (const t of expected) {
      expect(ALLOWED_TYPES.has(t)).toBe(true);
    }
  });
});

describe("SLUG_RE validation", () => {
  it("rejects invalid slugs", () => {
    const badSlugs = [
      "",
      "-leading-hyphen",
      "UPPERCASE",
      "has spaces",
      "special!chars",
      "../path-traversal",
    ];
    for (const slug of badSlugs) {
      const result = validateSubmission({ type: "petition_sign", page_id: slug, data: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_SLUG");
      }
    }
  });

  it("accepts valid slugs", () => {
    const goodSlugs = ["my-page", "rally-2026", "a", "test-123-page"];
    for (const slug of goodSlugs) {
      const result = validateSubmission({ type: "petition_sign", page_id: slug, data: { email: "a@b.com" } });
      expect(result.ok).toBe(true);
    }
  });
});

describe("ALLOWED_DATA_KEYS filtering", () => {
  it("filters out unknown keys", () => {
    const result = validateSubmission({
      type: "petition_sign",
      page_id: "test-page",
      data: {
        first_name: "Ada",
        evil_key: "injected",
        __proto__: "attack",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.data).toHaveProperty("first_name");
      expect(result.result.data).not.toHaveProperty("evil_key");
      expect(result.result.data).not.toHaveProperty("__proto__");
    }
  });

  it("includes all expected keys for all action types", () => {
    // Core identity fields
    const coreKeys = ["first_name", "last_name", "email", "zip", "phone", "comment", "amount"];
    // Letter action keys
    const letterKeys = ["letter_subject", "letter_body", "rep_names"];
    // Event RSVP keys
    const eventKeys = ["guest_count", "notes"];
    // Call action keys
    const callKeys = ["calls_completed"];
    // Attribution keys
    const attrKeys = [
      "fbclid", "gclid", "ttclid", "twclid", "li_fat_id", "rdt_cid", "scid", "msclkid",
      "fbc", "fbp", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    ];

    const allExpected = [...coreKeys, ...letterKeys, ...eventKeys, ...callKeys, ...attrKeys];
    for (const key of allExpected) {
      expect(ALLOWED_DATA_KEYS.has(key)).toBe(true);
    }
  });
});

describe("FIELD_MAX truncation", () => {
  it("truncates long string values to the configured max", () => {
    const longComment = "x".repeat(2000);
    const result = validateSubmission({
      type: "petition_sign",
      page_id: "test-page",
      data: { comment: longComment },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.result.data.comment as string).length).toBe(FIELD_MAX.comment);
    }
  });

  it("truncates letter_body to its specific limit", () => {
    const longBody = "y".repeat(10000);
    const result = validateSubmission({
      type: "letter_sent",
      page_id: "test-page",
      data: { letter_body: longBody },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.result.data.letter_body as string).length).toBe(FIELD_MAX.letter_body);
    }
  });

  it("applies default 1000 cap to fields without explicit limit", () => {
    const longName = "z".repeat(2000);
    const result = validateSubmission({
      type: "petition_sign",
      page_id: "test-page",
      data: { first_name: longName },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.result.data.first_name as string).length).toBe(1000);
    }
  });

  it("does not truncate values within the limit", () => {
    const result = validateSubmission({
      type: "petition_sign",
      page_id: "test-page",
      data: { first_name: "Ada" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.data.first_name).toBe("Ada");
    }
  });
});
