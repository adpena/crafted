#!/usr/bin/env npx tsx
/**
 * Disclaimer source verification script.
 * Fetches each disclaimer's source_url, hashes the content, and reports drift.
 *
 * Usage: npx tsx scripts/verify-disclaimers.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

interface HashEntry {
  hash: string;
  verified_date: string;
}

interface DisclaimerRecord {
  jurisdiction: string;
  type: string;
  context: string;
  source_url: string;
}

const DATA_DIR = join(import.meta.dirname ?? ".", "..", "data", "disclaimers");
const HASHES_PATH = join(DATA_DIR, "hashes.json");

function loadRecords(): DisclaimerRecord[] {
  const records: DisclaimerRecord[] = [];

  const federal = join(DATA_DIR, "federal.json");
  if (existsSync(federal)) {
    records.push(...JSON.parse(readFileSync(federal, "utf-8")));
  }

  const statesDir = join(DATA_DIR, "states");
  if (existsSync(statesDir)) {
    for (const file of readdirSync(statesDir).filter((f) => f.endsWith(".json"))) {
      records.push(...JSON.parse(readFileSync(join(statesDir, file), "utf-8")));
    }
  }

  return records;
}

function loadHashes(): Record<string, HashEntry> {
  if (existsSync(HASHES_PATH)) {
    return JSON.parse(readFileSync(HASHES_PATH, "utf-8"));
  }
  return {};
}

function key(r: DisclaimerRecord): string {
  return `${r.jurisdiction}:${r.type}:${r.context}`;
}

async function main() {
  const records = loadRecords();
  const hashes = loadHashes();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`Verifying ${records.length} disclaimer sources...\n`);

  let changed = 0;
  let unchanged = 0;
  let newCount = 0;
  let errors = 0;

  for (const record of records) {
    const k = key(record);
    try {
      const res = await fetch(record.source_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const hash = createHash("sha256").update(body).digest("hex");
      const prev = hashes[k];

      if (!prev) {
        console.log(`  NEW        ${k}`);
        newCount++;
      } else if (prev.hash !== hash) {
        console.log(`  CHANGED    ${k}  ← needs review`);
        changed++;
      } else {
        console.log(`  UNCHANGED  ${k}`);
        unchanged++;
      }

      hashes[k] = { hash, verified_date: today };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR      ${k}  (${msg})`);
      errors++;
    }
  }

  writeFileSync(HASHES_PATH, JSON.stringify(hashes, null, 2) + "\n");

  console.log(`\n--- Summary ---`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Changed:   ${changed}`);
  console.log(`  New:       ${newCount}`);
  console.log(`  Errors:    ${errors}`);

  if (changed > 0) {
    process.exit(1);
  }
}

main();
