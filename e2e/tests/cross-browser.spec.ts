import { test, expect, type Route } from "@playwright/test";

/**
 * Cross-browser smoke test for the critical petition flow.
 *
 * This spec runs against every configured project (chromium, firefox,
 * webkit) automatically — Playwright's project matrix takes care of
 * spinning up each browser engine. We only test the single highest-value
 * flow here: fill + submit a petition and confirm the network round-trip
 * fires the expected payload. The full action coverage lives in
 * action-flows.spec.ts.
 */

const SUBMIT_OK = {
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data: { ok: true, id: "cross-browser-test" } }),
};

test.describe("Cross-browser petition flow", () => {
  test("fills and submits petition on every engine", async ({ page, browserName }) => {
    await page.route("**/api/action/submit", (route: Route) => route.fulfill(SUBMIT_OK));

    await page.goto("/action/demo-petition");

    // Hydration — wait for the island mount
    await page.waitForSelector("#petition-first-name", { state: "visible" });

    await page.locator("#petition-first-name").fill("Ada");
    await page.locator("#petition-last-name").fill("Lovelace");
    await page.locator("#petition-email").fill(`ada+${browserName}@example.com`);
    await page.locator("#petition-zip").fill("90210");

    const submitRequest = page.waitForRequest(
      (r) => r.url().includes("/api/action/submit") && r.method() === "POST"
    );
    await page.getByRole("button", { name: /sign|submit/i }).click();

    const request = await submitRequest;
    const body = JSON.parse(request.postData() ?? "{}");

    expect(body.type).toBe("petition_sign");
    expect(body.data.first_name).toBe("Ada");
    expect(body.data.email).toContain(browserName);
  });

  test("required field validation fires on every engine", async ({ page }) => {
    await page.route("**/api/action/submit", (route: Route) => route.fulfill(SUBMIT_OK));
    await page.goto("/action/demo-petition");
    await page.waitForSelector("#petition-first-name", { state: "visible" });

    await page.getByRole("button", { name: /sign|submit/i }).click();

    // At least one role=alert should become non-empty
    const alerts = page.getByRole("alert");
    await expect(alerts.first()).toBeVisible();
  });
});
