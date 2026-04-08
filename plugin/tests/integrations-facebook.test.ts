/**
 * Unit tests for the Facebook Events integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToFacebookEvent } from "../../src/lib/integrations/facebook.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

function fbEnv(overrides = {}) {
	return baseEnv({
		FACEBOOK_ACCESS_TOKEN: "fb-token",
		...overrides,
	});
}

function fbSubmission(overrides = {}) {
	return baseSubmission({
		type: "event_rsvp",
		eventIds: { facebook: "1234567890" },
		...overrides,
	});
}

async function sha256Hex(s: string) {
	const data = new TextEncoder().encode(s);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

describe("pushToFacebookEvent", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when FACEBOOK_ACCESS_TOKEN missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(
			fbSubmission(),
			fbEnv({ FACEBOOK_ACCESS_TOKEN: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when submission.type is not event_rsvp", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(
			fbSubmission({ type: "petition_sign" }),
			fbEnv(),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when eventIds.facebook is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(
			fbSubmission({ eventIds: {} }),
			fbEnv(),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when submission.email is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(
			fbSubmission({ email: undefined }),
			fbEnv(),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("uses correct URL: https://graph.facebook.com/v25.0/{eventId}/events", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToFacebookEvent(fbSubmission(), fbEnv());
		expect(calls[0]!.url).toBe(
			"https://graph.facebook.com/v25.0/1234567890/events",
		);
	});

	it("uses Bearer auth header", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToFacebookEvent(fbSubmission(), fbEnv());
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer fb-token");
	});

	it("payload includes SHA-256 hashed email (hex)", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToFacebookEvent(fbSubmission(), fbEnv());
		const body = JSON.parse(calls[0]!.init.body as string);
		// Known SHA-256 of "ada@example.com" (verified via Node crypto).
		// Meta CAPI requires lowercased + trimmed email hashed as hex.
		const expectedEmailHash =
			"b5fc85e55755f9e0d030a10ab4429b6b2944855f9a0d60077fe832becbc41d72";
		expect(body.data[0].user_data.em).toEqual([expectedEmailHash]);
		// 64-char hex string
		expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
		// Ensure it's not the plaintext email
		expect(body.data[0].user_data.em[0]).not.toBe("ada@example.com");
	});

	it("payload includes event_name Lead and content_category event_rsvp", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToFacebookEvent(fbSubmission(), fbEnv());
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.data[0].event_name).toBe("Lead");
		expect(body.data[0].custom_data.content_category).toBe("event_rsvp");
	});

	it("returns { ok: true } on 200", async () => {
		const { fn } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(fbSubmission(), fbEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: false, error } on 4xx", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 400,
			body: '{"error":{"message":"Invalid token"}}',
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(fbSubmission(), fbEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("Facebook 400");
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("boom");
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToFacebookEvent(fbSubmission(), fbEnv());
		expect(result).toEqual({ ok: false, error: "boom" });
	});
});
