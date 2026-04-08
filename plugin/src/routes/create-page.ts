import type { RouteContext, PluginContext } from "emdash";
import { SLUG_RE } from "../lib/slug.ts";
const KNOWN_TEMPLATES = new Set(["hero-simple", "hero-media", "hero-story", "hero-layered", "hero-split"]);
const KNOWN_ACTIONS = new Set(["fundraise", "petition", "gotv", "signup"]);
const KNOWN_FOLLOWUPS = new Set(["fundraise", "signup"]);

export async function handleCreatePage(routeCtx: RouteContext, ctx: PluginContext) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime-validated JSON-RPC input
	const body = (routeCtx.input ?? {}) as Record<string, any>;

	// Validate slug
	if (!body.slug || typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) {
		return { status: 400, body: { error: { code: "INVALID_SLUG", message: "Invalid slug. Use lowercase letters, numbers, and hyphens." } } };
	}

	// Validate template
	if (!body.template || !KNOWN_TEMPLATES.has(body.template)) {
		return { status: 400, body: { error: { code: "INVALID_TEMPLATE", message: `Unknown template. Available: ${[...KNOWN_TEMPLATES].join(", ")}` } } };
	}

	// Validate action
	if (!body.action || !KNOWN_ACTIONS.has(body.action)) {
		return { status: 400, body: { error: { code: "INVALID_ACTION", message: `Unknown action. Available: ${[...KNOWN_ACTIONS].join(", ")}` } } };
	}

	// Validate followup
	if (body.followup && !KNOWN_FOLLOWUPS.has(body.followup)) {
		return { status: 400, body: { error: { code: "INVALID_FOLLOWUP", message: `Unknown followup. Available: ${[...KNOWN_FOLLOWUPS].join(", ")}` } } };
	}

	// Validate ActBlue URL for fundraise actions
	if (body.action === "fundraise" || body.followup === "fundraise") {
		const url = body.action_props?.actblue_url || body.followup_props?.actblue_url;
		if (url) {
			try {
				const parsed = new URL(url);
				if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("actblue.com")) {
					return { status: 400, body: { error: { code: "INVALID_URL", message: "ActBlue URL must be HTTPS on actblue.com" } } };
				}
			} catch {
				return { status: 400, body: { error: { code: "INVALID_URL", message: "Invalid ActBlue URL" } } };
			}
		}
	}

	// Check for duplicate slug
	const existing = await ctx.storage.action_pages!.query({ where: { slug: body.slug } });
	if (existing.items.length > 0) {
		return { status: 409, body: { error: { code: "CONFLICT", message: `Page with slug "${body.slug}" already exists` } } };
	}

	// Store the page
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await ctx.storage.action_pages!.put(id, {
		slug: body.slug,
		campaign_id: body.campaign_id ?? null,
		template: body.template,
		template_props: body.template_props ?? {},
		action: body.action,
		action_props: body.action_props ?? {},
		followup: body.followup ?? null,
		followup_props: body.followup_props ?? {},
		followup_message: body.followup_message ?? null,
		disclaimer: body.disclaimer ?? {},
		theme: body.theme ?? "warm",
		callbacks: body.callbacks ?? [],
		status: "draft",
		created_at: now,
		updated_at: now,
	});

	return { status: 200, body: { data: { ok: true, page_id: id } } };
}
