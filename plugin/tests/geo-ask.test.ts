import { describe, it, expect } from "vitest";
import { suggestAmounts, type AmountConfig, type GeoContext } from "../src/modules/geo-ask.js";

const config: AmountConfig = {
  base: [10, 25, 50, 100, 250],
  regions: {
    "US-CA": { multiplier: 1.4 },
    "US-NY": { multiplier: 1.3 },
  },
  fallback_multiplier: 1.0,
};

describe("suggestAmounts", () => {
  it("applies regional multiplier for known US region", () => {
    const geo: GeoContext = { country: "US", region: "CA" };
    expect(suggestAmounts(config, geo)).toEqual([14, 35, 70, 140, 350]);
  });

  it("uses fallback multiplier for unknown US region", () => {
    const geo: GeoContext = { country: "US", region: "TX" };
    expect(suggestAmounts(config, geo)).toEqual([10, 25, 50, 100, 250]);
  });

  it("uses fallback for non-US country", () => {
    const geo: GeoContext = { country: "GB", region: "LDN" };
    expect(suggestAmounts(config, geo)).toEqual([10, 25, 50, 100, 250]);
  });

  it("rounds to nearest whole dollar", () => {
    const oddConfig: AmountConfig = {
      base: [7, 15],
      regions: { "US-CA": { multiplier: 1.15 } },
      fallback_multiplier: 1.0,
    };
    const geo: GeoContext = { country: "US", region: "CA" };
    // 7 * 1.15 = 8.05 → 8, 15 * 1.15 = 17.25 → 17
    expect(suggestAmounts(oddConfig, geo)).toEqual([8, 17]);
  });
});
