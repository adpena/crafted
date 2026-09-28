import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("Molt's browser worker produces the Python program's output", async ({ page }) => {
  await page.goto('/demo/molt');
  await page.getByRole('button', { name: 'Run compiled Python' }).click();
  const output = page.locator('.molt-output');
  await expect(output).toBeVisible();
  const expected = execFileSync('python3', ['public/molt-compiled/mandelbrot.py'], { encoding: 'utf8' }).replace(/\n$/, '');
  expect(await output.textContent()).toBe(expected);
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
