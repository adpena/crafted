import { describe, expect, it } from "vitest";
import data from "../src/data/portfolio/teadata-example.json";
import { selectCampuses } from "../src/lib/teadata-example";

describe("teadata public snapshot", () => {
  for (const query of data.verifiedQueries) {
    it(`matches the actual Python query: ${query.district}, ${query.rating}, ${query.minimum}%`, () => {
      expect(selectCampuses(data.rows, query.district, query.rating, query.minimum).map((r) => r.id)).toEqual(query.ids);
    });
  }
  it("preserves leading zeros and omits missing measurements", () => {
    expect(data.rows.every((r) => /^\d{9}$/.test(r.id))).toBe(true);
    const row = { ...data.rows[0]!, beginningTeachers: null };
    expect(selectCampuses([row], row.district, "all", 0)).toEqual([]);
  });
});
