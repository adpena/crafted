/**
 * Unit tests for the Mobilize America integration adapter.
 *
 * These tests exercise `pushToMobilize` and `pushToActivistCode` using a
 * stubbed `globalThis.fetch`, so no network traffic occurs.
 *
 * Note on API reality: the public Mobilize America v1 API has no
 * `POST /people` endpoint — Mobilize is event-centric. The adapter therefore
 * silently skips every submission type except `event_rsvp`, which is the
 * behaviour the tests here assert.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	pushToMobilize,
} from "../../src/lib/integrations/mobilize.js";
import type {
	IntegrationEnv,
	IntegrationSubmission,
} from "../../src/lib/integrations/types.js";

interface CapturedCall {
	url: string;
	init: RequestInit;
}

function makeFetchStub(
	response: Partial<Response> & { ok: boolean; status?: number; body?: string },
) {
	const calls: CapturedCall[] = [];
	const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} });
		return {
			ok: response.ok,
			status: response.status ?? (response.ok ? 200 : 500),
			text: async () => response.body ?? "",
			json: async () => ({}),
		} as Response;
	});
	return { fn, calls };
}

function baseEnv(overrides: Partial<IntegrationEnv> = {}): IntegrationEnv {
	return {
		MOBILIZE_API_TOKEN: "test-token",
		MOBILIZE_ORGANIZATION_ID: "42",
		MOBILIZE_EVENT_ID: "1000",
		MOBILIZE_TIMESLOT_ID: "2000",
		...overrides,
	};
}

function baseSubmission(
	overrides: Partial<IntegrationSubmission> = {},
): IntegrationSubmission {
	return {
		type: "event_rsvp",
		slug: "rally-2026",
		email: "ada@example.com",
		firstName: "Ada",
		lastName: "Lovelace",
		postalCode: "20001",
		...overrides,
	};
}

describe("pushToMobilize", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("event_rsvp → calls attendance endpoint with org + event + timeslot", async () => {
		const { fn, calls } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(baseSubmission(), baseEnv());

		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		const firstCall = calls[0]!;
		expect(firstCall.url).toBe(
			"https://api.mobilize.us/v1/organizations/42/events/1000/attendances",
		);
		expect(firstCall.init.method).toBe("POST");
		const headers = firstCall.init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer test-token");
		expect(headers["Content-Type"]).toBe("application/json");
		const body = JSON.parse(firstCall.init.body as string);
		expect(body.person.email_address).toBe("ada@example.com");
		expect(body.person.given_name).toBe("Ada");
		expect(body.person.family_name).toBe("Lovelace");
		expect(body.person.postal_code).toBe("20001");
		expect(body.person.phone_number).toBe("");
		expect(body.timeslots).toEqual([{ timeslot_id: 2000 }]);
	});

	it("event_rsvp → uses per-submission event:timeslot override", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToMobilize(
			baseSubmission({ eventIds: { mobilize: "9999:8888" } }),
			baseEnv(),
		);

		expect(calls[0]!.url).toBe(
			"https://api.mobilize.us/v1/organizations/42/events/9999/attendances",
		);
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.timeslots).toEqual([{ timeslot_id: 8888 }]);
	});

	it("petition_sign → returns undefined (Mobilize has no /people endpoint)", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission({ type: "petition_sign" }),
			baseEnv(),
		);

		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("missing MOBILIZE_API_TOKEN → returns undefined without fetching", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission(),
			baseEnv({ MOBILIZE_API_TOKEN: undefined }),
		);

		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("missing email → returns undefined without fetching", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission({ email: undefined }),
			baseEnv(),
		);

		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("invalid event id format → returns { ok: false, error }", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission(),
			baseEnv({ MOBILIZE_EVENT_ID: "not-a-number" }),
		);

		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("invalid event id");
		expect(calls).toHaveLength(0);
	});

	it("invalid organization id → returns { ok: false, error }", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission(),
			baseEnv({ MOBILIZE_ORGANIZATION_ID: "abc" }),
		);

		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("invalid organization id");
		expect(calls).toHaveLength(0);
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ECONNRESET");
		});
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(baseSubmission(), baseEnv());
		expect(result).toEqual({ ok: false, error: "ECONNRESET" });
	});

	it("non-200 response → returns { ok: false, error }", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 422,
			body: '{"error":"timeslot_id invalid"}',
		});
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(baseSubmission(), baseEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("Mobilize attendance 422");
	});

	it("skips when org configured but event id absent", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission(),
			baseEnv({ MOBILIZE_EVENT_ID: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("skips when org is not configured at all", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToMobilize(
			baseSubmission(),
			baseEnv({ MOBILIZE_ORGANIZATION_ID: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});
});

// Note: pushToActivistCode was removed — activist codes are now forwarded
// directly via pushToMobilize's attendance referrer (utm_campaign field).
// The test for activist code forwarding is in the pushToMobilize suite above
// ("forwards activist code as utm_campaign on referrer").
