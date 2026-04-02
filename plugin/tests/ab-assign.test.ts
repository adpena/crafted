import { describe, it, expect } from "vitest";
import { hashVisitor, assignVariant } from "../src/modules/ab-assign.js";

describe("hashVisitor", () => {
  it("returns consistent hash for same input", () => {
    const a = hashVisitor("user-123");
    const b = hashVisitor("user-123");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", () => {
    const a = hashVisitor("user-123");
    const b = hashVisitor("user-456");
    expect(a).not.toBe(b);
  });
});

describe("assignVariant", () => {
  it("assigns a variant from the list", () => {
    const variant = assignVariant("user-123", ["control", "treatment"]);
    expect(["control", "treatment"]).toContain(variant);
  });

  it("is deterministic for the same visitor", () => {
    const a = assignVariant("user-123", ["control", "treatment"]);
    const b = assignVariant("user-123", ["control", "treatment"]);
    expect(a).toBe(b);
  });

  it("distributes across variants for 100 visitors", () => {
    const variants = ["control", "treatment"];
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(assignVariant(`visitor-${i}`, variants));
    }
    expect(seen.size).toBe(2);
  });

  it("returns the only variant if list has one entry", () => {
    const variant = assignVariant("user-123", ["solo"]);
    expect(variant).toBe("solo");
  });
});
