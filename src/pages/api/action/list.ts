/**
 * Authenticated paginated submissions list.
 *
 * GET /api/action/list?slug=my-petition&limit=50&offset=0&q=search&variant=control
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns paginated submissions with optional search and variant filtering.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";
import { SLUG_RE } from "../../../lib/slug.ts";

const PLUGIN_ID = "action-pages";
const MAX_LIMIT = 200;
const ALLOWED_FIELDS = ["first_name", "last_name", "email", "zip", "comment", "amount"];

export const GET: APIRoute = async ({ url, request }) => {
	// Auth
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return json(401, { error: "Unauthorized" });
	}

	const slug = url.searchParams.get("slug");
	if (!slug || !SLUG_RE.test(slug)) {
		return json(400, { error: "Invalid slug" });
	}

	const rawLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
	const limit = isNaN(rawLimit) || rawLimit <= 0 ? 50 : Math.min(rawLimit, MAX_LIMIT);

	const rawOffset = parseInt(url.searchParams.get("offset") ?? "", 10);
	const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

	const search = (url.searchParams.get("q") ?? "").slice(0, 100).toLowerCase();
	const variantFilter = (url.searchParams.get("variant") ?? "").slice(0, 50);

	const db = (env as Record<string, unknown>).DB as {
		prepare: (sql: string) => {
			bind: (...args: unknown[]) => {
				all: () => Promise<{ results: Array<Record<string, unknown>> }>;
				first: () => Promise<Record<string, unknown> | null>;
			};
		};
	};

	try {
		// Total count for pagination
		const countRow = await db.prepare(
			"SELECT COUNT(*) as total FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ?"
		).bind(PLUGIN_ID, slug).first();
		const totalAll = (countRow?.total as number) ?? 0;

		// Fetch page (filter in JS since D1 JSON queries can't easily search nested fields).
		// Over-fetch capped at 500 rows to bound Worker memory — matches the
		// 500-row cap used across contacts/audit-log/webhook-inbox endpoints.
		const fetchLimit = (search || variantFilter) ? Math.min(MAX_LIMIT * 3, 500) : limit;
		const fetchOffset = (search || variantFilter) ? 0 : offset;

		const { results } = await db.prepare(
			"SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
		).bind(PLUGIN_ID, slug, fetchLimit, fetchOffset).all();

		// Parse and shape rows, filtering to allowlisted fields only
		let rows = results.map((r) => {
			const d = JSON.parse(r.data as string);
			const data = (d.data as Record<string, unknown>) ?? {};
			const picked: Record<string, unknown> = {};
			for (const k of ALLOWED_FIELDS) if (k in data) picked[k] = data[k];
			return {
				id: r.id as string,
				type: d.type as string,
				...picked,
				visitor_id: d.visitor_id as string | null,
				variant: (d.variant as string | null) ?? "control",
				country: (d.country as string | null) ?? null,
				created_at: d.created_at as string,
			};
		});

		// Apply variant filter
		if (variantFilter) {
			rows = rows.filter((r) => r.variant === variantFilter);
		}

		// Apply search across email, first_name, last_name, zip
		if (search) {
			rows = rows.filter((r) => {
				return [r.email, r.first_name, r.last_name, r.zip]
					.filter((v): v is string => typeof v === "string")
					.some((v) => v.toLowerCase().includes(search));
			});
		}

		const filteredTotal = (search || variantFilter) ? rows.length : totalAll;

		// Paginate filtered results
		if (search || variantFilter) {
			rows = rows.slice(offset, offset + limit);
		}

		return json(200, {
			data: rows,
			pagination: {
				total: filteredTotal,
				total_all: totalAll,
				limit,
				offset,
				has_more: offset + rows.length < filteredTotal,
			},
		});
	} catch (err) {
		console.error("[list] D1 query failed:", err instanceof Error ? err.message : "unknown");
		return json(500, { error: "Query failed" });
	}
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}

