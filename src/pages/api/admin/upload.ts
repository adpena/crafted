/**
 * Authenticated image upload to R2.
 *
 * POST /api/admin/upload
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Content-Type: multipart/form-data
 * Form field: "file" (image/* only, max 5 MB)
 *
 * Response: { url, key, size, contentType }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { logAudit } from "../../../lib/audit.ts";
import { verifyBearer } from "../../../lib/auth.ts";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/svg+xml",
]);

export const POST: APIRoute = async ({ request }) => {
	// Auth — timing-safe
	const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
	if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
		return json(401, { error: "Unauthorized" });
	}

	// Content-Type check
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("multipart/form-data")) {
		return json(415, { error: "Content-Type must be multipart/form-data" });
	}

	// Size guard before parsing
	const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
	if (contentLength > MAX_SIZE + 8192) {
		return json(413, { error: "File exceeds 5 MB limit" });
	}

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json(400, { error: "Invalid form data" });
	}

	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return json(400, { error: "Missing 'file' field" });
	}

	if (file.size > MAX_SIZE) {
		return json(413, { error: "File exceeds 5 MB limit" });
	}

	if (!ALLOWED_TYPES.has(file.type)) {
		return json(400, { error: `Unsupported type: ${file.type}` });
	}

	const r2 = (env as Record<string, unknown>).MEDIA as R2Bucket | undefined;
	if (!r2) {
		return json(503, { error: "Storage not available" });
	}

	// Generate key: action-pages/YYYY/MM/uuid.ext
	const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
	const safeExt = ext.length > 0 && ext.length <= 5 ? ext : "bin";
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const id = crypto.randomUUID();
	const key = `action-pages/${yyyy}/${mm}/${id}.${safeExt}`;

	try {
		await r2.put(key, file.stream(), {
			httpMetadata: { contentType: file.type },
		});
	} catch (err) {
		console.error("[upload] R2 put failed:", err instanceof Error ? err.message : "unknown");
		return json(500, { error: "Upload failed" });
	}

	// Return public URL — assumes /api/media/[key] route serves the bucket
	const baseUrl = (env as Record<string, unknown>).PUBLIC_BASE_URL as string | undefined;
	const url = baseUrl
		? `${baseUrl.replace(/\/$/, "")}/api/media/${key}`
		: `/api/media/${key}`;

	const db = (env as Record<string, unknown>).DB as Parameters<typeof logAudit>[0];
	if (db) await logAudit(db, { action: "file_upload", target: key, actor: "admin", metadata: { size: file.size, contentType: file.type }, request }).catch(() => {});

	return json(200, { url, key, size: file.size, contentType: file.type });
};

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
	});
}

interface R2Bucket {
	put(key: string, value: ReadableStream, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
	get(key: string): Promise<R2Object | null>;
}

interface R2Object {
	body: ReadableStream;
	httpMetadata?: { contentType?: string };
	size: number;
}
