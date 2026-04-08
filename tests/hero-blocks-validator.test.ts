/**
 * Tests for the server-side hero-blocks validator used by the MCP
 * create_page endpoint.
 */

import { describe, it, expect } from "vitest";
import {
  validateHeroBlocksServer,
  MAX_HERO_BLOCKS,
  MAX_TEXT_BYTES,
  MAX_RICH_TEXT_BYTES,
  MAX_SPACER_REM,
} from "../src/lib/hero-blocks-validator.ts";

describe("validateHeroBlocksServer", () => {
  it("rejects non-arrays", () => {
    const r = validateHeroBlocksServer("not an array");
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/must be an array/);
  });

  it("rejects non-object entries", () => {
    const r = validateHeroBlocksServer([null, "string", 42, ["arr"]]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected).toHaveLength(4);
  });

  it("accepts a minimal headline block", () => {
    const r = validateHeroBlocksServer([{ type: "headline", text: "Hello" }]);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toMatchObject({ type: "headline", text: "Hello" });
    expect(r.blocks[0]?.id).toBe("b0");
  });

  it("preserves valid ids (under 64 chars)", () => {
    const r = validateHeroBlocksServer([
      { id: "my-block", type: "headline", text: "x" },
    ]);
    expect(r.blocks[0]?.id).toBe("my-block");
  });

  it("replaces too-long ids with index fallback", () => {
    const r = validateHeroBlocksServer([
      { id: "a".repeat(200), type: "headline", text: "x" },
    ]);
    expect(r.blocks[0]?.id).toBe("b0");
  });

  it("rejects blocks with blank text", () => {
    const r = validateHeroBlocksServer([
      { type: "headline", text: "   " },
      { type: "headline" },
    ]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected).toHaveLength(2);
  });

  it("rejects text fields over MAX_TEXT_BYTES", () => {
    const big = "x".repeat(MAX_TEXT_BYTES + 1);
    const r = validateHeroBlocksServer([{ type: "body", text: big }]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/bytes/);
  });

  it("rejects image blocks with http:// urls", () => {
    const r = validateHeroBlocksServer([
      { type: "image", url: "http://insecure.example.com/x.jpg" },
    ]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/https/);
  });

  it("rejects image blocks with malformed urls", () => {
    const r = validateHeroBlocksServer([
      { type: "image", url: "not a url" },
    ]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/invalid url/);
  });

  it("accepts image blocks with https + alt + credit", () => {
    const r = validateHeroBlocksServer([
      {
        type: "image",
        url: "https://cdn.example.com/photo.jpg",
        alt: "Description",
        credit: "Photographer",
      },
    ]);
    expect(r.blocks[0]).toMatchObject({
      type: "image",
      url: "https://cdn.example.com/photo.jpg",
      alt: "Description",
      credit: "Photographer",
    });
  });

  it("clamps spacer height to 0..MAX_SPACER_REM", () => {
    const r = validateHeroBlocksServer([
      { type: "spacer", height: -5 },
      { type: "spacer", height: 999 },
      { type: "spacer", height: 3 },
    ]);
    expect(r.blocks[0]).toMatchObject({ type: "spacer", height: 0 });
    expect(r.blocks[1]).toMatchObject({ type: "spacer", height: MAX_SPACER_REM });
    expect(r.blocks[2]).toMatchObject({ type: "spacer", height: 3 });
  });

  it("defaults spacer height to 1 when missing", () => {
    const r = validateHeroBlocksServer([{ type: "spacer" }]);
    expect(r.blocks[0]?.height).toBe(1);
  });

  it("accepts a divider with no fields", () => {
    const r = validateHeroBlocksServer([{ type: "divider" }]);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]?.type).toBe("divider");
  });

  it("rejects rich_text with no html", () => {
    const r = validateHeroBlocksServer([{ type: "rich_text", html: "" }]);
    expect(r.blocks).toEqual([]);
  });

  it("rejects rich_text over MAX_RICH_TEXT_BYTES", () => {
    const big = "x".repeat(MAX_RICH_TEXT_BYTES + 1);
    const r = validateHeroBlocksServer([{ type: "rich_text", html: big }]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/bytes/);
  });

  it("rejects unknown types", () => {
    const r = validateHeroBlocksServer([{ type: "whatever", text: "x" }]);
    expect(r.blocks).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/unknown type/);
  });

  it("enforces MAX_HERO_BLOCKS cap", () => {
    const many = Array.from({ length: MAX_HERO_BLOCKS + 5 }, (_, i) => ({
      type: "headline",
      text: `h${i}`,
    }));
    const r = validateHeroBlocksServer(many);
    expect(r.blocks).toHaveLength(MAX_HERO_BLOCKS);
    expect(r.rejected).toHaveLength(5);
  });

  it("processes mixed valid + invalid entries, keeping valid ones", () => {
    const r = validateHeroBlocksServer([
      { type: "headline", text: "Keep" },
      { type: "image", url: "http://drop.me/x.jpg" },
      { type: "body", text: "Keep body" },
      { type: "divider" },
      { type: "unknown", text: "drop" },
    ]);
    expect(r.blocks.map((b) => b.type)).toEqual([
      "headline",
      "body",
      "divider",
    ]);
    expect(r.rejected).toHaveLength(2);
  });

  it("normalizes image url via URL constructor (collapses trailing slash etc)", () => {
    const r = validateHeroBlocksServer([
      { type: "image", url: "https://cdn.example.com:443/path/?a=1#f" },
    ]);
    // URL constructor normalizes default port and serializes consistently
    expect(r.blocks[0]?.url).toBe("https://cdn.example.com/path/?a=1#f");
  });
});
