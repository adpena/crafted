/**
 * Bill-to-Page generator.
 *
 * Paste a Congress.gov bill URL (or short reference like "HR 4532") and
 * generate a complete call-your-rep or letter-to-congress action page
 * with script, talking points, and letter template.
 *
 * Uses the Congress.gov API for bill summaries, with HTML meta tag fallback.
 * Calls the Anthropic Messages API (same pattern as ai-generator.ts).
 *
 * Security:
 *  - Never logs the API key.
 *  - All external calls are bounded by AbortSignal.timeout.
 */

import type { ActionPageConfig } from "../../plugin/src/components/ActionPageRenderer.tsx";
import { KNOWN_TEMPLATES, KNOWN_THEMES } from "./ai-generator.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

// --- Bill URL Parsing ---

interface BillRef {
  congress: number;
  type: string; // "hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"
  number: number;
}

/**
 * Parse a Congress.gov URL or short reference into a structured BillRef.
 *
 * Accepted formats:
 * - https://www.congress.gov/bill/118th-congress/house-bill/4532
 * - https://www.congress.gov/bill/118th-congress/senate-bill/1234
 * - HR 4532, H.R. 4532, S 1234, S. 1234
 * - HJRES 123, H.J.Res. 123
 */
export function parseBillRef(input: string): BillRef {
  const trimmed = input.trim();

  // Congress.gov URL pattern
  const urlMatch = trimmed.match(
    /congress\.gov\/bill\/(\d+)(?:st|nd|rd|th)-congress\/(house|senate|house-joint-resolution|senate-joint-resolution|house-concurrent-resolution|senate-concurrent-resolution|house-resolution|senate-resolution)-(?:bill\/)?(\d+)/i,
  );
  if (urlMatch) {
    const congress = parseInt(urlMatch[1], 10);
    const typeMap: Record<string, string> = {
      "house": "hr",
      "senate": "s",
      "house-joint-resolution": "hjres",
      "senate-joint-resolution": "sjres",
      "house-concurrent-resolution": "hconres",
      "senate-concurrent-resolution": "sconres",
      "house-resolution": "hres",
      "senate-resolution": "sres",
    };
    const rawType = urlMatch[2].toLowerCase();
    const type = typeMap[rawType];
    if (!type) throw new Error(`Unknown bill type in URL: ${rawType}`);
    const number = parseInt(urlMatch[3], 10);
    return { congress, type, number };
  }

  // Short reference: "HR 4532", "H.R. 4532", "S 1234", "HJRES 123", etc.
  const shortMatch = trimmed.match(
    /^(H\.?R\.?|S\.?|H\.?J\.?\s*RES\.?|S\.?J\.?\s*RES\.?|H\.?\s*CON\.?\s*RES\.?|S\.?\s*CON\.?\s*RES\.?|H\.?\s*RES\.?|S\.?\s*RES\.?)\s*(\d+)$/i,
  );
  if (shortMatch) {
    // Normalize the type string
    const rawType = shortMatch[1].replace(/\./g, "").replace(/\s+/g, "").toLowerCase();
    const typeMap: Record<string, string> = {
      "hr": "hr", "s": "s",
      "hjres": "hjres", "sjres": "sjres",
      "hconres": "hconres", "sconres": "sconres",
      "hres": "hres", "sres": "sres",
    };
    const type = typeMap[rawType];
    if (!type) throw new Error(`Unknown bill type: ${rawType}`);
    const number = parseInt(shortMatch[2], 10);
    // Default to current congress (119th in 2025-2026)
    const currentYear = new Date().getFullYear();
    const congress = Math.floor((currentYear - 1789) / 2) + 1;
    return { congress, type, number };
  }

  throw new Error(
    "Could not parse bill reference. Accepted: Congress.gov URL, or short form like 'HR 4532', 'S 1234'",
  );
}

// --- Bill Summary Fetching ---

interface BillSummary {
  title: string;
  summary: string;
}

/**
 * Fetch the bill title and summary from the Congress.gov API.
 * Falls back to HTML meta description if no API key or API fails.
 */
async function fetchBillSummary(
  ref: BillRef,
  congressApiKey?: string,
): Promise<BillSummary> {
  // Try the official API first
  if (congressApiKey) {
    try {
      const apiUrl = `https://api.congress.gov/v3/bill/${ref.congress}/${ref.type}/${ref.number}/summaries?api_key=${encodeURIComponent(congressApiKey)}`;
      const res = await fetch(apiUrl, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          summaries?: Array<{
            text?: string;
            actionDate?: string;
            updateDate?: string;
          }>;
        };
        const summaries = data.summaries ?? [];
        // Use the most recent summary
        const latest = summaries.sort((a, b) =>
          (b.updateDate ?? "").localeCompare(a.updateDate ?? ""),
        )[0];

        if (latest?.text) {
          // Also fetch the bill title
          const titleUrl = `https://api.congress.gov/v3/bill/${ref.congress}/${ref.type}/${ref.number}?api_key=${encodeURIComponent(congressApiKey)}`;
          const titleRes = await fetch(titleUrl, {
            signal: AbortSignal.timeout(8_000),
            headers: { Accept: "application/json" },
          });
          let title = `${ref.type.toUpperCase()} ${ref.number}`;
          if (titleRes.ok) {
            const titleData = (await titleRes.json()) as {
              bill?: { title?: string; shortTitle?: string };
            };
            title = titleData.bill?.shortTitle ?? titleData.bill?.title ?? title;
          }

          // Strip HTML tags from summary text
          const cleanSummary = latest.text.replace(/<[^>]*>/g, "").trim();
          return { title, summary: cleanSummary };
        }
      }
    } catch {
      // API failed — fall through to HTML fallback
    }
  }

  // Fallback: fetch the HTML page and extract meta description
  const billTypeUrlMap: Record<string, string> = {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
    hconres: "house-concurrent-resolution",
    sconres: "senate-concurrent-resolution",
    hres: "house-resolution",
    sres: "senate-resolution",
  };
  const urlType = billTypeUrlMap[ref.type] ?? "house-bill";
  const pageUrl = `https://www.congress.gov/bill/${ref.congress}th-congress/${urlType}/${ref.number}`;

  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent": "CraftedActionPages/1.0 (action page generator)",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      throw new Error(`Congress.gov returned ${res.status}`);
    }
    const html = await res.text();

    // Extract title from <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/\s*\| Congress\.gov.*$/, "").trim()
      : `${ref.type.toUpperCase()} ${ref.number}`;

    // Extract description from meta tag
    const metaMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
    const summary = metaMatch
      ? metaMatch[1].trim()
      : `Bill ${ref.type.toUpperCase()} ${ref.number} from the ${ref.congress}th Congress.`;

    return { title, summary };
  } catch (err) {
    throw new Error(
      `Failed to fetch bill info: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

// --- AI Generation ---

const BILL_SYSTEM_PROMPT = `You are a campaign action page writer for a civic engagement platform. Given a congressional bill title and summary, generate content for an action page that enables citizens to contact their representatives.

You output ONLY valid JSON — no markdown fences, no commentary. Just a single JSON object.

Return this exact structure:
{
  "headline": "Short, compelling headline for the action page (max 80 chars)",
  "subheadline": "1-2 sentence explanation of why this matters to constituents",
  "script": "Phone call script with {{rep_name}} merge field for the representative's name. 3-4 paragraphs, conversational but firm.",
  "letter_template": "Letter template with {{rep_name}} merge field. Formal but accessible. 3-4 paragraphs.",
  "talking_points": ["Point 1", "Point 2", "Point 3", "Point 4"],
  "committee_name": "Suggested disclaimer committee name (e.g., 'Citizens for HR 1234')"
}

Guidelines:
- Headlines should be urgent and action-oriented, not wonky
- Talking points should be factual, based ONLY on the bill summary provided
- Scripts should be natural — how a real person would speak on the phone
- Letter templates should be professional but passionate
- Use {{rep_name}} as the merge field for the representative's name
- Never fabricate provisions or claims not in the summary
- Return ONLY the JSON object.`;

export interface BillToPageOptions {
  billUrl: string;
  actionType: "letter" | "call";
  anthropicApiKey: string;
  congressApiKey?: string;
}

/**
 * Generate a complete action page from a Congress.gov bill URL.
 */
export async function generatePageFromBill(
  options: BillToPageOptions,
): Promise<ActionPageConfig> {
  const { billUrl, actionType, anthropicApiKey, congressApiKey } = options;

  if (!anthropicApiKey) throw new Error("Missing Anthropic API key");
  if (!billUrl) throw new Error("Missing bill URL or reference");

  // Parse and fetch
  const ref = parseBillRef(billUrl);
  const bill = await fetchBillSummary(ref, congressApiKey);

  // Generate content via Anthropic
  const userPrompt = [
    `Bill: ${bill.title}`,
    `Type: ${ref.type.toUpperCase()} ${ref.number} (${ref.congress}th Congress)`,
    `Action type requested: ${actionType}`,
    "",
    "Summary:",
    bill.summary.slice(0, 3000),
    "",
    "Generate the action page content. JSON only.",
  ].join("\n");

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: BILL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? "Anthropic request timed out"
        : "Anthropic request failed";
    throw new Error(reason);
  }

  if (!res.ok) {
    throw new Error(`Anthropic API returned status ${res.status}`);
  }

  const payload = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("Anthropic returned no text content");

  // Parse and build config
  const generated = parseGeneratedJson(text);
  return buildActionPageConfig(ref, bill, generated, actionType);
}

function parseGeneratedJson(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  if (!cleaned.startsWith("{")) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Generated content was not valid JSON");
  }
}

function buildActionPageConfig(
  ref: BillRef,
  bill: BillSummary,
  generated: Record<string, unknown>,
  actionType: "letter" | "call",
): ActionPageConfig {
  const headline = typeof generated.headline === "string" ? generated.headline : bill.title;
  const subheadline = typeof generated.subheadline === "string" ? generated.subheadline : "";
  const talkingPoints = Array.isArray(generated.talking_points)
    ? (generated.talking_points as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const committeeName = typeof generated.committee_name === "string"
    ? generated.committee_name
    : `Citizens for ${ref.type.toUpperCase()} ${ref.number}`;

  // Build slug from bill reference
  const slug = `${ref.type}-${ref.number}-${actionType}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 48);

  if (actionType === "letter") {
    const letterTemplate = typeof generated.letter_template === "string"
      ? generated.letter_template
      : "";
    const letterSubject = typeof generated.headline === "string"
      ? `Re: ${ref.type.toUpperCase()} ${ref.number} — ${generated.headline}`
      : `Re: ${ref.type.toUpperCase()} ${ref.number}`;

    return {
      slug,
      template: "hero-story",
      template_props: {
        headline,
        subheadline,
        body: bill.summary.slice(0, 500),
      },
      action: "letter",
      action_props: {
        headline: "Write Your Representative",
        subject: letterSubject,
        letter_template: letterTemplate,
        talking_points: talkingPoints,
      },
      disclaimer: { committee_name: committeeName },
      theme: "clean",
      locale: "en",
    };
  }

  // Call action
  const script = typeof generated.script === "string" ? generated.script : "";

  return {
    slug,
    template: "hero-simple",
    template_props: {
      headline,
      subheadline,
      body: [
        "**Call Script:**",
        "",
        script,
        "",
        "**Key Points:**",
        ...talkingPoints.map((p) => `- ${p}`),
      ].join("\n"),
    },
    action: "petition",
    action_props: {
      headline: "I Made the Call",
      target: 1000,
      goal: "calls to Congress",
    },
    disclaimer: { committee_name: committeeName },
    theme: "bold",
    locale: "en",
  };
}
