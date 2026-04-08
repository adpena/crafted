/**
 * Tests for the HeroBlocks template + validateHeroBlocks helper.
 *
 * Rendering is validated via react-dom/server for stable string output
 * without pulling in the full testing-library runtime.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  HeroBlocks,
  validateHeroBlocks,
  MAX_HERO_BLOCKS,
  type HeroBlock,
} from "../src/components/templates/HeroBlocks.js";

function render(blocks: HeroBlock[]): string {
  return renderToStaticMarkup(createElement(HeroBlocks, { blocks }));
}

describe("HeroBlocks render", () => {
  it("renders nothing for empty blocks array", () => {
    expect(render([])).toBe("");
  });

  it("renders a headline", () => {
    const html = render([{ id: "a", type: "headline", text: "Hello" }]);
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
  });

  it("renders subhead + body + pull_quote in order", () => {
    const html = render([
      { id: "1", type: "headline", text: "Big Idea" },
      { id: "2", type: "subhead", text: "Small caption" },
      { id: "3", type: "body", text: "First paragraph.\n\nSecond paragraph." },
      { id: "4", type: "pull_quote", text: "Memorable line", attribution: "Source" },
    ]);
    expect(html).toContain("Big Idea");
    expect(html).toContain("Small caption");
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
    expect(html).toContain("Memorable line");
    expect(html).toContain("Source");
    // Order check: headline before quote
    expect(html.indexOf("Big Idea")).toBeLessThan(html.indexOf("Memorable line"));
  });

  it("splits body paragraphs on double newlines", () => {
    const html = render([
      { id: "1", type: "body", text: "Alpha\n\nBeta\n\nGamma" },
    ]);
    const pCount = (html.match(/<p /g) ?? []).length;
    expect(pCount).toBeGreaterThanOrEqual(3);
  });

  it("renders an image with alt + credit", () => {
    const html = render([
      { id: "1", type: "image", url: "https://example.com/a.jpg", alt: "Alpha", credit: "Photographer" },
    ]);
    expect(html).toContain(`src="https://example.com/a.jpg"`);
    expect(html).toContain(`alt="Alpha"`);
    expect(html).toContain("Photographer");
  });

  it("skips image block with no url", () => {
    const html = render([{ id: "1", type: "image", url: "" }]);
    // Empty wrapper but no img tag
    expect(html).not.toContain("<img");
  });

  it("renders a divider as <hr>", () => {
    const html = render([{ id: "1", type: "divider" }]);
    expect(html).toContain("<hr");
  });

  it("renders a spacer with clamped height", () => {
    const html = render([{ id: "1", type: "spacer", height: 100 }]);
    // Clamped to 8 (max)
    expect(html).toContain('height:8rem');
  });

  it("honors block ordering — reversed blocks render in reversed order", () => {
    const asc = render([
      { id: "1", type: "headline", text: "FIRST" },
      { id: "2", type: "headline", text: "SECOND" },
    ]);
    const rev = render([
      { id: "2", type: "headline", text: "SECOND" },
      { id: "1", type: "headline", text: "FIRST" },
    ]);
    expect(asc.indexOf("FIRST")).toBeLessThan(asc.indexOf("SECOND"));
    expect(rev.indexOf("SECOND")).toBeLessThan(rev.indexOf("FIRST"));
  });

  it("renders rich_text as HTML", () => {
    const html = render([{ id: "1", type: "rich_text", html: "<em>italic</em>" }]);
    expect(html).toContain("<em>italic</em>");
  });
});

describe("validateHeroBlocks", () => {
  it("returns [] for non-arrays", () => {
    expect(validateHeroBlocks(null)).toEqual([]);
    expect(validateHeroBlocks(undefined)).toEqual([]);
    expect(validateHeroBlocks("not array")).toEqual([]);
    expect(validateHeroBlocks(42)).toEqual([]);
  });

  it("drops invalid entries", () => {
    const out = validateHeroBlocks([
      null,
      "string",
      { type: "unknown", text: "x" },
      { type: "headline" }, // missing text
      { type: "headline", text: "   " }, // blank text
      { type: "image", url: "" }, // blank url
    ]);
    expect(out).toEqual([]);
  });

  it("backfills missing ids with index-based placeholders", () => {
    const out = validateHeroBlocks([
      { type: "headline", text: "First" },
      { type: "subhead", text: "Sub" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe("b0");
    expect(out[1]?.id).toBe("b1");
  });

  it("preserves provided ids", () => {
    const out = validateHeroBlocks([
      { id: "my-headline", type: "headline", text: "x" },
    ]);
    expect(out[0]?.id).toBe("my-headline");
  });

  it("normalizes spacer height to a number with default 1", () => {
    const out = validateHeroBlocks([
      { type: "spacer" },
      { type: "spacer", height: 3 },
      { type: "spacer", height: "nope" },
    ]);
    expect(out).toHaveLength(3);
    expect((out[0] as { height: number }).height).toBe(1);
    expect((out[1] as { height: number }).height).toBe(3);
    expect((out[2] as { height: number }).height).toBe(1);
  });

  it("caps the number of blocks at MAX_HERO_BLOCKS", () => {
    const many = Array.from({ length: MAX_HERO_BLOCKS + 50 }, () => ({
      type: "divider",
    }));
    const out = validateHeroBlocks(many);
    expect(out).toHaveLength(MAX_HERO_BLOCKS);
  });

  it("passes through valid image block with all fields", () => {
    const out = validateHeroBlocks([
      {
        type: "image",
        url: "https://cdn.example.com/x.jpg",
        alt: "desc",
        credit: "Photographer",
      },
    ]);
    expect(out[0]).toMatchObject({
      type: "image",
      url: "https://cdn.example.com/x.jpg",
      alt: "desc",
      credit: "Photographer",
    });
  });

  it("preserves pull_quote attribution", () => {
    const out = validateHeroBlocks([
      { type: "pull_quote", text: "Quote", attribution: "Author" },
    ]);
    expect(out[0]).toMatchObject({
      type: "pull_quote",
      text: "Quote",
      attribution: "Author",
    });
  });
});
