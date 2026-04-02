export type DisclaimerContext = "general" | "candidate_authorized" | "independent_expenditure" | "pac";

export interface Disclaimer {
  jurisdiction: string;
  type: "digital" | "print" | "broadcast" | "sms" | "email";
  context: DisclaimerContext;
  required_text: string;
  adapted_text: string | null;
  statute_citation: string;
  ai_disclosure_required: boolean;
  ai_disclosure_text: string | null;
  effective_date: string;
  last_verified: string;
  source_url: string;
}

export interface DisclaimerQuery {
  jurisdiction: string;
  type: Disclaimer["type"];
  context?: DisclaimerContext;
  vars: Record<string, string>;
}

export interface ResolvedEntry {
  text: string;
  statute_citation: string;
  ai_disclosure_required: boolean;
  ai_disclosure_text: string | null;
}

export interface DisclaimerResult {
  federal: ResolvedEntry | null;
  state: ResolvedEntry | null;
  combined: string;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function toEntry(d: Disclaimer, vars: Record<string, string>): ResolvedEntry {
  return {
    text: interpolate(d.adapted_text ?? d.required_text, vars),
    statute_citation: d.statute_citation,
    ai_disclosure_required: d.ai_disclosure_required,
    ai_disclosure_text: d.ai_disclosure_text,
  };
}

export function loadDisclaimers(federal: Disclaimer[], ...states: Disclaimer[][]): Disclaimer[] {
  return [...federal, ...states.flat()];
}

export function resolveDisclaimer(data: Disclaimer[], query: DisclaimerQuery): DisclaimerResult {
  const ctx = query.context ?? "general";
  const fedMatch = data.find((d) => d.jurisdiction === "FED" && d.type === query.type && d.context === ctx) ?? null;
  const stateMatch =
    query.jurisdiction !== "FED"
      ? data.find((d) => d.jurisdiction === query.jurisdiction && d.type === query.type && d.context === ctx) ?? null
      : null;

  const federal = fedMatch ? toEntry(fedMatch, query.vars) : null;
  const state = stateMatch ? toEntry(stateMatch, query.vars) : null;

  const parts = [federal?.text, state?.text].filter(Boolean) as string[];
  const unique = [...new Set(parts)];

  return { federal, state, combined: unique.join("\n") };
}
