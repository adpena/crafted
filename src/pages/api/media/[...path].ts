/**
 * Public media server — serves R2 objects with caching.
 *
 * GET /api/media/action-pages/2026/04/abc.jpg
 *
 * Public, cacheable, immutable. Only serves files under "action-pages/" prefix
 * to prevent enumeration of other R2 buckets.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const ALLOWED_PREFIX = "action-pages/";
const PATH_RE = /^action-pages\/\d{4}\/\d{2}\/[a-f0-9-]+\.[a-z0-9]{1,5}$/;

export const GET: APIRoute = async ({ params }) => {
	const path = (params.path as string | undefined) ?? "";
	if (!path.startsWith(ALLOWED_PREFIX) || !PATH_RE.test(path)) {
		return new Response("Not found", { status: 404 });
	}

	const r2 = (env as Record<string, unknown>).MEDIA as R2Bucket | undefined;
	if (!r2) {
		return new Response("Storage not available", { status: 503 });
	}

	const obj = await r2.get(path);
	if (!obj) {
		return new Response("Not found", { status: 404 });
	}

	// Allowlist MIME types to prevent stored XSS via crafted R2 objects.
	// Only serve content types that are safe to render in a browser.
	const SAFE_MIME = new Set([
		"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
		"image/avif", "video/mp4", "video/webm", "application/pdf",
	]);
	const rawType = obj.httpMetadata?.contentType ?? "";
	const contentType = SAFE_MIME.has(rawType) ? rawType : "application/octet-stream";

	return new Response(obj.body, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Length": String(obj.size),
		},
	});
};

interface R2Bucket {
	get(key: string): Promise<R2Object | null>;
}

interface R2Object {
	body: ReadableStream;
	httpMetadata?: { contentType?: string };
	size: number;
}
