import { test, expect, type Page } from "@playwright/test";

/**
 * Responsive layout tests for every demo action page.
 *
 * Verifies mobile / tablet / desktop break points:
 *  - No horizontal scroll at any size
 *  - Tap targets are >= 44x44 px on mobile (WCAG 2.5.5 / Apple HIG)
 *  - Inputs are usable at mobile width
 *  - Hero headlines don't overflow their container
 */

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

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

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
}

for (const { name: pageName, slug } of DEMO_PAGES) {
  test.describe(`Responsive — ${pageName}`, () => {
    for (const viewport of VIEWPORTS) {
      test(`${viewport.name} (${viewport.width}x${viewport.height}) — no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/action/${slug}`);
        await page.waitForSelector("form, main", { state: "attached" });

        expect(await hasHorizontalScroll(page)).toBe(false);
      });

      test(`${viewport.name} — form inputs render and are visible`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/action/${slug}`);
        await page.waitForSelector("form, main", { state: "attached" });

        const firstInput = page
          .locator("input:not([type='hidden']), textarea, select, button[type='submit']")
          .first();
        if ((await firstInput.count()) > 0) {
          await expect(firstInput).toBeVisible();
        }
      });

      test(`${viewport.name} — hero headline does not overflow`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/action/${slug}`);
        await page.waitForSelector("form, main", { state: "attached" });

        const heading = page.locator("h1, h2").first();
        if ((await heading.count()) === 0) return;

        const overflow = await heading.evaluate((el) => {
          return el.scrollWidth > el.clientWidth + 1;
        });
        expect(overflow).toBe(false);
      });
    }

    test("mobile — all tap targets are at least 44x44 px", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/action/${slug}`);
      await page.waitForSelector("form, main", { state: "attached" });

      const tappable = page.locator(
        "button, a, input[type='submit'], input[type='button'], input[type='checkbox'], input[type='radio'], [role='button']"
      );
      const count = await tappable.count();

      for (let i = 0; i < count; i++) {
        const el = tappable.nth(i);
        if (!(await el.isVisible())) continue;

        const box = await el.boundingBox();
        if (!box) continue;

        // Allow checkboxes/radios with a wrapping label — they inherit the
        // label's clickable region. We only enforce 44x44 on standalone targets.
        const wrappedInLabel = await el.evaluate((node) => !!node.closest("label"));
        if (wrappedInLabel) continue;

        expect(
          box.width >= 44 && box.height >= 44,
          `Tap target ${i} is ${box.width.toFixed(0)}x${box.height.toFixed(0)} — below 44x44`
        ).toBe(true);
      }
    });
  });
}
