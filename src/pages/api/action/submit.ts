/**
 * Bridge route: forwards action page form submissions to the plugin's submit handler.
 *
 * The React action components POST to /api/action/submit (a clean public URL).
 * This route forwards the request to the plugin's internal route which handles
 * validation, rate limiting, storage, and webhook dispatch.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const PLUGIN_ID = "action-pages";

export const POST: APIRoute = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(
			JSON.stringify({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const input = body as Record<string, unknown>;

	// Validate required fields
	if (!input.type || typeof input.type !== "string") {
		return new Response(
			JSON.stringify({ error: { code: "MISSING_FIELD", message: "type is required" } }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const ALLOWED_TYPES = new Set(["donation_click", "petition_sign", "gotv_pledge", "signup"]);
	if (!ALLOWED_TYPES.has(input.type)) {
		return new Response(
			JSON.stringify({ error: { code: "INVALID_TYPE", message: `Unknown type: ${String(input.type).slice(0, 32)}` } }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	if (!input.page_id && !input.pageId) {
		return new Response(
			JSON.stringify({ error: { code: "MISSING_FIELD", message: "page_id is required" } }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// Normalize pageId → page_id
	const normalized = {
		...input,
		page_id: input.page_id ?? input.pageId,
	};

	// Store directly in D1 (same logic as the plugin submit route)
	const db = (env as Record<string, unknown>).DB as {
		prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } };
	};

	const data = input.data as Record<string, unknown> | undefined;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	const submission = {
		page_id: normalized.page_id,
		campaign_id: (input as Record<string, unknown>).campaign_id ?? null,
		type: input.type,
		data: data ?? {},
		visitor_id: (input as Record<string, unknown>).visitor_id ?? (input as Record<string, unknown>).visitorId ?? null,
		variant: (input as Record<string, unknown>).variant ?? null,
		country: request.headers.get("cf-ipcountry") ?? null,
		city: null,
		created_at: now,
	};

	try {
		await db.prepare(
			"INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
		).bind(
			id, PLUGIN_ID, "submissions",
			JSON.stringify(submission),
			now, now,
		).run();
	} catch (err) {
		console.error("[submit] D1 write failed:", err);
		return new Response(
			JSON.stringify({ error: { code: "INTERNAL", message: "Failed to save submission" } }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response(
		JSON.stringify({ data: { ok: true, id } }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
