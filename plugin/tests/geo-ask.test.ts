import { describe, it, expect } from "vitest";
import { resolveJurisdiction, DEFAULT_AMOUNTS } from "../src/modules/geo-ask.js";

describe("resolveJurisdiction", () => {
  it("returns region when present", () => {
    expect(resolveJurisdiction({ country: "US", region: "TX" })).toBe("TX");
  });

  it("falls back to FED when no region", () => {
    expect(resolveJurisdiction({ country: "US", region: "" })).toBe("FED");
  });

  it("falls back to FED for non-US without region", () => {
    expect(resolveJurisdiction({ country: "GB", region: "" })).toBe("FED");
  });
});

describe("DEFAULT_AMOUNTS", () => {
  it("provides fixed donation amounts", () => {
    expect(DEFAULT_AMOUNTS).toEqual([10, 25, 50, 100, 250]);
  });
});
