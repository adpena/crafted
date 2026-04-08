/**
 * Authenticated CSV export for action page submissions.
 *
 * GET /api/action/export?slug=my-petition
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns CSV with columns: id, type, first_name, last_name, email, zip,
 * comment, visitor_id, variant, country, created_at
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";
import { SLUG_RE } from "../../../lib/slug.ts";

const PLUGIN_ID = "action-pages";

export const GET: APIRoute = async ({ url, request }) => {
	// Auth check — timing-safe comparison to prevent token extraction
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return new Response(
			JSON.stringify({ error: "Unauthorized" }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}

	const slug = url.searchParams.get("slug");
	if (!slug || !SLUG_RE.test(slug)) {
		return new Response(
			JSON.stringify({ error: "Invalid slug" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const format = url.searchParams.get("format") ?? "csv";
	// Cap at 5,000 rows per export to stay within Worker memory budget.
	// For larger exports, callers should paginate by created_at range.
	const rawLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
	const limit = isNaN(rawLimit) || rawLimit <= 0 ? 1000 : Math.min(rawLimit, 5000);

	const db = (env as Record<string, unknown>).DB as {
		prepare: (sql: string) => {
			bind: (...args: unknown[]) => {
				all: () => Promise<{ results: Array<Record<string, unknown>> }>;
			};
		};
	};

	try {
		const { results } = await db.prepare(
			"SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ? ORDER BY created_at DESC LIMIT ?"
		).bind(PLUGIN_ID, slug, limit).all();

		if (format === "json") {
			const EXPORT_DATA_KEYS = ["first_name", "last_name", "email", "zip", "comment", "amount"];
			const rows = results.map((r) => {
				const d = JSON.parse(r.data as string);
				const data = d.data as Record<string, unknown> ?? {};
				const picked: Record<string, unknown> = {};
				for (const k of EXPORT_DATA_KEYS) {
					if (k in data) picked[k] = data[k];
				}
				return {
					id: r.id,
					type: d.type,
					...picked,
					visitor_id: d.visitor_id,
					variant: d.variant,
					country: d.country,
					created_at: d.created_at,
				};
			});
			return new Response(
				JSON.stringify({ data: rows, count: rows.length }),
				{
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "private, no-cache",
					},
				},
			);
		}

		// CSV output
		const csvRows: string[] = [];

		// Collect all unique field names across all submissions
		const fieldSet = new Set<string>(["type", "visitor_id", "variant", "country", "created_at"]);
		const parsed = results.map((r) => {
			const d = JSON.parse(r.data as string);
			const data = d.data as Record<string, unknown> ?? {};
			for (const key of Object.keys(data)) fieldSet.add(key);
			return { id: r.id, ...d, data };
		});

		const dataFields = [...fieldSet].filter(f => !["type", "visitor_id", "variant", "country", "created_at"].includes(f)).sort();
		const headers = ["id", "type", ...dataFields, "visitor_id", "variant", "country", "created_at"];
		csvRows.push(headers.join(","));

		for (const row of parsed) {
			const values = headers.map((h) => {
				let val: unknown;
				if (h === "id") val = row.id;
				else if (h === "type") val = row.type;
				else if (h === "visitor_id") val = row.visitor_id;
				else if (h === "variant") val = row.variant;
				else if (h === "country") val = row.country;
				else if (h === "created_at") val = row.created_at;
				else val = row.data?.[h];
				return csvEscape(val);
			});
			csvRows.push(values.join(","));
		}

		const csv = csvRows.join("\n");
		return new Response(csv, {
			status: 200,
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${slug}-submissions.csv"`,
				"Cache-Control": "private, no-cache",
			},
		});
	} catch (err) {
		console.error("[export] D1 query failed:", err instanceof Error ? err.message : "unknown");
		return new Response(
			JSON.stringify({ error: "Export failed" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
};

function csvEscape(value: unknown): string {
	if (value == null) return "";
	const str = String(value);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}
