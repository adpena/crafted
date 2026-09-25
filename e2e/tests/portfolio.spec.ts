import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('software and research have equal space and visible descriptions', async ({ page }) => {
  expect((await page.goto('/'))?.status()).toBe(200);
  const selected = page.locator('.selected-work');
  await expect(selected.locator('.selected-group')).toHaveCount(2);
  for (const name of ['Software', 'Research']) {
    const group = selected.getByRole('region', { name, exact: true });
    await expect(group.locator('article')).toHaveCount(2);
    await expect(group.locator('article p').first()).toBeVisible();
  }
  const [software, research] = await selected.locator('.selected-group').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(Math.abs(software - research)).toBeLessThan(2);
  await expect(page.getByRole('region', { name: 'Data for Public Education', exact: true })).toBeVisible();
  await expect(page.locator('nav[aria-label="Main navigation"]')).not.toContainText('Articles');
});

test('filters survive links, reloads, and browser history', async ({ page }) => {
  await page.goto('/?focus=research#work');
  await expect(page.locator('.work-index')).toHaveAttribute('data-filter', 'research');
  await expect(page.locator('.work-index [data-collection="policy"]')).toBeVisible();
  await expect(page.locator('.work-index [data-collection="dev"]')).toHaveCount(0);
  await page.locator('astro-island[component-export="default"]').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  const nav = page.getByRole('navigation', { name: 'Filter work' });
  await nav.getByRole('link', { name: 'Software', exact: true }).click();
  await expect(page).toHaveURL(/focus=software/);
  await expect(page.locator('.work-index [data-collection="policy"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.work-index')).toHaveAttribute('data-filter', 'research');
  await page.goForward();
  await expect(page.locator('.work-index')).toHaveAttribute('data-filter', 'software');
  await page.reload();
  await expect(page.locator('.work-index')).toHaveAttribute('data-filter', 'software');
  await nav.getByRole('link', { name: 'All work', exact: true }).click();
  await expect(page.locator('.work-index [data-collection="dev"]')).toBeVisible();
  await expect(page.locator('.work-index [data-collection="policy"]')).toBeVisible();
});

test('audience links and About work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/?focus=software#work');
  await expect(page.locator('.work-index [data-collection="dev"]')).toBeVisible();
  await expect(page.locator('.work-index [data-collection="policy"]')).toHaveCount(0);
  // The disabled-JS context cannot run Playwright's animation-frame stability check.
  await page.getByRole('navigation', { name: 'Filter work' }).getByRole('link', { name: 'Research', exact: true }).click({ force: true });
  await expect(page.locator('.work-index [data-collection="policy"]')).toBeVisible();
  expect((await page.goto('/about'))?.status()).toBe(200);
  await expect(page.locator('#about-body')).toContainText('full-stack engineer');
  await expect(page.locator('#about-body')).toBeVisible();
  await context.close();
});

test('resumes and contact are reachable from the homepage', async ({ page, request }) => {
  await page.goto('/');
  for (const focus of ['software', 'research']) {
    await page.getByRole('navigation', { name: 'Resumes and contact' }).getByRole('link', { name: `${focus === 'software' ? 'Software' : 'Research'} resume` }).click();
    await expect(page).toHaveURL(new RegExp(`/resume/${focus}`));
    await expect(page.getByRole('heading', { name: 'Experience', exact: true })).toBeVisible();
    const href = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
    const pdf = await request.get(href!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await page.goto('/');
  }
  await page.getByRole('navigation', { name: 'Resumes and contact' }).getByRole('link', { name: 'Get in touch' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact@adpena.com' })).toBeVisible();
});

test('public pages exclude unpublished work and do not overflow', async ({ page, request }) => {
  for (const path of ['/', '/about', '/resume/software', '/resume/research']) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('a[href*="working-but-uncovered"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  for (const path of ['/rss.xml', '/sitemap.xml']) expect(await (await request.get(path)).text()).not.toContain('working-but-uncovered');
  expect((await request.get('/work/dev/working-but-uncovered')).status()).toBe(404);
});

test('portfolio pages have no serious accessibility violations', async ({ page }) => {
  for (const path of ['/', '/about', '/resume/software', '/contact']) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact || '')), path).toEqual([]);
  }
});

test('skip link reaches main content by keyboard', async ({ page, browserName }) => {
  await page.goto('/');
  // Safari uses Option-Tab to include links in keyboard navigation.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
});
