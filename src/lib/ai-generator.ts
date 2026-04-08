/**
 * AI-powered Action Page generator.
 *
 * Takes a natural-language campaign description and produces a fully-formed
 * ActionPageConfig by calling the Anthropic Messages API.
 *
 * Optionally enriches the result with a BrandKit-derived theme by calling the
 * /api/admin/brand-extract endpoint when a brandUrl is provided.
 *
 * Security:
 *  - Never logs the API key.
 *  - Never logs the raw description (may contain PII).
 *  - All external calls are bounded by AbortSignal.timeout.
 */

import type { ActionPageConfig } from "../../plugin/src/components/ActionPageRenderer.tsx";

export const KNOWN_TEMPLATES = [
	"hero-simple",
	"hero-media",
	"hero-story",
	"hero-layered",
	"hero-split",
] as const;

export const KNOWN_ACTIONS = [
	"petition",
	"fundraise",
	"gotv",
	"signup",
	"letter",
	"event",
] as const;

export const KNOWN_THEMES = ["warm", "bold", "clean"] as const;

export type KnownTemplate = (typeof KNOWN_TEMPLATES)[number];
export type KnownAction = (typeof KNOWN_ACTIONS)[number];
export type KnownTheme = (typeof KNOWN_THEMES)[number];

export type GenerateActionPageOptions = {
	description: string;
	brandUrl?: string;
	preferredAction?: string;
	anthropicApiKey: string;
	/** Optional base URL used internally to call /api/admin/brand-extract */
	brandExtractBaseUrl?: string;
	/** Optional bearer token used to authenticate the brand-extract call */
	brandExtractBearer?: string;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `You are an expert political campaign strategist and copywriter who turns brief campaign descriptions into structured ActionPage configurations.

You output ONLY valid JSON — no markdown fences, no commentary, no explanation. Just a single JSON object.

# Available templates
- "hero-simple": Minimal centered hero. Use for clean signup forms and quick asks.
- "hero-media": Full-width hero image with overlay headline. Use when imagery carries the emotional weight.
- "hero-story": Editorial layout with longer body text below the hero. Use for stories that need narrative context.
- "hero-layered": Full-bleed background image with layered foreground content. Use for cinematic, dramatic urgency.
- "hero-split": Side-by-side media and copy. Use for product-style comparisons or candidate intros.

# Available actions and their fields
- "petition": { target: number, goal: string, headline: string, subheadline?: string }
- "fundraise": { amounts: number[], actblue_url: string, headline: string, subheadline?: string, suggested_amount?: number }
- "gotv": { pledge_text: string, headline: string, subheadline?: string }
- "signup": { list_name: string, cta_text: string, headline: string, subheadline?: string }
- "letter": { subject: string, letter_template: string, talking_points: string[], headline: string, subheadline?: string }
- "event": { event_name: string, event_date: string (ISO 8601), event_location: string, headline: string, subheadline?: string }

# Template props (always include)
Every template_props object should include at minimum:
{ headline: string, subheadline?: string, image_url?: string, body?: string }

# Theme selection rules
- "bold": urgent, dark, high-contrast — use for crisis, deadlines, GOTV, anti-incumbent fights.
- "warm": editorial, trustworthy, approachable — use for stories, community organizing, candidate bios.
- "clean": minimal, professional — use for policy briefings, expert signups, formal letters.

# Disclaimer
Always include a disclaimer object: { committee_name: string, treasurer_name?: string }
If unknown, infer plausible placeholders from the description (e.g. "Citizens for <Cause>") and set treasurer_name to undefined.

# Slug
Generate a kebab-case slug under 48 chars derived from the campaign topic.

# Output shape (return EXACTLY this structure)
{
  "slug": "string",
  "template": "one of the templates listed above",
  "template_props": { ... },
  "action": "one of the actions listed above",
  "action_props": { ... },
  "disclaimer": { "committee_name": "..." },
  "theme": "warm" | "bold" | "clean",
  "locale": "en"
}

Return ONLY the JSON object. No prose. No code fences.`;

/**
 * Generate an ActionPageConfig from a natural-language description.
 */
export async function generateActionPage(
	options: GenerateActionPageOptions,
): Promise<ActionPageConfig> {
	const {
		description,
		brandUrl,
		preferredAction,
		anthropicApiKey,
		brandExtractBaseUrl,
		brandExtractBearer,
	} = options;

	if (!anthropicApiKey) {
		throw new Error("Missing Anthropic API key");
	}
	if (!description || typeof description !== "string") {
		throw new Error("Missing description");
	}

	// Optional brand extraction
	let brandHint: { palette?: unknown; fonts?: unknown } | null = null;
	if (brandUrl && brandExtractBaseUrl && brandExtractBearer) {
		try {
			const brandRes = await fetch(`${brandExtractBaseUrl}/api/admin/brand-extract`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${brandExtractBearer}`,
				},
				body: JSON.stringify({ url: brandUrl }),
				signal: AbortSignal.timeout(20_000),
			});
			if (brandRes.ok) {
				const data = (await brandRes.json()) as {
					brand?: { palette?: unknown; fonts?: unknown };
				};
				if (data.brand) {
					brandHint = { palette: data.brand.palette, fonts: data.brand.fonts };
				}
			}
		} catch {
			// Brand extraction is best-effort; never block the generator on it.
			brandHint = null;
		}
	}

	// Build user prompt
	const userPromptParts: string[] = [];
	userPromptParts.push("Campaign description:");
	userPromptParts.push(description.trim());
	if (preferredAction && (KNOWN_ACTIONS as readonly string[]).includes(preferredAction)) {
		userPromptParts.push("");
		userPromptParts.push(`Preferred action type: ${preferredAction}`);
	}
	if (brandHint) {
		userPromptParts.push("");
		userPromptParts.push(
			`Brand hint (use to inform theme choice only): ${JSON.stringify(brandHint).slice(0, 1000)}`,
		);
	}
	userPromptParts.push("");
	userPromptParts.push("Return a single JSON object matching the schema. JSON only.");

	const requestBody = {
		model: ANTHROPIC_MODEL,
		max_tokens: 4096,
		system: SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: userPromptParts.join("\n"),
			},
		],
	};

	let res: Response;
	try {
		res = await fetch(ANTHROPIC_URL, {
			method: "POST",
			headers: {
				"x-api-key": anthropicApiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(60_000),
		});
	} catch (err) {
		// Never include the API key or request body in error messages.
		const reason = err instanceof Error && err.name === "TimeoutError"
			? "Anthropic request timed out"
			: "Anthropic request failed";
		throw new Error(reason);
	}

	if (!res.ok) {
		throw new Error(`Anthropic API returned status ${res.status}`);
	}

	let payload: { content?: Array<{ type?: string; text?: string }> };
	try {
		payload = (await res.json()) as typeof payload;
	} catch {
		throw new Error("Anthropic returned invalid JSON");
	}

	const text = payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
	if (!text) {
		throw new Error("Anthropic returned no text content");
	}

	const parsed = parseModelJson(text);
	const validated = validateConfig(parsed);
	return validated;
}

/**
 * Strip optional ```json fences and parse.
 */
function parseModelJson(text: string): Record<string, unknown> {
	let cleaned = text.trim();
	if (cleaned.startsWith("```")) {
		cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
	}
	// If model added prose, try to find the first { ... } JSON object.
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

function validateConfig(raw: Record<string, unknown>): ActionPageConfig {
	const slugRaw = typeof raw.slug === "string" ? raw.slug : "";
	const slug = slugRaw
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48) || "untitled-campaign";

	const template = String(raw.template ?? "");
	if (!(KNOWN_TEMPLATES as readonly string[]).includes(template)) {
		throw new Error("Generated template is not a known template");
	}

	const action = String(raw.action ?? "");
	if (!(KNOWN_ACTIONS as readonly string[]).includes(action)) {
		throw new Error("Generated action is not a known action");
	}

	const template_props =
		raw.template_props && typeof raw.template_props === "object" && !Array.isArray(raw.template_props)
			? (raw.template_props as Record<string, unknown>)
			: {};

	const action_props =
		raw.action_props && typeof raw.action_props === "object" && !Array.isArray(raw.action_props)
			? (raw.action_props as Record<string, unknown>)
			: {};

	const disclaimerRaw =
		raw.disclaimer && typeof raw.disclaimer === "object" && !Array.isArray(raw.disclaimer)
			? (raw.disclaimer as Record<string, unknown>)
			: {};
	const committee_name =
		typeof disclaimerRaw.committee_name === "string" && disclaimerRaw.committee_name.trim()
			? disclaimerRaw.committee_name.trim()
			: "Campaign Committee";
	const treasurer_name =
		typeof disclaimerRaw.treasurer_name === "string" ? disclaimerRaw.treasurer_name : undefined;

	const themeRaw = typeof raw.theme === "string" ? raw.theme : "clean";
	const theme = (KNOWN_THEMES as readonly string[]).includes(themeRaw) ? themeRaw : "clean";

	return {
		slug,
		template,
		template_props,
		action,
		action_props,
		disclaimer: {
			// AI-generated committee_name is always fake — force human review.
			// MCP create_page validation rejects empty committee_name.
			committee_name: "",
			treasurer_name,
			ai_generated: true,
		},
		_disclaimer_note: "Set your real committee name before publishing",
		theme,
		locale: "en",
	};
}
