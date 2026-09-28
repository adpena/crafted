import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("Molt's browser worker produces the Python program's output", async ({ page }) => {
  await page.goto('/demo/molt');
  for (const name of ['mandelbrot', 'transfer-summary', 'word-count']) {
  await page.getByLabel('Python example').selectOption(name);
  await page.getByRole('button', { name: 'Run compiled Python' }).click();
  const output = page.locator('.molt-output');
  await expect(output).toBeVisible();
  const expected = execFileSync('python3', [`public/molt-compiled/${name}.py`], { encoding: 'utf8' }).replace(/\n$/, '');
  expect(await output.textContent()).toBe(expected);
  }
});

test('teadata filters match its Python reference query and keep the page within the viewport', async ({ page }) => {
  await page.goto('/work/dev/teadata');
  const demo = page.locator('#teadata-demo');
  await demo.scrollIntoViewIfNeeded();
  await demo.getByLabel('District', { exact: true }).selectOption('Houston ISD');
  const data = JSON.parse(execFileSync('cat', ['src/data/portfolio/teadata-example.json'], { encoding: 'utf8' }));
  for (const [rating, minimum] of [['D', 10], ['F', 20]] as const) {
    await demo.getByLabel('2025 rating', { exact: true }).selectOption(rating);
    await demo.getByLabel('Beginning teachers', { exact: true }).selectOption(String(minimum));
    const expected = data.verifiedQueries.find((q: {district:string;rating:string;minimum:number}) => q.district === 'Houston ISD' && q.rating === rating && q.minimum === minimum).ids;
    await expect(demo.locator('tbody tr td:first-of-type')).toHaveText(expected);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('2024 district index switches layouts without exposing dead workbook links', async ({ page }) => {
  await page.goto('/portfolio/lost-decade-2024-tables.html');
  const wide = page.locator('#district-list-wide');
  const narrow = page.locator('#district-list-narrow');
  if (page.viewportSize()!.width > 750) { await expect(wide).toBeVisible(); await expect(narrow).toBeHidden(); }
  else { await expect(narrow).toBeVisible(); await expect(wide).toBeHidden(); }
  await expect(page.locator('a')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("Notifications handles mixed outcomes without network delivery", async ({ page }) => {
  await page.goto('/demo/notifications');
  await page.getByLabel('Slack', { exact: true }).selectOption('failure');
  await page.getByLabel('Discord', { exact: true }).selectOption('timeout');
  const deliveryRequests: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') deliveryRequests.push(request.url()); });
  await page.getByRole('button', { name: 'Run local dispatch' }).click();
  await expect(page.getByRole('status')).toContainText('1 simulated deliveries, 2 failures, 0 skipped', { timeout: 10000 });
  expect(deliveryRequests).toEqual([]);
});

test("historical calculator uses the selected CPI periods and handles zero", async ({ page }) => {
  await page.goto('/demo/inflation');
  await page.getByLabel('From', { exact: true }).selectOption('2007-01');
  await page.getByLabel('To', { exact: true }).selectOption('2007-01');
  await expect(page.getByRole('status')).toContainText('$1,000.00 in 2007-01 ≈ $1,000.00 in 2007-01');
  await page.getByLabel('Amount in dollars').fill('0');
  await expect(page.getByRole('status')).toContainText('$0.00');
  await page.getByLabel('Amount in dollars').fill('-1');
  await expect(page.getByRole('status')).toContainText('Enter an amount');
});
