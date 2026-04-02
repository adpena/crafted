import { describe, it, expect } from "vitest";
import { personalize, DEFAULT_AMOUNTS } from "../src/modules/geo-ask.js";

describe("personalize", () => {
  it("returns jurisdiction from region", () => {
    const result = personalize({ country: "US", region: "TX" });
    expect(result.jurisdiction).toBe("TX");
  });

  it("falls back to FED when no region", () => {
    const result = personalize({ country: "US", region: "" });
    expect(result.jurisdiction).toBe("FED");
  });

  it("generates context line with city and region", () => {
    const result = personalize({ country: "US", region: "TX", city: "Austin" });
    expect(result.context_line).toBe("Showing information for Austin, TX");
  });

  it("returns null context line without city", () => {
    const result = personalize({ country: "US", region: "TX" });
    expect(result.context_line).toBeNull();
  });

  it("sets en-US locale for US visitors", () => {
    const result = personalize({ country: "US", region: "CA" });
    expect(result.locale_hint).toBe("en-US");
  });

  it("sets en locale for non-US visitors", () => {
    const result = personalize({ country: "GB", region: "" });
    expect(result.locale_hint).toBe("en");
  });
});

describe("DEFAULT_AMOUNTS", () => {
  it("provides fixed donation amounts", () => {
    expect(DEFAULT_AMOUNTS).toEqual([10, 25, 50, 100, 250]);
  });
});
