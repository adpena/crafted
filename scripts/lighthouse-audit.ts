#!/usr/bin/env tsx
/** Audit the built portfolio against isolated, locally seeded D1 content. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const origin = 'http://localhost:4322';
const paths = ['/', '/about', '/resume/software', '/work/policy/fiscal-impact-of-charter-school-expansion'];
const thresholds = { performance: .9, accessibility: .95, 'best-practices': .95, seo: .9 };
const state = process.env.PORTFOLIO_TEST_STATE || '.portfolio-release/test-state';
const server = spawn('node_modules/.bin/wrangler', ['dev', '--local', '--port', '4322', '--persist-to', state], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
for (const stream of [server.stdout, server.stderr]) stream?.on('data', (data) => { serverLog = (serverLog + data).slice(-8000); });
let chrome: Awaited<ReturnType<typeof launch>> | undefined;
process.on('SIGINT', () => { server.kill(); void chrome?.kill(); process.exit(130); });
process.on('SIGTERM', () => { server.kill(); void chrome?.kill(); process.exit(143); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${serverLog}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.text()).includes('CharterCostTracker')) { ready = true; break; }
    } catch {}
    await sleep(500);
  }
  if (!ready) throw new Error(`Seeded preview not ready: ${serverLog}`);
  chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  mkdirSync('.lighthouseci', { recursive: true });
  let failed = false;
  for (const device of ['desktop', 'mobile'] as const) for (const path of paths) {
    const samples: Record<string, number>[] = [];
    for (let sample = 1; sample <= 3; sample++) {
      const result = await lighthouse(origin + path, {
        port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: Object.keys(thresholds),
        ...(device === 'desktop' ? { preset: 'desktop' as const } : {}),
      });
      if (!result?.lhr || result.lhr.runtimeError) throw new Error(`Audit failed: ${device} ${path}`);
      const lhr = result.lhr;
      writeFileSync(`.lighthouseci/${device}-${path.replaceAll('/', '_') || 'home'}-${sample}.json`, JSON.stringify(lhr));
      samples.push(Object.fromEntries(Object.keys(thresholds).map((category) => [category, lhr.categories[category]?.score ?? 0])));
      console.log(`${device} ${path} run ${sample}: LCP=${Math.round(lhr.audits['largest-contentful-paint'].numericValue ?? 0)}ms, TBT=${Math.round(lhr.audits['total-blocking-time'].numericValue ?? 0)}ms, CLS=${lhr.audits['cumulative-layout-shift'].numericValue}, performance=${Math.round(samples.at(-1)!.performance * 100)}`);
    }
    const scores = Object.entries(thresholds).map(([category, minimum]) => {
      const score = samples.map((s) => s[category]).sort((a, b) => a - b)[1];
      if (score < minimum) failed = true;
      return `${category}=${Math.round(score * 100)}${score < minimum ? ' FAIL' : ''}`;
    });
    console.log(`${device} ${path} median of 3: ${scores.join(', ')}`);
  }
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  await chrome?.kill(); server.kill();
}
