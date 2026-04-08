/**
 * AI-powered A/B headline variant generator.
 *
 * POST /api/admin/generate-variants
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Body: { headline: string, context?: string, count?: number (1-5, default 3) }
 *
 * Returns: { variants: string[] }
 *
 * Security:
 *  - Timing-safe Bearer auth.
 *  - Never logs the API key or input.
 *  - Generic error messages.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../lib/auth.ts";

const MIN_HEADLINE = 5;
const MAX_HEADLINE = 200;
const MAX_CONTEXT = 1000;
const DEFAULT_COUNT = 3;
const MAX_COUNT = 5;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `You are a political campaign copywriter. Generate alternative headlines that test different persuasion angles (urgency, hope, fear, facts, personal stake).

Output rules:
- Return ONLY a JSON array of strings.
- No markdown, no code fences, no commentary.
- Each string must be under 120 characters.
- Each variant should test a distinct angle from the others.`;

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

	let body: { headline?: unknown; context?: unknown; count?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return json(400, { error: "Invalid JSON" });
	}

	if (typeof body.headline !== "string") {
		return json(400, { error: "Missing 'headline'" });
	}
	const headline = body.headline.trim();
	if (headline.length < MIN_HEADLINE || headline.length > MAX_HEADLINE) {
		return json(400, {
			error: `'headline' must be ${MIN_HEADLINE}-${MAX_HEADLINE} characters`,
		});
	}

	let context = "";
	if (body.context !== undefined) {
		if (typeof body.context !== "string" || body.context.length > MAX_CONTEXT) {
			return json(400, { error: "'context' is invalid" });
		}
		context = body.context.trim();
	}

	let count = DEFAULT_COUNT;
	if (body.count !== undefined) {
		if (typeof body.count !== "number" || !Number.isInteger(body.count)) {
			return json(400, { error: "'count' must be an integer" });
		}
		if (body.count < 1 || body.count > MAX_COUNT) {
			return json(400, { error: `'count' must be between 1 and ${MAX_COUNT}` });
		}
		count = body.count;
	}

	const apiKey = (env as Record<string, unknown>).ANTHROPIC_API_KEY as string | undefined;
	if (!apiKey) {
		return json(503, { error: "AI generator not configured" });
	}

	// KV cache — 1 hour
	const kv = (env as Record<string, unknown>).CACHE as KVNamespace | undefined;
	const cacheKey = `ai-variants:${await sha256(`${headline}|${context}|${count}`)}`;
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

	const userPrompt = [
		`Original headline: ${headline}`,
		context ? `Campaign context: ${context}` : "",
		`Generate ${count} alternative headlines as a JSON array of strings. JSON only.`,
	].filter(Boolean).join("\n\n");

	let res: Response;
	try {
		res = await fetch(ANTHROPIC_URL, {
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: ANTHROPIC_MODEL,
				max_tokens: 1024,
				system: SYSTEM_PROMPT,
				messages: [{ role: "user", content: userPrompt }],
			}),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (err) {
		const safe = err instanceof Error && err.name === "TimeoutError"
			? "Generation timed out"
			: "Generation failed";
		console.error("[generate-variants] error:", safe);
		return json(502, { error: safe });
	}

	if (!res.ok) {
		console.error("[generate-variants] upstream status:", res.status);
		return json(502, { error: "Generation failed" });
	}

	let payload: { content?: Array<{ type?: string; text?: string }> };
	try {
		payload = (await res.json()) as typeof payload;
	} catch {
		return json(502, { error: "Generation failed" });
	}

	const text = payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
	if (!text) {
		return json(502, { error: "Generation failed" });
	}

	const variants = parseVariants(text, count);
	if (!variants) {
		return json(502, { error: "Generation failed" });
	}

	const responseBody = JSON.stringify({ variants });
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
};

function parseVariants(text: string, max: number): string[] | null {
	let cleaned = text.trim();
	if (cleaned.startsWith("```")) {
		cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
	}
	if (!cleaned.startsWith("[")) {
		const first = cleaned.indexOf("[");
		const last = cleaned.lastIndexOf("]");
		if (first >= 0 && last > first) {
			cleaned = cleaned.slice(first, last + 1);
		}
	}
	try {
		const parsed = JSON.parse(cleaned);
		if (!Array.isArray(parsed)) return null;
		const strings = parsed
			.filter((v): v is string => typeof v === "string")
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s.length <= 200)
			.slice(0, max);
		return strings.length > 0 ? strings : null;
	} catch {
		return null;
	}
}

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
