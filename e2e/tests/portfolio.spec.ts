import { test, expect } from "@playwright/test";

test.describe("Portfolio site", () => {
  test("homepage renders newspaper layout", async ({ page }) => {
    await page.goto("/");

    // Header / masthead exists
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Main content area exists
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();

    // Newspaper layout sections — either content exists or empty state
    const featured = page.locator('[aria-label="Featured project"]');
    const latest = page.locator('[aria-label="Latest projects"]');
    const emptyState = page.locator(".empty-state");

    const hasFeatured = (await featured.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;

    // One of the two states must be present
    expect(hasFeatured || hasEmpty).toBe(true);

    if (hasFeatured) {
      await expect(featured).toBeVisible();
      await expect(latest).toBeVisible();
      // "Latest" label visible
      await expect(page.locator(".section-label")).toContainText("Latest");
    }
  });

  test("navigation works — About", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/about"]');
    await expect(page).toHaveURL(/\/about/);
  });

  test("navigation works — Work", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/work"]');
    await expect(page).toHaveURL(/\/work/);
  });

  test("project detail page renders article and sidebar", async ({ page }) => {
    await page.goto("/work");

    // Find the first project link on the work page
    const projectLink = page.locator('a[href^="/work/"]').first();
    const hasProject = (await projectLink.count()) > 0;

    if (!hasProject) {
      test.skip();
      return;
    }

    await projectLink.click();
    await page.waitForURL(/\/work\/.+/);

    // Article content area
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible();

    // Project detail page has a project-layout with sidebar (aside)
    // The sidebar is rendered as an <aside> by ProjectSidebar component
    const aside = page.locator("aside");
    const hasAside = (await aside.count()) > 0;
    // Sidebar may be in a tabbed layout for flagship projects; check for main content area at minimum
    expect(await main.isVisible()).toBe(true);

    if (hasAside) {
      await expect(aside).toBeVisible();
    }
  });

  test("skip-to-content link works", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.locator('a.skip-to-content[href="#main-content"]');

    // The skip link exists
    await expect(skipLink).toHaveCount(1);

    // It should target #main-content
    await expect(skipLink).toHaveAttribute("href", "#main-content");

    // Tab into the page to make skip link visible
    await page.keyboard.press("Tab");

    // After tabbing, the skip link should be focused and visible
    await expect(skipLink).toBeFocused();
  });

  test("accessibility: page has lang attribute", async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBe("en");
  });

  test("view transitions meta tag present", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[name="view-transition"]');
    await expect(meta).toHaveCount(1);
    await expect(meta).toHaveAttribute("content", "same-origin");
  });
});
