/**
 * Authenticated brand extraction from a URL.
 *
 * POST /api/admin/brand-extract
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Body: { "url": "https://example.com" }
 *
 * Returns:
 *   {
 *     brand: BrandKit,
 *     variants: BrandThemeVariant[]  // 4 variants ready to apply to action pages
 *   }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { extractBrand } from "../../../lib/brand/extractor.ts";
import { generateThemeVariants } from "../../../lib/brand/generator.ts";
import { logAudit } from "../../../lib/audit.ts";
import { verifyBearer } from "../../../lib/auth.ts";

export const POST: APIRoute = async ({ request }) => {
	// Auth — timing-safe
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return json(401, { error: "Unauthorized" });
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return json(415, { error: "Content-Type must be application/json" });
	}

	let body: { url?: string };
	try {
		body = await request.json() as { url?: string };
	} catch {
		return json(400, { error: "Invalid JSON" });
	}

	if (!body.url || typeof body.url !== "string" || body.url.length > 2048) {
		return json(400, { error: "Missing or invalid 'url' field" });
	}

	// KV cache (24 hour TTL) to avoid hammering external sites
	const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
	const cacheKey = `brand:${body.url}`;
	if (kv) {
		try {
			const cached = await kv.get(cacheKey);
			if (cached) {
				return new Response(cached, {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"X-Cache": "HIT",
					},
				});
			}
		} catch {
			// Fall through
		}
	}

	try {
		const brand = await extractBrand(body.url);
		const variants = generateThemeVariants(brand);
		const result = { brand, variants };
		const responseBody = JSON.stringify(result);

		// Cache for 24 hours
		if (kv) {
			try {
				await kv.put(cacheKey, responseBody, { expirationTtl: 86400 });
			} catch {
				// Non-fatal
			}
		}

		const db = (env as Record<string, unknown>).DB as Parameters<typeof logAudit>[0];
		if (db) await logAudit(db, { action: "brand_extract", target: body.url.slice(0, 500), actor: "admin", metadata: { variants: variants.length }, request }).catch(() => {});

		return new Response(responseBody, {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"X-Cache": "MISS",
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Brand extraction failed";
		console.error("[brand-extract] error:", message);
		return json(400, { error: message });
	}
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}

interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
