#!/usr/bin/env tsx
/**
 * Lighthouse audit runner for crafted action-pages demo pages.
 *
 * Starts the Astro dev server, waits for it to be ready, runs Lighthouse
 * against each demo page, and prints a summary table. Exits 0 if all pages
 * meet thresholds, 1 otherwise.
 *
 * If `lighthouse` is not installed, run:
 *   npm install --save-dev lighthouse chrome-launcher
 *
 * Usage: npm run lighthouse
 */

import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE_URL = "http://localhost:4321";
const DEMO_PAGES = [
  "/action/fund-public-schools",
  "/action/protect-voting-rights",
  "/action/climate-action-now",
  "/action/healthcare-for-all",
  "/action/housing-justice",
  "/action/criminal-justice-reform",
];

const THRESHOLDS = {
  performance: 0.9,
  accessibility: 0.95,
  "best-practices": 0.95,
  seo: 0.9,
} as const;

type CategoryKey = keyof typeof THRESHOLDS;

interface AuditResult {
  url: string;
  scores: Record<CategoryKey, number>;
  passed: boolean;
}

let devServer: ChildProcess | null = null;

function shutdown(code: number): never {
  if (devServer && !devServer.killed) {
    try {
      devServer.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

async function waitForServer(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await sleep(500);
  }
  throw new Error(`Dev server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function startDevServer(): Promise<void> {
  console.log("[lighthouse] starting dev server…");
  devServer = spawn("npm", ["run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  devServer.stdout?.on("data", () => {});
  devServer.stderr?.on("data", () => {});
  devServer.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[lighthouse] dev server exited unexpectedly with code ${code}`);
    }
  });

  await waitForServer(BASE_URL, 90_000);
  console.log("[lighthouse] dev server ready");
}

async function runLighthouse(url: string): Promise<AuditResult> {
  let lighthouse: any;
  let chromeLauncher: any;
  try {
    // Dynamic imports so the script can fail gracefully with a helpful error.
    lighthouse = (await import("lighthouse")).default;
    chromeLauncher = await import("chrome-launcher");
  } catch (err) {
    throw new Error(
      "Missing dependency: 'lighthouse' and/or 'chrome-launcher'. " +
        "Install with: npm install --save-dev lighthouse chrome-launcher",
    );
  }

  const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
  try {
    const runnerResult = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
      undefined,
    );

    const lhr = runnerResult?.lhr;
    if (!lhr) throw new Error(`No Lighthouse result for ${url}`);

    const scores = {
      performance: lhr.categories.performance?.score ?? 0,
      accessibility: lhr.categories.accessibility?.score ?? 0,
      "best-practices": lhr.categories["best-practices"]?.score ?? 0,
      seo: lhr.categories.seo?.score ?? 0,
    } as Record<CategoryKey, number>;

    const passed = (Object.keys(THRESHOLDS) as CategoryKey[]).every(
      (k) => (scores[k] ?? 0) >= THRESHOLDS[k],
    );

    return { url, scores, passed };
  } finally {
    await chrome.kill();
  }
}

function fmt(score: number): string {
  return (score * 100).toFixed(0).padStart(3, " ");
}

function printSummary(results: AuditResult[]): void {
  const header = `| ${"URL".padEnd(48)} | perf | a11y | bp  | seo |`;
  const divider = `|${"-".repeat(50)}|------|------|-----|-----|`;
  console.log("\nLighthouse audit summary");
  console.log(header);
  console.log(divider);
  for (const r of results) {
    const mark = r.passed ? " " : "!";
    console.log(
      `|${mark}${r.url.padEnd(48)} | ${fmt(r.scores.performance)}  | ${fmt(r.scores.accessibility)}  | ${fmt(r.scores["best-practices"])} | ${fmt(r.scores.seo)} |`,
    );
  }
  console.log();
  console.log(
    `Thresholds: perf >= ${THRESHOLDS.performance}, a11y >= ${THRESHOLDS.accessibility}, bp >= ${THRESHOLDS["best-practices"]}, seo >= ${THRESHOLDS.seo}`,
  );
}

async function main(): Promise<void> {
  await startDevServer();

  const results: AuditResult[] = [];
  for (const path of DEMO_PAGES) {
    const url = `${BASE_URL}${path}`;
    console.log(`[lighthouse] auditing ${url}`);
    try {
      const result = await runLighthouse(url);
      results.push(result);
    } catch (err) {
      console.error(`[lighthouse] failed to audit ${url}:`, (err as Error).message);
      shutdown(1);
    }
  }

  printSummary(results);

  const allPassed = results.every((r) => r.passed);
  shutdown(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("[lighthouse] fatal error:", err);
  shutdown(1);
});
