import type { APIContext } from "astro";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signUnsubscribeToken } from "../src/lib/email-blast.ts";

const { env, storage } = vi.hoisted(() => {
	const storage = new Map<string, string>();
	return {
		storage,
		env: {
			UNSUBSCRIBE_SECRET: "local-test-unsubscribe-secret",
			MCP_ADMIN_TOKEN: "local-test-admin-token-at-least-32-characters",
			RESEND_API_KEY: "local-test-key",
			RESEND_FROM_EMAIL: "sender@example.com",
			// Deliberately only expose the binding actually declared in wrangler.jsonc.
			CACHE: {
				get: async (key: string) => storage.get(key) ?? null,
				put: async (key: string, value: string) => { storage.set(key, value); },
				delete: async (key: string) => { storage.delete(key); },
			},
			DB: {
				prepare: () => ({ bind: () => ({ all: async () => ({
					results: [{ data: JSON.stringify({ email: "reader@example.com", tags: [] }) }],
				}) }) }),
			},
		},
	};
});

vi.mock("cloudflare:workers", () => ({ env }));
import { GET } from "../src/pages/api/unsubscribe.ts";
import { POST } from "../src/pages/api/admin/email/send.ts";

beforeEach(() => {
	storage.clear();
	vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network is disabled in this test"); }));
});
afterEach(() => vi.unstubAllGlobals());

it("records an unsubscribe in CACHE and skips that recipient during a send", async () => {
	const token = await signUnsubscribeToken(env.UNSUBSCRIBE_SECRET, "reader@example.com");
	const url = new URL(`https://example.com/api/unsubscribe?email=reader%40example.com&t=${token}`);
	const unsubscribed = await GET({ url, request: new Request(url), clientAddress: "192.0.2.1" } as APIContext);
	expect(unsubscribed.status).toBe(200);
	expect([...storage.keys()].some((key) => key.startsWith("suppressed:"))).toBe(true);

	const request = new Request("https://example.com/api/admin/email/send", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MCP_ADMIN_TOKEN}` },
		body: JSON.stringify({ subject: "Test", html: "<p>Test</p>", text: "Test", dry_run: false }),
	});
	const result = await POST({ request } as APIContext);
	expect(result.status).toBe(200);
	expect(await result.json()).toEqual({ sent: 0, failed: 0, skipped: 1, errors: [] });
	expect(fetch).not.toHaveBeenCalled();
});

it("rejects an invalid unsubscribe token without recording suppression", async () => {
	const url = new URL("https://example.com/api/unsubscribe?email=reader%40example.com&t=invalid");
	const response = await GET({ url, request: new Request(url), clientAddress: "192.0.2.1" } as APIContext);
	expect(response.status).toBe(403);
	expect([...storage.keys()].some((key) => key.startsWith("suppressed:"))).toBe(false);
});
