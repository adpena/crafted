import { describe, it, expect } from "vitest";
import {
  resolveDisclaimer,
  loadDisclaimers,
  type Disclaimer,
  type DisclaimerQuery,
} from "../src/modules/disclaimers.js";

const federal: Disclaimer[] = [
  {
    jurisdiction: "FED",
    type: "digital",
    context: "general",
    required_text: "Paid for by {committee_name}",
    adapted_text: null,
    statute_citation: "11 CFR 110.11",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2002-01-01",
    last_verified: "2026-03-15",
    source_url: "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11",
  },
  {
    jurisdiction: "FED",
    type: "print",
    context: "general",
    required_text: "Paid for by {committee_name}, {treasurer_name}, Treasurer",
    adapted_text: null,
    statute_citation: "11 CFR 110.11",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2002-01-01",
    last_verified: "2026-03-15",
    source_url: "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11",
  },
  {
    jurisdiction: "FED",
    type: "digital",
    context: "independent_expenditure",
    required_text: "Paid for by {committee_name}. Not authorized by any candidate or candidate's committee.",
    adapted_text: null,
    statute_citation: "11 CFR 110.11(b)(3)",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2002-01-01",
    last_verified: "2026-03-15",
    source_url: "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11",
  },
];

const dc: Disclaimer[] = [
  {
    jurisdiction: "DC",
    type: "digital",
    context: "general",
    required_text: "Paid for by {committee_name}",
    adapted_text: null,
    statute_citation: "DC Code 1-1163.13",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2019-03-13",
    last_verified: "2026-03-15",
    source_url: "https://code.dccouncil.gov/us/dc/council/code/sections/1-1163.13",
  },
];

describe("loadDisclaimers", () => {
  it("merges federal and state records", () => {
    const all = loadDisclaimers(federal, dc);
    expect(all).toHaveLength(4);
  });

  it("works with federal only", () => {
    const all = loadDisclaimers(federal);
    expect(all).toHaveLength(3);
  });
});

describe("resolveDisclaimer", () => {
  const data = loadDisclaimers(federal, dc);
  const vars = { committee_name: "Friends of Test", treasurer_name: "Jane Doe" };

  it("resolves federal + state disclaimer for known jurisdiction", () => {
    const query: DisclaimerQuery = { jurisdiction: "DC", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.federal).not.toBeNull();
    expect(result.federal!.statute_citation).toBe("11 CFR 110.11");
    expect(result.state).not.toBeNull();
    expect(result.state!.statute_citation).toBe("DC Code 1-1163.13");
  });

  it("falls back to federal-only when state has no matching rule", () => {
    const query: DisclaimerQuery = { jurisdiction: "TX", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.federal).not.toBeNull();
    expect(result.state).toBeNull();
  });

  it("substitutes placeholders in text", () => {
    const query: DisclaimerQuery = { jurisdiction: "DC", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.federal!.text).toBe("Paid for by Friends of Test");
    expect(result.state!.text).toBe("Paid for by Friends of Test");
  });

  it("substitutes multiple placeholders", () => {
    const query: DisclaimerQuery = { jurisdiction: "FED", type: "print", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.federal!.text).toBe(
      "Paid for by Friends of Test, Jane Doe, Treasurer"
    );
  });

  it("produces combined text with federal and state", () => {
    const query: DisclaimerQuery = { jurisdiction: "DC", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.combined).toContain("Paid for by Friends of Test");
    expect(typeof result.combined).toBe("string");
  });

  it("produces combined text with federal only", () => {
    const query: DisclaimerQuery = { jurisdiction: "TX", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.combined).toBe("Paid for by Friends of Test");
  });

  it("defaults to general context when none specified", () => {
    const query: DisclaimerQuery = { jurisdiction: "FED", type: "digital", vars };
    const result = resolveDisclaimer(data, query);

    expect(result.federal).not.toBeNull();
    expect(result.federal!.text).toBe("Paid for by Friends of Test");
  });

  it("filters by context when specified", () => {
    const query: DisclaimerQuery = {
      jurisdiction: "FED",
      type: "digital",
      context: "independent_expenditure",
      vars,
    };
    const result = resolveDisclaimer(data, query);

    expect(result.federal).not.toBeNull();
    expect(result.federal!.text).toContain("Not authorized by any candidate");
    expect(result.federal!.statute_citation).toBe("11 CFR 110.11(b)(3)");
  });

  it("returns null when no rule matches the given context", () => {
    const query: DisclaimerQuery = {
      jurisdiction: "FED",
      type: "digital",
      context: "pac",
      vars,
    };
    const result = resolveDisclaimer(data, query);

    expect(result.federal).toBeNull();
  });
});
