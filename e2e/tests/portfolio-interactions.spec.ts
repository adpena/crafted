import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import campusData from "../../src/data/portfolio/teadata-example.json" with { type: "json" };
import payData from "../../src/data/portfolio/pay-history.json" with { type: "json" };

const interactivePages = [
  "/work/dev/teadata", "/work/design/respect-campaign-map", "/work/dev/comma-lab",
  "/work/policy/hb2-support-staff-raises", "/work/policy/fiscal-impact-of-charter-school-expansion",
  "/demo/molt", "/demo/notifications", "/demo/inflation",
];

async function openExhibit(page: Page, path: string) {
  await page.goto(path);
  const control = page.locator(".artifact-panel select").first();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeEnabled();
}

test("controls fit narrow, tablet, and desktop layouts, including enlarged text", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of interactivePages) {
    await openExhibit(page, path);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const controls = await page.locator(".artifact-panel :is(input, select, textarea, button, summary):visible").evaluateAll((els) => els.filter((el) => el.isConnected).map((el) => {
        const rect = el.getBoundingClientRect();
        return { name: el.getAttribute("aria-label") || el.textContent?.slice(0, 35), left: rect.left, right: rect.right, height: rect.height, font: parseFloat(getComputedStyle(el).fontSize), form: /INPUT|SELECT|TEXTAREA/.test(el.tagName) };
      }));
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(control.left, `${path} ${width}: ${control.name}`).toBeGreaterThanOrEqual(0);
        expect(control.right, `${path} ${width}: ${control.name}`).toBeLessThanOrEqual(width + 1);
        expect(control.height, `${path}: ${control.name}`).toBeGreaterThanOrEqual(44);
        if (control.form) expect(control.font, `${path}: ${control.name}`).toBeGreaterThanOrEqual(16);
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    // Inspect element bounds: the site's overflow-x rule can mask page-wide overflow.
    const clipped = await page.locator(".artifact-panel :is(input, select, textarea, button, summary, .artifact-metrics dd, .score-row):visible").evaluateAll((els) => els.filter((el) => {
      const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
    }).map((el) => el.outerHTML.slice(0, 180)));
    expect(clipped, `${path} at 200% text size`).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("campus columns can be reached by buttons and keyboard, and empty filters recover", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await openExhibit(page, "/work/dev/teadata");
  const table = page.getByRole("region", { name: "Campus query results", exact: true });
  const right = page.getByRole("button", { name: "Scroll Campus query results right" });
  const left = page.getByRole("button", { name: "Scroll Campus query results left" });
  await expect(left).toBeDisabled();
  const steps = await table.evaluate((el) => Math.ceil((el.scrollWidth - el.clientWidth) / (el.clientWidth * .75)));
  for (let i = 0; i < steps; i++) await right.click();
  await expect(right).toBeDisabled();
  const lastCell = table.locator("tbody tr").first().locator("td").last();
  const bounds = await table.boundingBox();
  const cell = await lastCell.boundingBox();
  expect(cell!.x + cell!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  await table.focus();
  const before = await table.evaluate((el) => el.scrollLeft);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeLessThan(before);
  // One-campus districts give a deterministic empty result with the opposite rating.
  const single = campusData.rows.find((r) => campusData.rows.filter((other) => other.district === r.district).length === 1)!;
  await page.getByLabel("District", { exact: true }).selectOption(single.district);
  await page.getByLabel("2025 rating", { exact: true }).selectOption(single.rating === "D" ? "F" : "D");
  await expect(page.getByRole("status")).toContainText("No campuses");
  await expect(table).toHaveCount(0);
  await page.getByLabel("2025 rating", { exact: true }).selectOption("all");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(right).toHaveCount(0);
});

test("district search explains retained results and recovers in every research explorer", async ({ page }) => {
  for (const path of [interactivePages[1], interactivePages[3], interactivePages[4]]) {
    await openExhibit(page, path);
    const search = page.getByRole("searchbox", { name: "Find a district" });
    const select = page.getByLabel("District", { exact: true });
    const status = page.getByRole("status");
    await search.fill("no matching district xyz");
    await expect(select).toBeDisabled();
    await expect(status).toContainText("No matching districts");
    await expect(status).toContainText("Showing AUSTIN ISD");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");
    await expect(select).toBeEnabled();
    await search.fill("  houston isd  ");
    await expect(select).toHaveValue("");
    const option = select.locator("option").filter({ hasText: /^HOUSTON ISD ·/ });
    await select.selectOption((await option.getAttribute("value"))!);
    await expect(status).toContainText("Showing HOUSTON ISD");
    await expect(page.locator(".artifact-panel").filter({ has: search })).toContainText("HOUSTON ISD");
  }
});

test("map selection and the district selector update the same comparison", async ({ page, isMobile }) => {
  await openExhibit(page, "/work/design/respect-campaign-map");
  const target = payData.find((row) => row.name === "EL PASO ISD")!;
  const shape = page.locator(`.district-map path[data-district="${target.id}"]`);
  await page.locator(".district-map").scrollIntoViewIfNeeded();
  // Use a point inside the actual polygon, not a synthetic click on an SVG bounding box.
  const point = await shape.evaluate((el) => {
    const path = el as SVGPathElement; const box = path.getBBox();
    for (let y = .1; y < 1; y += .1) for (let x = .1; x < 1; x += .1) {
      const p = new DOMPoint(box.x + box.width * x, box.y + box.height * y);
      if (path.isPointInFill(p)) { const screen = p.matrixTransform(path.getScreenCTM()!); return { x: screen.x, y: screen.y }; }
    }
    throw new Error("No interior point found");
  });
  if (isMobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("status")).toContainText("Showing EL PASO ISD");
  await expect(shape).toHaveAttribute("stroke-width", "2.5");
  const select = page.getByLabel("District", { exact: true });
  await select.focus();
  await expect(select).toBeFocused();
  await select.selectOption(payData.find((row) => row.name === "AUSTIN ISD")!.id);
  await expect(page.getByRole("status")).toContainText("Showing AUSTIN ISD");
  await page.getByLabel("Compare with", { exact: true }).selectOption(target.id);
  await expect(page.getByRole("status")).toContainText("comparing with EL PASO ISD");
  await expect(page.getByRole("region", { name: "District pay comparison" }).locator("thead")).toContainText("EL PASO ISD");
});

test("source disclosures open and close by keyboard", async ({ page }) => {
  await openExhibit(page, "/work/dev/teadata");
  const summary = page.locator("summary").filter({ hasText: "Run the same query in Python" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details pre")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("details pre")).toBeHidden();
  await expect(summary).toBeFocused();
});

test("Molt recovers from worker and source failures without reloading", async ({ page }) => {
  let failSource = true;
  let failWorker = true;
  await page.route("**/molt-compiled/*.py", (route) => failSource ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue());
  await page.route("**/molt-compiled/worker.js", (route) => failWorker ? route.fulfill({ contentType: "text/javascript", body: "throw new Error('Test worker failure')" }) : route.continue());
  await openExhibit(page, "/demo/molt");
  await page.locator("summary").filter({ hasText: /^Python source$/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "source preview" })).toContainText("could not be loaded");
  failSource = false;
  await page.getByRole("button", { name: "Retry source preview" }).click();
  await expect(page.locator("details pre")).toContainText("while y < 28:");
  const run = page.getByRole("button", { name: "Run compiled Python" });
  await run.click();
  await expect(page.getByRole("status").filter({ hasText: "Could not start" })).toContainText("try again");
  await expect(run).toBeEnabled();
  failWorker = false;
  await page.getByLabel("Python example").selectOption("word-count");
  for (let i = 0; i < 2; i++) {
    await run.click();
    await expect(page.locator(".molt-output")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Finished" })).toBeVisible();
  }
});

test("Molt can be stopped or time out, then run successfully", async ({ page }) => {
  await page.clock.install();
  await page.route("**/molt-compiled/worker.js", (route) => route.fulfill({ contentType: "text/javascript", body: "self.onmessage = () => {};" }));
  await openExhibit(page, "/demo/molt");
  const run = page.getByRole("button", { name: "Run compiled Python" });
  await run.click();
  await expect(page.getByLabel("Python example")).toBeDisabled();
  await page.getByRole("button", { name: "Stop example" }).click();
  await expect(page.getByRole("status")).toContainText("Stopped");
  await expect(run).toBeFocused();
  await run.click();
  await page.clock.fastForward(31000);
  await expect(page.getByRole("status")).toContainText("timed out");
  await expect(run).toBeEnabled();
  await page.unroute("**/molt-compiled/worker.js");
  await page.getByLabel("Python example").selectOption("word-count");
  await run.click();
  await expect(page.locator(".molt-output")).toBeVisible();
});

test("calculator validation and dispatch controls recover after empty inputs", async ({ page }) => {
  await openExhibit(page, "/demo/inflation");
  await page.getByLabel("Amount in dollars").fill("");
  await expect(page.getByRole("status")).toContainText("Enter an amount");
  await page.getByLabel("Amount in dollars").fill("1000000000001");
  await expect(page.getByRole("status")).toContainText("Enter an amount");
  await page.getByLabel("Amount in dollars").fill("100");
  await expect(page.getByRole("status")).toContainText("$100.00");
  await openExhibit(page, "/demo/notifications");
  const requests: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") requests.push(request.url()); });
  await page.getByLabel("Subject", { exact: true }).fill(" ");
  const run = page.getByRole("button", { name: "Run local dispatch" });
  await expect(run).toBeDisabled();
  await page.getByLabel("Subject", { exact: true }).fill("Local test");
  for (const channel of ["Email", "Slack", "Discord"]) await page.getByLabel(channel, { exact: true }).selectOption("skip");
  await run.click();
  await expect(page.getByRole("status")).toContainText("0 simulated deliveries, 0 failures, 3 skipped");
  await page.getByLabel("Email", { exact: true }).selectOption("success");
  await run.click();
  await expect(page.getByRole("status")).toContainText("1 simulated deliveries, 0 failures, 2 skipped");
  expect(requests).toEqual([]);
});

test("static exhibits remain readable and controls are honest without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 320, height: 850 } });
  const page = await context.newPage();
  for (const path of interactivePages) {
    await page.goto(path);
    // Playwright's text selector intentionally skips noscript nodes.
    await expect(page.locator(".artifact-panel noscript p")).toBeVisible();
    expect(await page.locator(".artifact-panel noscript").textContent()).toContain("Enable JavaScript");
    for (const control of await page.locator(".artifact-panel :is(input, select, textarea, button)").all()) await expect(control).toBeDisabled();
    await expect(page.locator(".artifact-panel h2").first()).toBeVisible();
    await expect(page.locator("#theme-toggle")).toBeHidden();
  }
  await context.close();
});

test("theme toggle works by keyboard, persists, and tolerates blocked storage", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 245, 240)");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(26, 26, 26)");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(232, 232, 227)");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("contact validation catches empty and invalid fields without sending a message", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Browser check");
  await page.getByLabel("Email", { exact: true }).fill("invalid-address");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect(await page.getByLabel("Email", { exact: true }).evaluate((el) => (el as HTMLInputElement).validity.typeMismatch)).toBe(true);
  await expect(page.getByRole("link", { name: "contact@adpena.com" })).toHaveAttribute("href", "mailto:contact@adpena.com");
  expect(posts).toEqual([]);
});

test("changed interaction states remain accessible in dark mode and reduced motion", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [interactivePages[0], interactivePages[1], interactivePages[2], "/demo/molt"]) {
    await openExhibit(page, path);
    await expect(page.locator("html")).toHaveCSS("background-color", "rgb(26, 26, 26)");
    await expect(page.locator(".artifact-panel").first()).toHaveCSS("color", "rgb(232, 232, 227)");
    if (path.includes("respect")) await page.getByRole("searchbox").fill("no matching district xyz");
    if (path.includes("comma")) {
      await page.getByLabel("Submission").selectOption("0");
      await expect(page.getByRole("status")).toContainText("PR #107");
    }
    const result = await new AxeBuilder({ page }).include(".artifact-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.filter((v) => ["critical", "serious"].includes(v.impact || "")), path).toEqual([]);
  }
});
