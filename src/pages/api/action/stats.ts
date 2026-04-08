/**
 * Authenticated stats endpoint with A/B variant breakdown.
 *
 * GET /api/action/stats?slug=my-petition
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 *
 * Returns:
 *   {
 *     slug: string,
 *     total: number,
 *     by_variant: { [variant]: { count, percentage } },
 *     by_country: { [country]: number },
 *     by_day: { [date]: number },
 *     significance?: { variant_a, variant_b, p_value, winner }
 *   }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";
import { SLUG_RE } from "../../../lib/slug.ts";

const PLUGIN_ID = "action-pages";

export const GET: APIRoute = async ({ url, request }) => {
	// Auth check — timing-safe
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return json(401, { error: "Unauthorized" });
	}

	const slug = url.searchParams.get("slug");
	if (!slug || !SLUG_RE.test(slug)) {
		return json(400, { error: "Invalid slug" });
	}

	const db = (env as Record<string, unknown>).DB as {
		prepare: (sql: string) => {
			bind: (...args: unknown[]) => {
				all: () => Promise<{ results: Array<Record<string, unknown>> }>;
				first: () => Promise<Record<string, unknown> | null>;
			};
		};
	};

	try {
		// SQL GROUP BY aggregations — D1 computes these in SQLite, no JS loop over
		// potentially 50k rows. Memory-safe and CPU-bounded.
		const baseWhere = "plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ?";

		const [totalRow, variantRows, countryRows, dayRows] = await Promise.all([
			db.prepare(`SELECT COUNT(*) as cnt FROM _plugin_storage WHERE ${baseWhere}`)
				.bind(PLUGIN_ID, slug).first(),
			db.prepare(
				`SELECT COALESCE(json_extract(data, '$.variant'), 'control') as variant, COUNT(*) as cnt
				 FROM _plugin_storage WHERE ${baseWhere}
				 GROUP BY variant ORDER BY cnt DESC LIMIT 100`
			).bind(PLUGIN_ID, slug).all(),
			db.prepare(
				`SELECT COALESCE(json_extract(data, '$.country'), 'unknown') as country, COUNT(*) as cnt
				 FROM _plugin_storage WHERE ${baseWhere}
				 GROUP BY country ORDER BY cnt DESC LIMIT 100`
			).bind(PLUGIN_ID, slug).all(),
			db.prepare(
				`SELECT substr(created_at, 1, 10) as day, COUNT(*) as cnt
				 FROM _plugin_storage WHERE ${baseWhere}
				 GROUP BY day ORDER BY day DESC LIMIT 365`
			).bind(PLUGIN_ID, slug).all(),
		]);

		const total = Number(totalRow?.cnt ?? 0);

		const byVariant: Record<string, number> = {};
		for (const row of variantRows.results) {
			byVariant[String(row.variant ?? "control")] = Number(row.cnt ?? 0);
		}

		const byCountry: Record<string, number> = {};
		for (const row of countryRows.results) {
			byCountry[String(row.country ?? "unknown")] = Number(row.cnt ?? 0);
		}

		const byDay: Record<string, number> = {};
		for (const row of dayRows.results) {
			byDay[String(row.day ?? "")] = Number(row.cnt ?? 0);
		}

		// Compute variant percentages
		const variantStats: Record<string, { count: number; percentage: number }> = {};
		for (const [v, c] of Object.entries(byVariant)) {
			variantStats[v] = {
				count: c,
				percentage: total > 0 ? Math.round((c / total) * 1000) / 10 : 0,
			};
		}

		// Two-variant z-test for proportions (very basic significance hint)
		const variants = Object.keys(byVariant);
		let significance: { variant_a: string; variant_b: string; p_value: number; winner: string | null } | undefined;
		if (variants.length === 2) {
			const a = variants[0]!;
			const b = variants[1]!;
			const ca = byVariant[a]!;
			const cb = byVariant[b]!;
			const half = Math.floor(total / 2);
			// Simple z-test: assumes equal traffic split
			const pa = ca / Math.max(1, half);
			const pb = cb / Math.max(1, half);
			const pPool = (ca + cb) / Math.max(1, total);
			const se = Math.sqrt(pPool * (1 - pPool) * (2 / Math.max(1, half)));
			const z = se > 0 ? (pa - pb) / se : 0;
			// Approximate p-value via normal CDF (rough)
			const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
			significance = {
				variant_a: a,
				variant_b: b,
				p_value: Math.round(pValue * 1000) / 1000,
				winner: pValue < 0.05 ? (pa > pb ? a : b) : null,
			};
		}

		return json(200, {
			slug,
			total,
			by_variant: variantStats,
			by_country: byCountry,
			by_day: byDay,
			significance,
		});
	} catch (err) {
		console.error("[stats] D1 query failed:", err instanceof Error ? err.message : "unknown");
		return json(500, { error: "Stats query failed" });
	}
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}

/** Normal CDF approximation (Abramowitz & Stegun 26.2.17) */
function normalCdf(z: number): number {
	const t = 1 / (1 + 0.2316419 * Math.abs(z));
	const d = 0.3989423 * Math.exp(-z * z / 2);
	const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
	return z > 0 ? 1 - p : p;
}
