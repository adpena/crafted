#!/usr/bin/env tsx
/**
 * Candidate Mode — Crafted Action Pages Setup Wizard.
 * Usage: MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/candidate-init.ts
 * Zero external deps — Node built-ins only (readline, fetch).
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8788";
const TOKEN = process.env.MCP_ADMIN_TOKEN;

if (!TOKEN) {
	console.error("\nError: MCP_ADMIN_TOKEN environment variable is required.");
	console.error("  Usage: MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/candidate-init.ts\n");
	process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TemplateId = "petition" | "letter-to-congress" | "fundraise" | "gotv" | "event" | "signup";

interface BrandKit {
	source_url: string;
	name: string;
	colors: { primary: string; secondary: string; accent: string; background: string; text: string };
	fonts: { heading: string; body: string };
}
interface BrandThemeVariant {
	id: "on-brand" | "elevated" | "contrast" | "minimal";
	name: string;
	description: string;
	theme: Record<string, string>;
}
interface BrandExtractResponse { brand: BrandKit; variants: BrandThemeVariant[] }
interface RpcResponse {
	jsonrpc?: string;
	result?: { ok?: boolean; page_id?: string; data?: unknown };
	error?: { code: number; message: string };
}
interface WizardAnswers {
	candidate: string; website: string; committee: string; treasurer: string;
	actblue: string; jurisdiction: string; locale: string; templates: TemplateId[];
	themeChoice: string | Record<string, string>; brand?: BrandKit;
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.trim()
		.replace(/['"]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function banner(): void {
	console.log("");
	console.log("╔══════════════════════════════════════╗");
	console.log("║  Crafted Action Pages — Setup Wizard ║");
	console.log("╚══════════════════════════════════════╝");
	console.log("");
}

async function prompt(rl: readline.Interface, q: string, def?: string): Promise<string> {
	const suffix = def ? ` [${def}]` : "";
	const answer = (await rl.question(`${q}${suffix} `)).trim();
	return answer || def || "";
}

async function promptRequired(rl: readline.Interface, q: string): Promise<string> {
	while (true) {
		const answer = (await rl.question(`${q} `)).trim();
		if (answer) return answer;
		console.log("  (required)");
	}
}

async function brandExtract(url: string): Promise<BrandExtractResponse | null> {
	try {
		const res = await fetch(`${BASE_URL}/api/admin/brand-extract`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify({ url }),
		});
		if (!res.ok) {
			const text = await res.text();
			console.log(`  Brand extraction failed: HTTP ${res.status} — ${text.slice(0, 120)}`);
			return null;
		}
		return (await res.json()) as BrandExtractResponse;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`  Brand extraction failed: ${msg}`);
		return null;
	}
}

async function rpc(method: string, params: Record<string, unknown>): Promise<RpcResponse> {
	try {
		const res = await fetch(`${BASE_URL}/api/mcp/actions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		});
		if (!res.ok) {
			return { error: { code: res.status, message: `HTTP ${res.status}: ${await res.text()}` } };
		}
		return (await res.json()) as RpcResponse;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { error: { code: -1, message: `Network error: ${msg}` } };
	}
}

const ALL_TEMPLATES: { id: TemplateId; default: boolean; label: string }[] = [
	{ id: "petition", default: true, label: "petition" },
	{ id: "letter-to-congress", default: true, label: "letter-to-congress" },
	{ id: "fundraise", default: true, label: "fundraise" },
	{ id: "gotv", default: false, label: "gotv" },
	{ id: "event", default: false, label: "event" },
	{ id: "signup", default: false, label: "signup" },
];

function buildPageConfig(tpl: TemplateId, a: WizardAnswers): Record<string, unknown> {
	const candSlug = slugify(a.candidate);
	const disclaimer: Record<string, string> = { committee_name: a.committee };
	if (a.treasurer) disclaimer.treasurer_name = a.treasurer;

	const base = {
		disclaimer,
		theme: a.themeChoice,
		locale: a.locale,
		jurisdiction: a.jurisdiction,
		consent: { required: true },
		sharing: { enabled: true },
	};

	switch (tpl) {
		case "petition":
			return {
				...base,
				slug: `${candSlug}-petition`,
				template: "hero-story",
				template_props: {
					headline: `Stand with ${a.candidate}`,
					subhead: "Add your name to show your support for our campaign and our values.",
					body:
						"We're building a people-powered campaign, and every signature sends a message about who we're fighting for.\n\nAdd your name below to join thousands of supporters standing up for our community.",
				},
				action: "petition",
				action_props: {
					target: a.jurisdiction === "federal" ? "Congress" : `${a.jurisdiction} Legislature`,
					goal: 10000,
				},
				sharing: { enabled: true, text: `I just signed on with ${a.candidate} — join me:` },
			};

		case "letter-to-congress":
			return {
				...base,
				slug: `${candSlug}-letter`,
				template: "hero-story",
				template_props: {
					headline: "Write your representatives",
					subhead: "Personal letters from constituents carry more weight than form letters. Share your story.",
					body:
						"We'll look up your elected officials and pre-fill a letter template. You can edit every word before sending — the more personal, the more effective.",
				},
				action: "letter",
				action_props: {
					subject: `A message from a constituent supporting ${a.candidate}`,
					letter_template:
						"Dear {{rep_name}},\n\nAs your constituent, I'm writing to share what matters to me in this election.\n\n[Share your story here — a few sentences in your own words go further than a form letter.]\n\nThank you for your service,",
					rep_level: a.jurisdiction === "federal" ? "both" : "state",
					talking_points: [
						"Constituent voices matter more than lobbyist talking points",
						"Personal stories are more persuasive than form letters",
						"Every letter is logged and counted by congressional staff",
					],
				},
			};

		case "fundraise":
			return {
				...base,
				slug: `${candSlug}-fundraise`,
				template: "hero-layered",
				template_props: {
					eyebrow: "Chip in today",
					headline: `Support ${a.candidate}`,
					subhead: "Grassroots donations power this campaign. Every dollar goes directly to reaching voters.",
					overlay: "dark",
					overlay_opacity: 0.5,
					content_position: "bottom-left",
					content_color: "#ffffff",
				},
				action: "fundraise",
				action_props: {
					amounts: [10, 25, 50, 100, 250, 500],
					actblue_url: a.actblue || undefined,
				},
				sharing: { enabled: true, text: `I just donated to ${a.candidate} — chip in with me:` },
			};

		case "gotv":
			return {
				...base,
				slug: `${candSlug}-pledge`,
				template: "hero-split",
				template_props: {
					headline: "Pledge to vote",
					subhead: "Take the pledge, and we'll remind you before election day.",
					body: "Your vote is your voice. Commit to showing up — for yourself and for your community.",
				},
				action: "gotv",
				action_props: {
					pledge_text: `I pledge to vote in the next election and support ${a.candidate}.`,
				},
			};

		case "event":
			return {
				...base,
				slug: `${candSlug}-event`,
				template: "hero-media",
				template_props: {
					headline: `Meet ${a.candidate}`,
					subhead: "Join us for a community conversation.",
				},
				action: "event",
				action_props: {
					event_name: `Meet ${a.candidate}`,
					event_description: "Details coming soon. RSVP to be notified of time and location.",
					allow_guests: true,
					offer_calendar: true,
				},
			};

		case "signup":
			return {
				...base,
				slug: `${candSlug}-signup`,
				template: "hero-media",
				template_props: {
					headline: `Stay in touch with ${a.candidate}`,
					subhead: "Sign up for campaign updates, events, and volunteer opportunities.",
				},
				action: "signup",
				action_props: {
					list_name: `${a.candidate} Supporters`,
					cta_text: "Keep me posted",
				},
			};
	}
}

async function main(): Promise<void> {
	banner();
	const rl = readline.createInterface({ input, output });

	try {
		const candidate = await promptRequired(rl, "What's your candidate or organization name?");
		const website = await prompt(rl, "What's your website URL? (We'll extract your brand colors and fonts)");
		const committee = await promptRequired(rl, "What's your committee name? (for FEC disclaimer)");
		const treasurer = await prompt(rl, "What's your treasurer name? (optional)");
		const actblue = await prompt(rl, "What's your ActBlue donation URL? (optional)");
		const jurisdiction = await promptRequired(rl, "Where are you running? (US state code or 'federal')");
		const locale = await prompt(rl, "What's your default page language? (en/es/zh/vi/ko/tl/fr/ar)", "en");

		// Template selection
		console.log("\nWhich templates do you want to seed?");
		for (let i = 0; i < ALL_TEMPLATES.length; i++) {
			const t = ALL_TEMPLATES[i];
			console.log(`  ${i + 1}) [${t.default ? "x" : " "}] ${t.label}`);
		}
		const tplDefault = ALL_TEMPLATES
			.map((t, i) => (t.default ? String(i + 1) : ""))
			.filter(Boolean)
			.join(",");
		const tplRaw = await prompt(
			rl,
			"Enter comma-separated numbers (e.g. 1,2,3), or press enter for defaults:",
			tplDefault,
		);
		const selectedIdxs = tplRaw
			.split(",")
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n) && n >= 1 && n <= ALL_TEMPLATES.length);
		const templates: TemplateId[] = selectedIdxs.length
			? selectedIdxs.map((i) => ALL_TEMPLATES[i - 1].id)
			: ALL_TEMPLATES.filter((t) => t.default).map((t) => t.id);

		// Brand extraction
		let themeChoice: string | Record<string, string> = "warm";
		let brand: BrandKit | undefined;
		if (website) {
			console.log(`\nExtracting brand from ${website}…`);
			const extracted = await brandExtract(website);
			if (extracted?.brand && extracted.variants?.length) {
				brand = extracted.brand;
				const host = (() => {
					try { return new URL(website).hostname.replace(/^www\./, ""); }
					catch { return website; }
				})();
				console.log(`\nExtracted brand from ${host}:`);
				console.log(`  Primary: ${brand.colors.primary}`);
				console.log(`  Accent: ${brand.colors.accent}`);
				console.log(`  Heading font: ${brand.fonts.heading}`);
				console.log(`  Body font: ${brand.fonts.body}`);

				console.log("\nTheme variants:");
				extracted.variants.forEach((v, i) => {
					console.log(`  ${i + 1}) ${v.id} — ${v.name}: ${v.description}`);
				});
				const defaultIdx = extracted.variants.findIndex((v) => v.id === "on-brand");
				const pickRaw = await prompt(
					rl,
					"Which variant? (number)",
					String((defaultIdx >= 0 ? defaultIdx : 0) + 1),
				);
				const pickIdx = Math.min(
					Math.max(parseInt(pickRaw, 10) || 1, 1),
					extracted.variants.length,
				) - 1;
				themeChoice = extracted.variants[pickIdx].theme;
			} else {
				console.log("  Falling back to default theme 'warm'.");
			}
		}

		const answers: WizardAnswers = {
			candidate, website, committee, treasurer, actblue,
			jurisdiction, locale, templates, themeChoice, brand,
		};

		// Create pages
		console.log(`\nCreating ${templates.length} action page(s) at ${BASE_URL}…\n`);
		const created: { slug: string; ok: boolean; error?: string }[] = [];
		for (const tpl of templates) {
			const page = buildPageConfig(tpl, answers);
			const slug = page.slug as string;
			process.stdout.write(`  ${slug.padEnd(40)} `);
			const result = await rpc("create_page", page);
			if (result.error) {
				console.log(`✗ ${result.error.message}`);
				created.push({ slug, ok: false, error: result.error.message });
			} else {
				console.log("✓");
				created.push({ slug, ok: true });
			}
		}

		// Summary
		const okPages = created.filter((c) => c.ok);
		console.log("");
		if (okPages.length) {
			console.log(`✓ Created ${okPages.length} action page${okPages.length === 1 ? "" : "s"} for ${candidate}:`);
			for (const p of okPages) {
				console.log(`  ${BASE_URL}/action/${p.slug}`);
			}
			console.log("");
			console.log("Next steps:");
			console.log(`  1. Visit the admin at ${BASE_URL}/_emdash/admin/plugins/action-pages`);
			console.log("  2. Customize the copy and images");
			console.log("  3. Test a submission on each page");
			console.log("  4. Share the links with your list");
		} else {
			console.log("No pages were created successfully. Check the errors above.");
		}

		const failed = created.filter((c) => !c.ok);
		if (failed.length) {
			console.log(`\n${failed.length} page(s) failed:`);
			for (const f of failed) console.log(`  ${f.slug}: ${f.error}`);
		}
	} finally {
		rl.close();
	}
}

main().catch((err) => {
	const msg = err instanceof Error ? err.message : String(err);
	console.error(`\nWizard failed: ${msg}`);
	process.exit(1);
});
