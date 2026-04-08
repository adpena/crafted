/**
 * AI-powered Action Page generator endpoint.
 *
 * POST /api/admin/generate-page
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Body: { description: string, brandUrl?: string, preferredAction?: string }
 *
 * Returns a generated ActionPageConfig produced by the Anthropic API.
 *
 * Security:
 *  - Timing-safe Bearer auth.
 *  - Never logs the API key, request body, or raw description.
 *  - Generic error messages — no internal details leak to the client.
 *  - Inputs are length-validated and brandUrl is restricted to https://.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateActionPage } from "../../../lib/ai-generator.ts";
import { verifyBearer } from "../../../lib/auth.ts";

const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 2000;
const OUTER_TIMEOUT_MS = 30_000;

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

	let body: { description?: unknown; brandUrl?: unknown; preferredAction?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return json(400, { error: "Invalid JSON" });
	}

	if (typeof body.description !== "string") {
		return json(400, { error: "Missing 'description'" });
	}
	const description = body.description.trim();
	if (description.length < MIN_DESCRIPTION || description.length > MAX_DESCRIPTION) {
		return json(400, {
			error: `'description' must be ${MIN_DESCRIPTION}-${MAX_DESCRIPTION} characters`,
		});
	}

	let brandUrl: string | undefined;
	if (body.brandUrl !== undefined) {
		if (typeof body.brandUrl !== "string" || !body.brandUrl.startsWith("https://") || body.brandUrl.length > 2048) {
			return json(400, { error: "'brandUrl' must be an https:// URL" });
		}
		brandUrl = body.brandUrl;
	}

	let preferredAction: string | undefined;
	if (body.preferredAction !== undefined) {
		if (typeof body.preferredAction !== "string" || body.preferredAction.length > 32) {
			return json(400, { error: "'preferredAction' is invalid" });
		}
		preferredAction = body.preferredAction;
	}

	const apiKey = (env as Record<string, unknown>).ANTHROPIC_API_KEY as string | undefined;
	if (!apiKey) {
		return json(503, { error: "AI generator not configured" });
	}

	// KV cache — 1 hour
	const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
	const cacheKey = `ai-page:${await sha256(`${description}|${brandUrl ?? ""}|${preferredAction ?? ""}`)}`;
	if (kv) {
		try {
			const cached = await kv.get(cacheKey);
			if (cached) {
				return new Response(cached, {
					status: 200,
					headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
				});
			}
		} catch {
			// Non-fatal
		}
	}

	// Outer timeout
	const outerTimer = AbortSignal.timeout(OUTER_TIMEOUT_MS);
	try {
		const result = await Promise.race([
			generateActionPage({
				description,
				brandUrl,
				preferredAction,
				anthropicApiKey: apiKey,
				brandExtractBaseUrl: new URL(request.url).origin,
				brandExtractBearer: token,
			}),
			new Promise<never>((_, reject) => {
				outerTimer.addEventListener("abort", () => reject(new Error("Outer timeout")));
			}),
		]);

		const responseBody = JSON.stringify(result);
		if (kv) {
			try {
				await kv.put(cacheKey, responseBody, { expirationTtl: 3600 });
			} catch {
				// Non-fatal
			}
		}

		return new Response(responseBody, {
			status: 200,
			headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
		});
	} catch (err) {
		// Generic error — never leak Anthropic details or stack traces.
		const safe = err instanceof Error && err.message === "Outer timeout"
			? "Generation timed out"
			: "Generation failed";
		console.error("[generate-page] error:", safe);
		return json(502, { error: safe });
	}
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}

async function sha256(input: string): Promise<string> {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
