/** Public exclusions apply even if a CMS row is accidentally published. */
export const EXCLUDED_PORTFOLIO_SLUGS = new Set([
  "working-but-uncovered", "tx-working-but-uncovered",
]);

export function isPublicPortfolioSlug(slug: string): boolean {
  return !EXCLUDED_PORTFOLIO_SLUGS.has(slug);
}

export const WORK_FILTERS = [
  { value: "all", label: "All work", collections: ["dev", "policy", "design", "writing"] },
  { value: "software", label: "Software", collections: ["dev"] },
  { value: "research", label: "Research", collections: ["policy", "design"] },
  { value: "writing", label: "Writing", collections: ["writing"] },
] as const;

export type WorkFilter = typeof WORK_FILTERS[number]["value"];

export function parseWorkFilter(value: string | null): WorkFilter {
  return WORK_FILTERS.find((f) => f.value === value)?.value ?? "all";
}

export function workFilterHref(value: WorkFilter): string {
  return value === "all" ? "/#work" : `/?focus=${value}#work`;
}
