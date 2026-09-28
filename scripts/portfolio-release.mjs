#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrangler = resolve(root, 'node_modules/.bin/wrangler');
const collections = ['pages', 'dev', 'design', 'policy', 'writing'];
const excluded = ['working-but-uncovered', 'tx-working-but-uncovered'];
const privateDir = resolve(root, '.portfolio-release');
const statePath = resolve(privateDir, 'prepared.json');
const command = process.argv[2];

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}
export const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
function run(file, args, inherit = false) {
  return execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 64 * 1024 * 1024 });
}
function query(sql) {
  const result = JSON.parse(run(wrangler, ['d1', 'execute', 'crafted', '--remote', '--command', sql, '--json']));
  if (!result.length || result.some((r) => !r.success)) throw new Error('D1 read failed');
  return result.flatMap((r) => r.results);
}
function snapshot(read = query) {
  const state = {};
  for (const collection of collections) {
    const rows = read(`SELECT * FROM ec_${collection} ORDER BY id`);
    if (!rows.length) throw new Error(`Empty collection: ${collection}`);
    state[collection] = rows.map((row) => {
      if (excluded.includes(row.slug) && row.status === 'published' && !row.deleted_at) throw new Error(`Excluded project is published: ${row.slug}`);
      return { id: row.id, slug: row.slug, status: row.status, version: row.version, updatedAt: row.updated_at,
        liveRevisionId: row.live_revision_id, draftRevisionId: row.draft_revision_id, sha256: hash(row) };
    });
  }
  state.revisionsSha256 = hash(read('SELECT * FROM revisions ORDER BY id'));
  state.settingsSha256 = hash(read('SELECT * FROM options ORDER BY name'));
  return state;
}
function publicFiles() {
  const files = {};
  function visit(dir) { for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) visit(p);
    else files[relative(root, p)] = createHash('sha256').update(readFileSync(p)).digest('hex');
  } }
  visit(resolve(root, 'public/portfolio'));
  visit(resolve(root, 'public/molt-compiled'));
  if (existsSync(resolve(root, 'public/resumes'))) visit(resolve(root, 'public/resumes'));
  return files;
}
function checkPrepared(state) {
  const manifestText = readFileSync(resolve(state.backupPath, 'manifest.json'), 'utf8');
  if (hash(manifestText) !== state.backupSha256) throw new Error('Backup manifest changed since prepare.');
  const manifest = JSON.parse(manifestText);
  const restoreHash = createHash('sha256').update(readFileSync(resolve(state.backupPath, manifest.restore))).digest('hex');
  if (!manifest.restoreVerified || restoreHash !== manifest.restoreSha256) throw new Error('Verified backup is missing or changed.');
  if (hash(state.cms) !== hash(snapshot())) throw new Error('CMS content or a protected revision changed since prepare. Inspect the change and prepare again.');
  if (hash(state.publicFiles) !== hash(publicFiles())) throw new Error('Public artifacts changed since prepare. Prepare again.');
  if (state.tree !== run('git', ['rev-parse', 'HEAD^{tree}']).trim()) throw new Error('Git tree changed since prepare. Prepare again.');
}
export async function verifyLive(origin = 'https://adpena.com') {
  const paths = ['/', '/?focus=software', '/?focus=research', '/about', '/contact', '/resume/software', '/resume/research', '/sitemap.xml', '/rss.xml',
    '/resumes/alejandro-pena-software.pdf', '/resumes/alejandro-pena-research.pdf'];
  const checked = [];
  for (const path of paths) {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const body = path.endsWith('.pdf') ? Buffer.from(await response.arrayBuffer()) : await response.text();
    if (path.endsWith('.pdf')) {
      if (body.subarray(0, 5).toString() !== '%PDF-') throw new Error(`${path}: not a PDF`);
    } else {
      if (excluded.some((slug) => body.includes(`/work/dev/${slug}`))) throw new Error(`${path}: excluded project exposed`);
      if (path === '/' && (!body.includes('Selected work') || !body.includes('CharterCostTracker'))) throw new Error('Homepage is stale or incomplete');
      if (path === '/about' && !body.includes('full-stack engineer')) throw new Error('About content is missing');
    }
    checked.push(path);
  }
  for (const slug of excluded) {
    const response = await fetch(new URL(`/work/dev/${slug}`, origin), { signal: AbortSignal.timeout(30000) });
    if (response.status !== 404) throw new Error(`${slug}: expected 404, received ${response.status}`);
    checked.push(`/work/dev/${slug}`);
  }
  return checked;
}
export async function verifyArtifacts(files, origin = 'https://adpena.com') {
  const checked = [];
  for (const [file, expected] of Object.entries(files)) {
    const path = file.replace(/^public/, '');
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${path}: artifact HTTP ${response.status}`);
    const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    if (actual !== expected) throw new Error(`${path}: deployed artifact does not match the prepared release`);
    checked.push(path);
  }
  return checked;
}
async function main() {
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  if (command === 'prepare') {
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const backupPath = resolve(root, 'backups', stamp);
    run('python3', ['scripts/backup-site.py', '--output', backupPath], true);
    const state = { preparedAt: new Date().toISOString(), commit: run('git', ['rev-parse', 'HEAD']).trim(), tree: run('git', ['rev-parse', 'HEAD^{tree}']).trim(),
      cms: snapshot(), publicFiles: publicFiles(), backupPath,
      backupSha256: hash(readFileSync(resolve(backupPath, 'manifest.json'), 'utf8')) };
    const backupCms = snapshot((sql) => JSON.parse(run('python3', ['-c',
      'import json,sqlite3,sys; d=sqlite3.connect(sys.argv[1]); d.row_factory=sqlite3.Row; print(json.dumps([dict(r) for r in d.execute(sys.argv[2])]))',
      resolve(backupPath, 'restored.sqlite'), sql])));
    if (hash(backupCms) !== hash(state.cms)) throw new Error('CMS content changed between backup and preparation; retry with editing paused.');
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    console.log(`Prepared release at ${statePath}; CMS revisions and public artifacts are guarded.`);
  } else if (command === 'verify') {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    checkPrepared(state);
    const paths = await verifyLive(process.env.SITE_URL || 'https://adpena.com');
    const artifacts = await verifyArtifacts(state.publicFiles, process.env.SITE_URL || 'https://adpena.com');
    console.log(`Verified unchanged CMS/revisions/artifacts, ${paths.length} live URLs, and ${artifacts.length} deployed artifact hashes.`);
  } else if (command === 'ship') {
    if (run('git', ['status', '--porcelain']).trim()) throw new Error('Commit the release before shipping.');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    checkPrepared(state);
    run('npm', ['run', 'typecheck'], true);
    run('npm', ['test'], true);
    run('npm', ['run', 'test:backup'], true);
    run('npm', ['run', 'build'], true);
    checkPrepared(state);
    if (run('git', ['status', '--porcelain']).trim()) throw new Error('Checks changed the working tree; review and commit before shipping.');
    run(wrangler, ['deploy'], true);
    for (const key of ['work-sections-v1', 'work-sections-v2']) run(wrangler, ['kv', 'key', 'delete', key, '--binding', 'CACHE', '--remote']);
    checkPrepared(state);
    const paths = await verifyLive();
    const artifacts = await verifyArtifacts(state.publicFiles);
    const deployment = run(wrangler, ['deployments', 'list', '--json']);
    const receipt = { ...state, verifiedAt: new Date().toISOString(), checkedPaths: paths, checkedArtifacts: artifacts, deployments: JSON.parse(deployment) };
    delete receipt.backupPath;
    const receiptPath = resolve(privateDir, 'published.json');
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    console.log(`Published and verified. Release receipt: ${receiptPath}`);
  } else throw new Error('Usage: node scripts/portfolio-release.mjs prepare|verify|ship');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
