#!/usr/bin/env tsx
/**
 * translate-demos.ts
 *
 * Translate every demo action page into the 7 non-English locales
 * supported by Crafted, via the Anthropic API + the Crafted MCP server.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-xxx \
 *   MCP_ADMIN_TOKEN=xxx \
 *   BASE_URL=http://localhost:4321 \
 *   tsx scripts/translate-demos.ts
 *
 * Zero external deps — Node built-ins + fetch only.
 */

interface Page {
	slug: string;
	template?: string;
	template_props?: Record<string, unknown>;
	action?: string;
	action_props?: Record<string, unknown>;
	theme?: string;
	theme_props?: Record<string, unknown>;
	locale?: string;
}

interface RpcResponse<T = unknown> {
	jsonrpc: "2.0";
	id: number | string;
	result?: T;
	error?: { code: number; message: string; data?: unknown };
}

const LOCALES = ["es", "zh", "vi", "ko", "tl", "fr", "ar"] as const;
type Locale = (typeof LOCALES)[number];

const LOCALE_NAMES: Record<Locale, string> = {
	es: "Spanish (Latin American)",
	zh: "Simplified Chinese",
	vi: "Vietnamese",
	ko: "Korean",
	tl: "Tagalog / Filipino",
	fr: "French (standard)",
	ar: "Arabic (Modern Standard)",
};

/** Keys inside template_props that should be translated. */
const TEMPLATE_KEYS = [
	"headline",
	"subhead",
	"body",
	"pull_quote",
	"eyebrow",
] as const;

/** Keys inside action_props that should be translated. */
const ACTION_KEYS = [
	"target",
	"pledge_text",
	"letter_template",
	"talking_points", // array of strings
	"event_name",
	"event_location",
	"event_description",
	"script",
	"list_name",
	"cta_text",
] as const;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const COST_PER_PAGE_LOCALE = 0.015;

const SYSTEM_PROMPT =
	"You are a native speaker translator for campaign action pages. " +
	"Preserve tone, urgency, and political nuance. Do not translate brand " +
	"names or URLs. Return valid JSON matching the input shape.";

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) {
		console.error(`Missing required env var: ${name}`);
		process.exit(1);
	}
	return v;
}

const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
const MCP_ADMIN_TOKEN = requireEnv("MCP_ADMIN_TOKEN");
const BASE_URL = (process.env.BASE_URL || "http://localhost:4321").replace(
	/\/$/,
	"",
);

const MCP_URL = `${BASE_URL}/api/mcp/actions`;

let rpcId = 0;

async function rpc<T = unknown>(
	method: string,
	params: Record<string, unknown>,
	auth = false,
): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (auth) headers["Authorization"] = `Bearer ${MCP_ADMIN_TOKEN}`;

	const res = await fetch(MCP_URL, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: ++rpcId,
			method,
			params,
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(
			`RPC ${method} → HTTP ${res.status}: ${text.slice(0, 200)}`,
		);
	}

	const body = (await res.json()) as RpcResponse<T>;
	if (body.error) {
		throw new Error(`RPC ${method} → ${body.error.code} ${body.error.message}`);
	}
	if (body.result === undefined) {
		throw new Error(`RPC ${method} → no result`);
	}
	return body.result;
}

interface TranslatableBundle {
	template?: Record<string, unknown>;
	action?: Record<string, unknown>;
	disclaimer_committee_name?: string;
}

/** Extract the translatable subset from a page's props. */
function extractTranslatable(page: Page): TranslatableBundle {
	const bundle: TranslatableBundle = {};

	if (page.template_props) {
		const sub: Record<string, unknown> = {};
		for (const k of TEMPLATE_KEYS) {
			if (page.template_props[k] != null) sub[k] = page.template_props[k];
		}
		if (Object.keys(sub).length > 0) bundle.template = sub;
	}

	if (page.action_props) {
		const sub: Record<string, unknown> = {};
		for (const k of ACTION_KEYS) {
			if (page.action_props[k] != null) sub[k] = page.action_props[k];
		}
		if (Object.keys(sub).length > 0) bundle.action = sub;

		const disc = page.action_props.disclaimer as
			| Record<string, unknown>
			| undefined;
		if (disc && typeof disc.committee_name === "string") {
			bundle.disclaimer_committee_name = disc.committee_name;
		}
	}

	return bundle;
}

/** Merge the translated bundle back onto a copy of the original page. */
function mergeTranslation(
	page: Page,
	translated: TranslatableBundle,
	locale: Locale,
): Page {
	const clone: Page = JSON.parse(JSON.stringify(page));
	clone.slug = `${page.slug}-${locale}`;
	clone.locale = locale;

	if (translated.template && clone.template_props) {
		for (const [k, v] of Object.entries(translated.template)) {
			clone.template_props[k] = v;
		}
	}
	if (translated.action && clone.action_props) {
		for (const [k, v] of Object.entries(translated.action)) {
			clone.action_props[k] = v;
		}
	}
	if (
		translated.disclaimer_committee_name &&
		clone.action_props &&
		typeof clone.action_props.disclaimer === "object" &&
		clone.action_props.disclaimer
	) {
		(clone.action_props.disclaimer as Record<string, unknown>).committee_name =
			translated.disclaimer_committee_name;
	}

	return clone;
}

async function translateBundle(
	bundle: TranslatableBundle,
	locale: Locale,
): Promise<TranslatableBundle> {
	const userPrompt =
		`Translate every string in the JSON below from English into ${LOCALE_NAMES[locale]}. ` +
		`Preserve the exact shape and keys. Keep placeholder tokens like {{rep_name}}, ` +
		`{{rep_names}}, or numeric values verbatim. Do not translate URLs, ` +
		`hashtags, or brand names. Respond with ONLY the translated JSON — ` +
		`no prose, no code fences.\n\n` +
		JSON.stringify(bundle, null, 2);

	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": ANTHROPIC_API_KEY,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: userPrompt }],
		}),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 300)}`);
	}

	const body = (await res.json()) as {
		content?: Array<{ type: string; text?: string }>;
	};
	const text =
		body.content
			?.filter((c) => c.type === "text")
			.map((c) => c.text ?? "")
			.join("")
			.trim() ?? "";

	if (!text) throw new Error("Anthropic returned empty response");

	// Strip any accidental code fences
	const cleaned = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/```\s*$/i, "")
		.trim();

	try {
		return JSON.parse(cleaned) as TranslatableBundle;
	} catch (err) {
		throw new Error(
			`Failed to parse Anthropic JSON response: ${String(err)}\nRaw: ${cleaned.slice(0, 300)}`,
		);
	}
}

async function main() {
	console.log(`→ Fetching demo pages from ${MCP_URL}`);
	const { pages } = await rpc<{ pages: Page[] }>("list_pages", {});

	// Only operate on the original demo pages — skip already-translated copies
	// (whose slugs end in -es, -zh, etc.)
	const demos = pages.filter((p) => {
		const hasSuffix = LOCALES.some((loc) => p.slug.endsWith(`-${loc}`));
		return !hasSuffix;
	});

	console.log(`  Found ${demos.length} original pages`);
	if (demos.length === 0) {
		console.error("No demo pages found. Run seed-demo-pages.ts first.");
		process.exit(1);
	}

	const total = demos.length * LOCALES.length;
	let successes = 0;
	let failures = 0;
	const errors: string[] = [];

	for (const demo of demos) {
		const bundle = extractTranslatable(demo);
		const hasContent =
			(bundle.template && Object.keys(bundle.template).length > 0) ||
			(bundle.action && Object.keys(bundle.action).length > 0) ||
			bundle.disclaimer_committee_name;

		if (!hasContent) {
			console.log(`⚠ ${demo.slug}: nothing to translate, skipping`);
			continue;
		}

		for (const locale of LOCALES) {
			const targetSlug = `${demo.slug}-${locale}`;
			process.stdout.write(`  ${targetSlug} … `);
			try {
				const translated = await translateBundle(bundle, locale);
				const newPage = mergeTranslation(demo, translated, locale);

				await rpc(
					"create_page",
					{
						slug: newPage.slug,
						template: newPage.template,
						template_props: newPage.template_props,
						action: newPage.action,
						action_props: newPage.action_props,
						theme: newPage.theme,
						theme_props: newPage.theme_props,
						locale,
					},
					true,
				);

				successes++;
				process.stdout.write("ok\n");
			} catch (err) {
				failures++;
				const msg = err instanceof Error ? err.message : String(err);
				errors.push(`${targetSlug}: ${msg}`);
				process.stdout.write(`fail (${msg.slice(0, 80)})\n`);
			}
		}
	}

	const cost = total * COST_PER_PAGE_LOCALE;

	console.log("\n── Summary ────────────────────────────────");
	console.log(`  Demos:          ${demos.length}`);
	console.log(`  Locales:        ${LOCALES.length}`);
	console.log(`  Total attempts: ${total}`);
	console.log(`  Successes:      ${successes}`);
	console.log(`  Failures:       ${failures}`);
	console.log(`  Est. cost:      $${cost.toFixed(3)}`);

	if (errors.length > 0) {
		console.log("\n── Errors ─────────────────────────────────");
		for (const e of errors) console.log(`  • ${e}`);
	}

	process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
