import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import pay from "../src/data/portfolio/pay-history.json";
import paths from "../src/data/portfolio/district-map.json";
import hb2 from "../src/data/portfolio/hb2.json";
import charter from "../src/data/portfolio/charter-cost.json";
import cpi from "../src/data/portfolio/texas-cpi.json";
import provenance from "../docs/portfolio-data-provenance.json";

it("keeps distinct published populations, leading-zero IDs, and a complete map join", () => {
  for (const [rows, count] of [[pay, 1019], [hb2, 1179], [charter, 1020]] as const) {
    expect(rows).toHaveLength(count);
    expect(new Set(rows.map((row) => row.id)).size).toBe(count);
    expect(rows.every((row) => /^\d{6}$/.test(row.id))).toBe(true);
  }
  expect(new Set(paths.map((path) => path.id))).toEqual(new Set(pay.map((row) => row.id)));
  expect(charter.some((row) => typeof row.enrollment === "string" && row.enrollment.includes("<10"))).toBe(true);
  expect(pay.find((row) => row.id === "109901")?.beginning).toBeNull();
  expect(hb2.find((row) => row.id === "101902")).toMatchObject({ ssra: 1913805.68, bonus: 0, paraFte: 1133.99 });
});
it("keeps one positive CPI value per month without filling beyond the archive", () => {
  expect(cpi).toHaveLength(197);
  expect(new Set(cpi.map((row) => row.period)).size).toBe(197);
  expect(cpi.map((row) => row.period)).toEqual(cpi.map((row) => row.period).sort());
  expect(cpi[0]).toEqual({ period: "2007-01", cpi: 184.549 });
  expect(cpi.at(-1)?.period).toBe("2023-05");
  expect(cpi.every((row) => Number.isFinite(row.cpi) && row.cpi > 0)).toBe(true);
});
it("matches every exhibit to its recorded artifact hash", () => {
  for (const artifact of provenance.artifacts) {
    const bytes = readFileSync(artifact.path);
    expect(bytes.length, artifact.path).toBe(artifact.bytes);
    expect(createHash("sha256").update(bytes).digest("hex"), artifact.path).toBe(artifact.sha256);
    expect(artifact.sources.length).toBeGreaterThan(0);
  }
});
