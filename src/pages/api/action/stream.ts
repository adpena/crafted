/**
 * SSE endpoint for live progress bar updates.
 * Streams submission count changes from KV cache.
 *
 * GET /api/action/stream?slug=my-petition
 *
 * Sends events in format:
 *   data: {"count":42}
 *
 * Free-tier friendly: reads from KV (<1ms), sends heartbeat every 15s,
 * count check every 3s. No Durable Objects needed.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SLUG_RE } from "../../../lib/slug.ts";
const COUNT_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_CONNECTION_MS = 5 * 60_000; // 5 min max, client reconnects

export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");
	if (!slug || !SLUG_RE.test(slug)) {
		return new Response("Invalid slug", { status: 400 });
	}

	const kv = (env as Record<string, unknown>).CACHE as {
		get: (key: string) => Promise<string | null>;
	} | undefined;

	if (!kv) {
		return new Response("SSE not available", { status: 503 });
	}

	let lastCount = -1;
	let closed = false;
	let cleanupRef: (() => void) | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const startTime = Date.now();

			function send(data: string) {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${data}\n\n`));
				} catch {
					closed = true;
				}
			}

			function sendHeartbeat() {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(": heartbeat\n\n"));
				} catch {
					closed = true;
				}
			}

			async function checkCount() {
				if (closed) return;
				try {
					const cached = await kv!.get(`action-count:${slug}`);
					const count = cached !== null ? parseInt(cached, 10) : 0;
					if (count !== lastCount) {
						lastCount = count;
						send(JSON.stringify({ count }));
					}
				} catch {
					// KV read failed — skip this cycle
				}
			}

			// Send initial count immediately
			await checkCount();

			// Poll KV and send heartbeats
			const countTimer = setInterval(checkCount, COUNT_INTERVAL_MS);
			const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

			// Auto-close after max duration (client will reconnect via EventSource)
			const maxTimer = setTimeout(() => {
				cleanup();
				try { controller.close(); } catch { /* already closed */ }
			}, MAX_CONNECTION_MS);

			function cleanup() {
				closed = true;
				clearInterval(countTimer);
				clearInterval(heartbeatTimer);
				clearTimeout(maxTimer);
			}

			// Store cleanup ref for cancel()
			cleanupRef = cleanup;
		},
		cancel() {
			if (cleanupRef) cleanupRef();
			closed = true;
		},
	});

	return new Response(stream, {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-store",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
};
