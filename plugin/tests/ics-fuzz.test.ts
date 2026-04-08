import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Standalone copy of icsEscape from EventRsvpAction.tsx (not exported)
// ---------------------------------------------------------------------------

function icsEscape(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomUnicode(length: number): string {
  return Array.from({ length }, () =>
    String.fromCodePoint(Math.floor(Math.random() * 0x10ffff)),
  ).join("");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("icsEscape", () => {
  it("empty string returns empty string", () => {
    expect(icsEscape("")).toBe("");
  });

  it("plain ASCII passes through", () => {
    expect(icsEscape("Hello World")).toBe("Hello World");
  });

  describe("RFC 5545 special chars", () => {
    it("semicolons are escaped", () => {
      expect(icsEscape("a;b;c")).toBe("a\\;b\\;c");
    });

    it("commas are escaped", () => {
      expect(icsEscape("a,b,c")).toBe("a\\,b\\,c");
    });

    it("backslashes are escaped", () => {
      expect(icsEscape("a\\b")).toBe("a\\\\b");
    });

    it("newlines are escaped", () => {
      expect(icsEscape("line1\nline2")).toBe("line1\\nline2");
    });

    it("carriage returns are stripped", () => {
      expect(icsEscape("line1\rline2")).toBe("line1line2");
    });

    it("CRLF: CR stripped, LF escaped", () => {
      expect(icsEscape("line1\r\nline2")).toBe("line1\\nline2");
    });

    it("all special chars together", () => {
      const input = "a\\b;c,d\ne\rf\r\ng";
      const result = icsEscape(input);
      expect(result).toBe("a\\\\b\\;c\\,d\\nef\\ng");
      expect(result).not.toContain("\r");
    });
  });

  describe("output never contains bare \\r", () => {
    it("single CR", () => {
      expect(icsEscape("\r")).not.toContain("\r");
    });

    it("multiple CRs", () => {
      expect(icsEscape("\r\r\r")).not.toContain("\r");
    });

    it("CR at various positions", () => {
      expect(icsEscape("a\rb\rc\r")).not.toContain("\r");
    });
  });

  describe("fuzz: CRLF injection attempts (100 iterations)", () => {
    for (let i = 0; i < 100; i++) {
      it(`iteration ${i}: output never contains bare \\r`, () => {
        // Build a string with random \r\n placement
        const parts: string[] = [];
        const len = Math.floor(Math.random() * 50) + 5;
        for (let j = 0; j < len; j++) {
          const r = Math.random();
          if (r < 0.15) parts.push("\r");
          else if (r < 0.3) parts.push("\n");
          else if (r < 0.4) parts.push("\r\n");
          else if (r < 0.5) parts.push(";");
          else if (r < 0.6) parts.push(",");
          else if (r < 0.7) parts.push("\\");
          else parts.push(String.fromCharCode(Math.floor(Math.random() * 128)));
        }
        const input = parts.join("");
        const result = icsEscape(input);
        expect(result).not.toContain("\r");
      });
    }
  });

  describe("fuzz: unicode strings (100 iterations)", () => {
    for (let i = 0; i < 100; i++) {
      it(`iteration ${i}: never throws, no bare \\r`, () => {
        const input = randomUnicode(Math.floor(Math.random() * 200) + 1);
        const result = icsEscape(input);
        expect(typeof result).toBe("string");
        expect(result).not.toContain("\r");
      });
    }
  });

  it("very long string (10KB)", () => {
    const input = "a;b,c\\d\ne\rf\r\n".repeat(1000);
    expect(input.length).toBeGreaterThan(10_000);
    const result = icsEscape(input);
    expect(typeof result).toBe("string");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    // Bare semicolons and commas are escaped (prefixed with backslash)
    expect(result).not.toMatch(/(?<!\\);/);
    expect(result).not.toMatch(/(?<!\\),/);
  });

  describe("ICS header injection prevention", () => {
    it("cannot inject VCALENDAR properties via CR", () => {
      const attack = "Meeting\r\nATTENDEE:mailto:evil@evil.com";
      const result = icsEscape(attack);
      expect(result).not.toContain("\r");
      // The newline in \r\n gets escaped to \\n
      expect(result).toContain("\\n");
      expect(result).not.toMatch(/^ATTENDEE:/m);
    });

    it("cannot inject via bare LF", () => {
      const attack = "Meeting\nATTENDEE:mailto:evil@evil.com";
      const result = icsEscape(attack);
      // Real newlines should not survive
      expect(result).not.toContain("\n");
    });
  });
});
