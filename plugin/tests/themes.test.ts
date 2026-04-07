import { describe, it, expect } from "vitest";
import { themes, resolveTheme, type Theme } from "../src/components/themes/index.js";

const REQUIRED_PROPERTIES: (keyof Theme)[] = [
  "--page-bg",
  "--page-text",
  "--page-accent",
  "--page-secondary",
  "--page-border",
  "--page-radius",
  "--page-font-serif",
  "--page-font-mono",
];

describe("theme registry", () => {
  it("has 3 built-in entries", () => {
    expect(themes.keys()).toHaveLength(3);
    expect(themes.keys()).toEqual(expect.arrayContaining(["warm", "bold", "clean"]));
  });

  it("all built-in themes have required CSS properties", () => {
    for (const key of themes.keys()) {
      const theme = themes.get(key)!;
      for (const prop of REQUIRED_PROPERTIES) {
        expect(theme[prop], `${key} missing ${prop}`).toBeDefined();
        expect(typeof theme[prop]).toBe("string");
      }
    }
  });
});

describe("resolveTheme", () => {
  it("returns warm when called with no argument", () => {
    const result = resolveTheme();
    expect(result).toEqual(themes.get("warm"));
  });

  it("resolves a string key to the built-in theme", () => {
    const result = resolveTheme("bold");
    expect(result).toEqual(themes.get("bold"));
  });

  it("falls back to warm for unknown key", () => {
    const result = resolveTheme("nonexistent");
    expect(result).toEqual(themes.get("warm"));
  });

  it("merges a custom object over warm defaults", () => {
    const custom = { "--page-bg": "#ff0000", "--page-accent": "#00ff00" };
    const result = resolveTheme(custom);

    // Custom values applied
    expect(result["--page-bg"]).toBe("#ff0000");
    expect(result["--page-accent"]).toBe("#00ff00");

    // Remaining values inherited from warm
    const warm = themes.get("warm")!;
    expect(result["--page-text"]).toBe(warm["--page-text"]);
    expect(result["--page-border"]).toBe(warm["--page-border"]);
    expect(result["--page-radius"]).toBe(warm["--page-radius"]);
  });

  it("ignores custom keys that don't start with --page-", () => {
    const custom = { "--page-bg": "#ff0000", "--random-prop": "nope" };
    const result = resolveTheme(custom);

    expect(result["--page-bg"]).toBe("#ff0000");
    expect((result as unknown as Record<string, string>)["--random-prop"]).toBeUndefined();
  });
});
