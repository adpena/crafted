/**
 * Refresh the homepage snapshot from the live emdash instance.
 *
 * Source of truth: D1 database via emdash API
 * Output: src/data/homepage.json (read at build time, not runtime)
 *
 * Usage: npx tsx scripts/refresh-homepage.ts
 * Or:    npm run refresh-homepage
 *
 * Requires EMDASH_URL and EMDASH_TOKEN env vars, or uses defaults.
 */

const EMDASH_URL = process.env.EMDASH_URL ?? "https://crafted.adpena.workers.dev";
const TOKEN = process.env.EMDASH_TOKEN ?? "";

const collections = ["dev", "design", "policy", "writing"];

interface Item {
  slug: string;
  title: string;
  summary?: string;
  stack?: string;
  publication?: string;
  medium?: string;
  year?: string;
  collection: string;
  href: string;
}

async function fetchCollection(slug: string): Promise<Item[]> {
  const res = await fetch(`${EMDASH_URL}/_emdash/api/content/${slug}?status=published`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { items: { slug: string; data: Record<string, any> }[] }; items?: { slug: string; data: Record<string, any> }[] };
  const items = json.data?.items ?? json.items ?? [];
  return items.map((item) => ({
    slug: item.slug,
    title: item.data.title ?? "Untitled",
    summary: item.data.summary,
    stack: item.data.stack,
    publication: item.data.publication,
    medium: item.data.medium,
    year: item.data.year,
    collection: slug,
    href: `/work/${slug}/${item.slug}`,
  }));
}

async function main() {
  const results = await Promise.all(collections.map(fetchCollection));
  const all = results.flat();

  // Featured: Molt, or first item
  const featured = all.find((i) => i.slug === "molt") ?? all[0] ?? null;

  // Latest: everything except featured, sorted by year descending
  const latest = all
    .filter((i) => i.slug !== featured?.slug)
    .sort((a, b) => parseInt(b.year ?? "0", 10) - parseInt(a.year ?? "0", 10))
    .slice(0, 8);

  const snapshot = {
    generated: new Date().toISOString(),
    source: EMDASH_URL,
    featured,
    latest,
  };

  const path = new URL("../src/data/homepage.json", import.meta.url);
  const fs = await import("node:fs");
  fs.writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${path.pathname} (${all.length} items, generated ${snapshot.generated})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
