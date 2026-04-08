/**
 * Unit tests for the Figma file metadata helpers.
 */

import { describe, it, expect } from "vitest";
import {
  parseFigmaUrl,
  figmaColorToHex,
  collectFigmaColors,
  fetchFigmaMetadata,
} from "../src/lib/figma.ts";

describe("parseFigmaUrl", () => {
  it("parses /file/<key>/... URLs", () => {
    expect(
      parseFigmaUrl("https://www.figma.com/file/ABC123def456/My-Page?node-id=1"),
    ).toBe("ABC123def456");
  });

  it("parses /design/<key>/... URLs", () => {
    expect(
      parseFigmaUrl("https://figma.com/design/XYZ9876543210/Splash"),
    ).toBe("XYZ9876543210");
  });

  it("parses /proto/<key>/... URLs", () => {
    expect(
      parseFigmaUrl("https://www.figma.com/proto/AbC1234567/Demo"),
    ).toBe("AbC1234567");
  });

  it("handles URLs without trailing segment", () => {
    expect(parseFigmaUrl("https://www.figma.com/file/KEY12345")).toBe("KEY12345");
  });

  it("rejects unrelated URLs", () => {
    expect(parseFigmaUrl("https://example.com/file/ABC")).toBeNull();
    expect(parseFigmaUrl("https://figma.com/community/file/123")).toBeNull();
  });

  it("rejects junk input", () => {
    expect(parseFigmaUrl("")).toBeNull();
    expect(parseFigmaUrl("not a url")).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseFigmaUrl(null as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseFigmaUrl(123 as any)).toBeNull();
  });

  it("rejects absurdly long URLs", () => {
    expect(parseFigmaUrl("https://figma.com/file/" + "A".repeat(5000))).toBeNull();
  });
});

describe("figmaColorToHex", () => {
  it("converts 0-1 floats to 6-digit hex", () => {
    expect(figmaColorToHex({ r: 1, g: 0, b: 0 })).toBe("ff0000");
    expect(figmaColorToHex({ r: 0, g: 1, b: 0 })).toBe("00ff00");
    expect(figmaColorToHex({ r: 0, g: 0, b: 1 })).toBe("0000ff");
    expect(figmaColorToHex({ r: 0, g: 0, b: 0 })).toBe("000000");
    expect(figmaColorToHex({ r: 1, g: 1, b: 1 })).toBe("ffffff");
  });

  it("clamps out-of-range values", () => {
    expect(figmaColorToHex({ r: -1, g: 2, b: 0.5 })).toBe("00ff80");
  });
});

describe("collectFigmaColors", () => {
  it("returns empty for a node with no fills", () => {
    expect(collectFigmaColors({ type: "FRAME" })).toEqual([]);
  });

  it("counts solid fills and sorts by usage", () => {
    const doc = {
      type: "DOCUMENT",
      children: [
        { fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }] },
        { fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }] },
        { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }] },
      ],
    };
    const colors = collectFigmaColors(doc);
    expect(colors).toEqual([
      { hex: "ff0000", count: 2 },
      { hex: "0000ff", count: 1 },
    ]);
  });

  it("ignores non-solid fills", () => {
    const doc = {
      children: [
        { fills: [{ type: "GRADIENT_LINEAR", color: { r: 1, g: 0, b: 0 } }] },
        { fills: [{ type: "IMAGE", color: { r: 0, g: 1, b: 0 } }] },
      ],
    };
    expect(collectFigmaColors(doc)).toEqual([]);
  });

  it("ignores invisible fills", () => {
    const doc = {
      children: [
        { fills: [{ type: "SOLID", visible: false, color: { r: 1, g: 0, b: 0 } }] },
      ],
    };
    expect(collectFigmaColors(doc)).toEqual([]);
  });

  it("ignores fully transparent fills", () => {
    const doc = {
      children: [
        { fills: [{ type: "SOLID", opacity: 0, color: { r: 1, g: 0, b: 0 } }] },
        { fills: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 0 } }] },
      ],
    };
    expect(collectFigmaColors(doc)).toEqual([]);
  });

  it("walks deeply-nested trees", () => {
    const deep = {
      children: [{
        children: [{
          children: [{
            fills: [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }],
          }],
        }],
      }],
    };
    const colors = collectFigmaColors(deep);
    expect(colors).toHaveLength(1);
    expect(colors[0]?.hex).toBe("808080");
  });

  it("bounds output by maxColors", () => {
    const doc = {
      children: Array.from({ length: 20 }, (_, i) => ({
        fills: [{
          type: "SOLID" as const,
          color: { r: i / 20, g: 0, b: 0 },
        }],
      })),
    };
    const colors = collectFigmaColors(doc, 5);
    expect(colors).toHaveLength(5);
  });
});

describe("fetchFigmaMetadata", () => {
  const token = "test-token";

  it("rejects invalid URL before calling the API", async () => {
    await expect(
      fetchFigmaMetadata("nope", { token, fetchImpl: (async () => ({ ok: true })) as unknown as typeof fetch }),
    ).rejects.toThrow(/Invalid Figma URL/);
  });

  it("requires a token", async () => {
    await expect(
      fetchFigmaMetadata("https://www.figma.com/file/ABC123def456/x", {
        token: "",
      }),
    ).rejects.toThrow(/FIGMA_ACCESS_TOKEN/);
  });

  it("propagates Figma API errors", async () => {
    const fetchImpl = (async () => ({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    })) as unknown as typeof fetch;
    await expect(
      fetchFigmaMetadata("https://www.figma.com/file/ABC123def456/x", {
        token,
        fetchImpl,
      }),
    ).rejects.toThrow(/Figma API 403/);
  });

  it("returns normalized metadata + colors on success", async () => {
    const payload = {
      name: "My Campaign Page",
      thumbnailUrl: "https://figma.com/thumb.png",
      lastModified: "2026-04-08T12:00:00Z",
      document: {
        children: [
          { fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }] },
          { fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }] },
          { fills: [{ type: "SOLID", color: { r: 0, g: 0.6, b: 1 } }] },
        ],
      },
    };
    const fetchImpl = (async (url: string | URL | Request) => {
      expect(String(url)).toContain("/v1/files/ABC123def456");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => payload,
      };
    }) as unknown as typeof fetch;

    const result = await fetchFigmaMetadata(
      "https://www.figma.com/design/ABC123def456/foo",
      { token, fetchImpl },
    );

    expect(result.file_key).toBe("ABC123def456");
    expect(result.name).toBe("My Campaign Page");
    expect(result.thumbnail_url).toBe("https://figma.com/thumb.png");
    expect(result.last_modified).toBe("2026-04-08T12:00:00Z");
    expect(result.colors[0]).toEqual({ hex: "ff0000", count: 2 });
    expect(result.colors).toContainEqual({ hex: "0099ff", count: 1 });
  });

  it("falls back to file_key when name is missing", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const result = await fetchFigmaMetadata(
      "https://www.figma.com/file/KEY12345/x",
      { token, fetchImpl },
    );
    expect(result.name).toBe("KEY12345");
    expect(result.colors).toEqual([]);
  });
});
