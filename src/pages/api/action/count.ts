/**
 * Public endpoint returning the submission count for an action page.
 * Reads from KV cache first (<1ms edge reads), falls back to D1.
 *
 * GET /api/action/count?slug=my-petition
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SLUG_RE } from "../../../lib/slug.ts";

const PLUGIN_ID = "action-pages";

export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");
	if (!slug || !SLUG_RE.test(slug)) {
		return new Response(
			JSON.stringify({ error: "Invalid slug" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const kv = (env as Record<string, unknown>).CACHE as {
		get: (key: string) => Promise<string | null>;
		put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
	} | undefined;

	const db = (env as Record<string, unknown>).DB as {
		prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<Record<string, unknown> | null> } };
	};

	let count = 0;

	// Try KV first — sub-millisecond edge reads
	if (kv) {
		try {
			const [cachedCount, cachedRaised] = await Promise.all([
				kv.get(`action-count:${slug}`),
				kv.get(`donation-total:${slug}`),
			]);
			if (cachedCount !== null) {
				const raisedCents = cachedRaised !== null ? parseInt(cachedRaised, 10) : 0;
				const result: Record<string, number> = { count: parseInt(cachedCount, 10) };
				if (raisedCents > 0) result.raised = raisedCents / 100;
				return new Response(
					JSON.stringify(result),
					{
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"Cache-Control": "public, max-age=5",
							"X-Cache": "KV",
						},
					},
				);
			}
		} catch {
			// Fall through to D1
		}
	}

	// Fall back to D1 query
	try {
		const row = await db.prepare(
			"SELECT COUNT(*) as count FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ?"
		).bind(PLUGIN_ID, slug).first();

		count = (row as Record<string, number>)?.count ?? 0;

		// Backfill KV cache for next request
		if (kv) {
			try {
				await kv.put(`action-count:${slug}`, String(count), { expirationTtl: 86400 * 30 });
			} catch {
				// Non-fatal
			}
		}
	} catch {
		// D1 failure — return 0
	}

	return new Response(
		JSON.stringify({ count }),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=10",
				"X-Cache": "D1",
			},
		},
	);
};
