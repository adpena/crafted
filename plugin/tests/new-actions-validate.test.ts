import { describe, it, expect } from "vitest";
import { validateSubmission, type SubmissionInput } from "../src/modules/validate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomUnicode(length: number): string {
  return Array.from({ length }, () =>
    String.fromCodePoint(Math.floor(Math.random() * 0x10ffff)),
  ).join("");
}

const SQL_INJECTIONS = [
  "'; DROP TABLE users; --",
  "1 OR 1=1",
  "UNION SELECT * FROM secrets",
  "'; DELETE FROM submissions WHERE '1'='1",
  "1; EXEC xp_cmdshell('dir')--",
];

const XSS_STRINGS = [
  "<script>alert(1)</script>",
  "<img onerror=alert(1) src=x>",
  "javascript:alert(1)",
  "<svg onload=alert(1)>",
  '"><script>alert(document.cookie)</script>',
  "<iframe src=javascript:alert(1)>",
];

// ---------------------------------------------------------------------------
// 1. letter_sent
// ---------------------------------------------------------------------------

describe("validate: letter_sent", () => {
  const validData = {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    zip: "02139",
    letter_body: "Please support this bill for our community.",
  };

  it("happy path with all required fields", () => {
    const result = validateSubmission({ type: "letter_sent", data: validData });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sanitized).toBeDefined();
  });

  it("missing first_name", () => {
    const { first_name: _, ...data } = validData;
    const result = validateSubmission({ type: "letter_sent", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: first_name");
  });

  it("missing last_name", () => {
    const { last_name: _, ...data } = validData;
    const result = validateSubmission({ type: "letter_sent", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: last_name");
  });

  it("missing email", () => {
    const { email: _, ...data } = validData;
    const result = validateSubmission({ type: "letter_sent", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: email");
  });

  it("missing zip", () => {
    const { zip: _, ...data } = validData;
    const result = validateSubmission({ type: "letter_sent", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: zip");
  });

  it("missing letter_body", () => {
    const { letter_body: _, ...data } = validData;
    const result = validateSubmission({ type: "letter_sent", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: letter_body");
  });

  it("invalid email format", () => {
    const result = validateSubmission({
      type: "letter_sent",
      data: { ...validData, email: "not-an-email" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid email: email");
  });

  it("empty data object", () => {
    const result = validateSubmission({ type: "letter_sent", data: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("letter_body at exactly 5000 chars is valid", () => {
    const result = validateSubmission({
      type: "letter_sent",
      data: { ...validData, letter_body: "a".repeat(5000) },
    });
    expect(result.valid).toBe(true);
  });

  it("letter_body at 5001 chars is too long", () => {
    const result = validateSubmission({
      type: "letter_sent",
      data: { ...validData, letter_body: "a".repeat(5001) },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("letter_body") && e.includes("too long"))).toBe(true);
  });

  describe("fuzz: random unicode in fields (50 iterations)", () => {
    for (let i = 0; i < 50; i++) {
      it(`iteration ${i}: never throws`, () => {
        const data: Record<string, string> = {};
        for (const key of ["first_name", "last_name", "email", "zip", "letter_body"]) {
          data[key] = randomUnicode(Math.floor(Math.random() * 100));
        }
        const result = validateSubmission({ type: "letter_sent", data });
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("errors");
        expect(typeof result.valid).toBe("boolean");
      });
    }
  });

  describe("fuzz: SQL injection strings", () => {
    SQL_INJECTIONS.forEach((sql, i) => {
      it(`SQL injection #${i} in all fields never throws`, () => {
        const data: Record<string, string> = {};
        for (const key of ["first_name", "last_name", "email", "zip", "letter_body"]) {
          data[key] = sql;
        }
        const result = validateSubmission({ type: "letter_sent", data });
        expect(result).toHaveProperty("valid");
        // email will be invalid but should not throw
      });
    });
  });

  describe("fuzz: XSS strings", () => {
    XSS_STRINGS.forEach((xss, i) => {
      it(`XSS #${i}: tags are stripped from sanitized output`, () => {
        const result = validateSubmission({
          type: "letter_sent",
          data: { ...validData, first_name: xss },
        });
        expect(result.valid).toBe(true);
        expect(String(result.sanitized!.first_name)).not.toContain("<script>");
        expect(String(result.sanitized!.first_name)).not.toContain("<svg");
        expect(String(result.sanitized!.first_name)).not.toContain("<img");
        expect(String(result.sanitized!.first_name)).not.toContain("<iframe");
      });
    });
  });

  describe("fuzz: overly long values exceed MAX_LENGTHS", () => {
    const maxLengths: Record<string, number> = {
      first_name: 100,
      last_name: 100,
      email: 254,
      zip: 10,
      letter_body: 5000,
    };

    for (const [field, max] of Object.entries(maxLengths)) {
      it(`${field} at ${max + 1} chars triggers too-long error`, () => {
        const data = { ...validData, [field]: "a".repeat(max + 1) };
        const result = validateSubmission({ type: "letter_sent", data });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes(field) && e.includes("too long"))).toBe(true);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. event_rsvp
// ---------------------------------------------------------------------------

describe("validate: event_rsvp", () => {
  const validData = {
    first_name: "Grace",
    last_name: "Hopper",
    email: "grace@example.com",
  };

  it("happy path", () => {
    const result = validateSubmission({ type: "event_rsvp", data: validData });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("missing first_name", () => {
    const { first_name: _, ...data } = validData;
    const result = validateSubmission({ type: "event_rsvp", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: first_name");
  });

  it("missing last_name", () => {
    const { last_name: _, ...data } = validData;
    const result = validateSubmission({ type: "event_rsvp", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: last_name");
  });

  it("missing email", () => {
    const { email: _, ...data } = validData;
    const result = validateSubmission({ type: "event_rsvp", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: email");
  });

  it("invalid email", () => {
    const result = validateSubmission({
      type: "event_rsvp",
      data: { ...validData, email: "bad" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid email: email");
  });

  it("empty data object", () => {
    const result = validateSubmission({ type: "event_rsvp", data: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  describe("fuzz: random unicode (50 iterations)", () => {
    for (let i = 0; i < 50; i++) {
      it(`iteration ${i}`, () => {
        const data: Record<string, string> = {};
        for (const key of ["first_name", "last_name", "email"]) {
          data[key] = randomUnicode(Math.floor(Math.random() * 80));
        }
        const result = validateSubmission({ type: "event_rsvp", data });
        expect(result).toHaveProperty("valid");
      });
    }
  });

  describe("fuzz: SQL injection", () => {
    SQL_INJECTIONS.forEach((sql, i) => {
      it(`SQL #${i}`, () => {
        const result = validateSubmission({
          type: "event_rsvp",
          data: { first_name: sql, last_name: sql, email: sql },
        });
        expect(result).toHaveProperty("valid");
      });
    });
  });

  describe("fuzz: XSS strings", () => {
    XSS_STRINGS.forEach((xss, i) => {
      it(`XSS #${i}: tags stripped`, () => {
        const result = validateSubmission({
          type: "event_rsvp",
          data: { ...validData, first_name: xss },
        });
        expect(result.valid).toBe(true);
        expect(String(result.sanitized!.first_name)).not.toContain("<script>");
      });
    });
  });

  describe("fuzz: overly long values", () => {
    for (const [field, max] of Object.entries({ first_name: 100, last_name: 100, email: 254 })) {
      it(`${field} at ${max + 1} chars`, () => {
        const data = { ...validData, [field]: "a".repeat(max + 1) };
        const result = validateSubmission({ type: "event_rsvp", data });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes(field) && e.includes("too long"))).toBe(true);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. call_made
// ---------------------------------------------------------------------------

describe("validate: call_made", () => {
  const validData = {
    first_name: "Alan",
    last_name: "Turing",
    email: "alan@example.com",
    zip: "10001",
  };

  it("happy path", () => {
    const result = validateSubmission({ type: "call_made", data: validData });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("missing first_name", () => {
    const { first_name: _, ...data } = validData;
    const result = validateSubmission({ type: "call_made", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: first_name");
  });

  it("missing last_name", () => {
    const { last_name: _, ...data } = validData;
    const result = validateSubmission({ type: "call_made", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: last_name");
  });

  it("missing email", () => {
    const { email: _, ...data } = validData;
    const result = validateSubmission({ type: "call_made", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: email");
  });

  it("missing zip", () => {
    const { zip: _, ...data } = validData;
    const result = validateSubmission({ type: "call_made", data });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: zip");
  });

  it("invalid email", () => {
    const result = validateSubmission({
      type: "call_made",
      data: { ...validData, email: "nope" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid email: email");
  });

  it("empty data object", () => {
    const result = validateSubmission({ type: "call_made", data: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  describe("fuzz: random unicode (50 iterations)", () => {
    for (let i = 0; i < 50; i++) {
      it(`iteration ${i}`, () => {
        const data: Record<string, string> = {};
        for (const key of ["first_name", "last_name", "email", "zip"]) {
          data[key] = randomUnicode(Math.floor(Math.random() * 80));
        }
        const result = validateSubmission({ type: "call_made", data });
        expect(result).toHaveProperty("valid");
      });
    }
  });

  describe("fuzz: SQL injection", () => {
    SQL_INJECTIONS.forEach((sql, i) => {
      it(`SQL #${i}`, () => {
        const result = validateSubmission({
          type: "call_made",
          data: { first_name: sql, last_name: sql, email: sql, zip: sql },
        });
        expect(result).toHaveProperty("valid");
      });
    });
  });

  describe("fuzz: XSS strings", () => {
    XSS_STRINGS.forEach((xss, i) => {
      it(`XSS #${i}: tags stripped`, () => {
        const result = validateSubmission({
          type: "call_made",
          data: { ...validData, first_name: xss },
        });
        expect(result.valid).toBe(true);
        expect(String(result.sanitized!.first_name)).not.toContain("<script>");
      });
    });
  });

  describe("fuzz: overly long values", () => {
    for (const [field, max] of Object.entries({ first_name: 100, last_name: 100, email: 254, zip: 10 })) {
      it(`${field} at ${max + 1} chars`, () => {
        const data = { ...validData, [field]: "a".repeat(max + 1) };
        const result = validateSubmission({ type: "call_made", data });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes(field) && e.includes("too long"))).toBe(true);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 4. step_form
// ---------------------------------------------------------------------------

describe("validate: step_form", () => {
  it("happy path: empty data is valid (no required fields)", () => {
    const result = validateSubmission({ type: "step_form", data: {} });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("happy path: arbitrary fields pass", () => {
    const result = validateSubmission({
      type: "step_form",
      data: { first_name: "Ada", custom_field: "value" },
    });
    expect(result.valid).toBe(true);
  });

  it("email validated if present: valid email", () => {
    const result = validateSubmission({
      type: "step_form",
      data: { email: "ada@example.com" },
    });
    expect(result.valid).toBe(true);
  });

  it("email validated if present: invalid email", () => {
    const result = validateSubmission({
      type: "step_form",
      data: { email: "not-valid" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid email: email");
  });

  it("email not required: missing email is fine", () => {
    const result = validateSubmission({
      type: "step_form",
      data: { first_name: "Ada" },
    });
    expect(result.valid).toBe(true);
  });

  describe("fuzz: random unicode (50 iterations)", () => {
    for (let i = 0; i < 50; i++) {
      it(`iteration ${i}`, () => {
        const data: Record<string, string> = {};
        const numFields = Math.floor(Math.random() * 10);
        for (let j = 0; j < numFields; j++) {
          data[`field_${j}`] = randomUnicode(Math.floor(Math.random() * 200));
        }
        if (Math.random() < 0.5) {
          data.email = randomUnicode(Math.floor(Math.random() * 50));
        }
        const result = validateSubmission({ type: "step_form", data });
        expect(result).toHaveProperty("valid");
      });
    }
  });

  describe("fuzz: SQL injection", () => {
    SQL_INJECTIONS.forEach((sql, i) => {
      it(`SQL #${i}`, () => {
        const result = validateSubmission({
          type: "step_form",
          data: { first_name: sql, notes: sql },
        });
        expect(result).toHaveProperty("valid");
      });
    });
  });

  describe("fuzz: XSS strings", () => {
    XSS_STRINGS.forEach((xss, i) => {
      it(`XSS #${i}: tags stripped from sanitized`, () => {
        const result = validateSubmission({
          type: "step_form",
          data: { first_name: xss },
        });
        expect(result.valid).toBe(true);
        expect(String(result.sanitized!.first_name)).not.toContain("<script>");
      });
    });
  });

  describe("fuzz: overly long values use default 1000 max", () => {
    it("unknown field at 1001 chars triggers too-long", () => {
      const result = validateSubmission({
        type: "step_form",
        data: { custom_field: "x".repeat(1001) },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("custom_field") && e.includes("too long"))).toBe(true);
    });

    it("unknown field at exactly 1000 chars is valid", () => {
      const result = validateSubmission({
        type: "step_form",
        data: { custom_field: "x".repeat(1000) },
      });
      expect(result.valid).toBe(true);
    });
  });
});
