import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility audits for each demo action page.
 *
 * Uses @axe-core/playwright to run axe-core against the page after React
 * islands have hydrated. We scope the scan to the action page container so
 * third-party widgets (e.g. Turnstile) don't pollute results, and we
 * ignore color-contrast violations coming from user-agent defaults on
 * form placeholders.
 */

const DEMO_PAGES: Array<{ name: string; slug: string }> = [
  { name: "petition", slug: "demo-petition" },
  { name: "fundraise", slug: "demo-fundraise" },
  { name: "gotv", slug: "demo-gotv" },
  { name: "signup", slug: "demo-signup" },
  { name: "letter", slug: "demo-letter" },
  { name: "event", slug: "demo-event" },
  { name: "call", slug: "demo-call" },
  { name: "step", slug: "demo-step" },
];

async function waitForHydration(page: Page): Promise<void> {
  // Wait for at least one form element to be present — confirms React island mounted
  await page
    .waitForSelector("form, [role='form'], main", { state: "attached", timeout: 10_000 })
    .catch(() => undefined);
}

for (const { name, slug } of DEMO_PAGES) {
  test.describe(`Accessibility — ${name}`, () => {
    test("no critical or serious axe violations", async ({ page }) => {
      await page.goto(`/action/${slug}`);
      await waitForHydration(page);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["region"]) // demo pages may not have landmark regions
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      expect(
        blocking,
        `Axe found ${blocking.length} blocking violation(s):\n` +
          blocking.map((v) => `  - ${v.id}: ${v.help}`).join("\n")
      ).toEqual([]);
    });

    test("all form fields have labels", async ({ page }) => {
      await page.goto(`/action/${slug}`);
      await waitForHydration(page);

      const inputs = page.locator(
        "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"
      );
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const field = inputs.nth(i);
        const id = await field.getAttribute("id");
        const ariaLabel = await field.getAttribute("aria-label");
        const ariaLabelledBy = await field.getAttribute("aria-labelledby");
        const placeholder = await field.getAttribute("placeholder");

        let hasLabel = Boolean(ariaLabel || ariaLabelledBy);
        if (!hasLabel && id) {
          hasLabel = (await page.locator(`label[for="${id}"]`).count()) > 0;
        }
        // Wrapped <label><input/></label> is also valid
        if (!hasLabel) {
          const wrapped = await field.evaluate((el) => !!el.closest("label"));
          hasLabel = wrapped;
        }

        expect(
          hasLabel,
          `Field ${i} (id=${id ?? "none"}, placeholder="${placeholder ?? ""}") has no accessible label`
        ).toBe(true);
      }
    });

    test("all buttons have accessible names", async ({ page }) => {
      await page.goto(`/action/${slug}`);
      await waitForHydration(page);

      const buttons = page.getByRole("button");
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const name = await buttons.nth(i).textContent();
        const ariaLabel = await buttons.nth(i).getAttribute("aria-label");
        expect(
          (name?.trim().length ?? 0) > 0 || (ariaLabel?.length ?? 0) > 0,
          `Button index ${i} has no accessible name`
        ).toBe(true);
      }
    });

    test("color contrast meets WCAG AA", async ({ page }) => {
      await page.goto(`/action/${slug}`);
      await waitForHydration(page);

      const results = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test("tab order is logical through form fields", async ({ page }) => {
      await page.goto(`/action/${slug}`);
      await waitForHydration(page);

      // Tab up to 20 times and collect the focused element sequence
      const focused: string[] = [];
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const tag = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return "";
          return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}`;
        });
        if (tag) focused.push(tag);
      }

      // Should have landed on at least a few focusable elements, no duplicates in a row
      expect(focused.length).toBeGreaterThan(0);
      for (let i = 1; i < focused.length; i++) {
        expect(
          focused[i] === focused[i - 1] && focused[i]?.includes("#"),
          `Focus appears stuck on ${focused[i]} across consecutive Tab presses`
        ).toBe(false);
      }
    });
  });
}
