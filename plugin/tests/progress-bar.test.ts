import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ProgressBar, type ProgressBarProps } from "../src/components/ProgressBar.js";

/** Helper to render ProgressBar to HTML string */
function render(props: ProgressBarProps): string | null {
  const el = createElement(ProgressBar, props);
  if (el === null) return null;
  try {
    return renderToString(el);
  } catch {
    return null;
  }
}

describe("ProgressBar", () => {
  describe("null rendering", () => {
    it("returns null when goal is 0", () => {
      const result = ProgressBar({ current: 10, goal: 0 });
      expect(result).toBeNull();
    });

    it("returns null when goal is negative", () => {
      const result = ProgressBar({ current: 10, goal: -5 });
      expect(result).toBeNull();
    });
  });

  describe("bar mode (default)", () => {
    it("renders progressbar role", () => {
      const html = render({ current: 50, goal: 100 });
      expect(html).not.toBeNull();
      expect(html).toContain('role="progressbar"');
    });

    it("shows formatted count and goal", () => {
      const html = render({ current: 1234, goal: 5000 });
      expect(html).toContain("1,234");
      expect(html).toContain("5,000");
    });

    it("shows signatures label by default", () => {
      const html = render({ current: 50, goal: 100 });
      expect(html).toContain("signatures");
    });
  });

  describe("thermometer mode", () => {
    it("renders percentage", () => {
      const html = render({ current: 75, goal: 100, mode: "thermometer" });
      expect(html).toContain("75%");
    });

    it("renders progressbar role", () => {
      const html = render({ current: 50, goal: 100, mode: "thermometer" });
      expect(html).toContain('role="progressbar"');
    });

    it("caps percentage at 100%", () => {
      const html = render({ current: 150, goal: 100, mode: "thermometer" });
      expect(html).toContain("100%");
    });
  });

  describe("countdown mode", () => {
    it("shows days and hours remaining", () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      future.setHours(future.getHours() + 5);
      const html = render({
        current: 50,
        goal: 100,
        mode: "countdown",
        deadline: future.toISOString(),
      });
      expect(html).toContain("10");
      expect(html).toContain("remaining");
    });

    it("shows red urgency color when days <= 3", () => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      const html = render({
        current: 50,
        goal: 100,
        mode: "countdown",
        deadline: future.toISOString(),
      });
      // #dc2626 is the red urgency color
      expect(html).toContain("#dc2626");
    });

    it("shows orange urgency color when days <= 7", () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const html = render({
        current: 50,
        goal: 100,
        mode: "countdown",
        deadline: future.toISOString(),
      });
      // #ea580c is the orange urgency color
      expect(html).toContain("#ea580c");
    });

    it("shows 'Deadline passed' when deadline is in the past", () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      const html = render({
        current: 50,
        goal: 100,
        mode: "countdown",
        deadline: past.toISOString(),
      });
      expect(html).toContain("Deadline passed");
    });
  });

  describe("i18n", () => {
    it("Spanish locale shows 'firmas' for signatures", () => {
      const html = render({
        current: 50,
        goal: 100,
        labelKey: "progress_signatures",
        locale: "es",
      });
      expect(html).toContain("firmas");
    });

    it("Spanish locale shows 'compromisos' for pledges", () => {
      const html = render({
        current: 50,
        goal: 100,
        labelKey: "progress_pledges",
        locale: "es",
      });
      expect(html).toContain("compromisos");
    });
  });
});
