/**
 * Unit tests for the Eventbrite integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToEventbrite } from "../../src/lib/integrations/eventbrite.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

function ebEnv(overrides = {}) {
	return baseEnv({
		EVENTBRITE_API_TOKEN: "eb-token",
		...overrides,
	});
}

function ebSubmission(overrides = {}) {
	return baseSubmission({
		type: "event_rsvp",
		eventIds: { eventbrite: "987654" },
		...overrides,
	});
}

describe("pushToEventbrite", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when EVENTBRITE_API_TOKEN missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(
			ebSubmission(),
			ebEnv({ EVENTBRITE_API_TOKEN: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when submission.type is not event_rsvp", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(
			ebSubmission({ type: "petition_sign" }),
			ebEnv(),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when eventIds.eventbrite is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(
			ebSubmission({ eventIds: {} }),
			ebEnv(),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("uses correct URL: /v3/events/{eventId}/attendees/", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEventbrite(ebSubmission(), ebEnv());
		expect(calls[0]!.url).toBe(
			"https://www.eventbriteapi.com/v3/events/987654/attendees/",
		);
	});

	it("uses Bearer auth header", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEventbrite(ebSubmission(), ebEnv());
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer eb-token");
	});

	it("payload includes attendee profile with first/last/email", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEventbrite(ebSubmission(), ebEnv());
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.attendee.profile.first_name).toBe("Ada");
		expect(body.attendee.profile.last_name).toBe("Lovelace");
		expect(body.attendee.profile.email).toBe("ada@example.com");
	});

	it("returns { ok: true } on 200", async () => {
		const { fn } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(ebSubmission(), ebEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: true } on 403 (known paid-event limitation)", async () => {
		const { fn } = makeFetchStub({ ok: false, status: 403, body: "forbidden" });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(ebSubmission(), ebEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: true } on 405 (known paid-event limitation)", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 405,
			body: "method not allowed",
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(ebSubmission(), ebEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: false, error } on other 4xx", async () => {
		const { fn } = makeFetchStub({ ok: false, status: 401, body: "unauth" });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(ebSubmission(), ebEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("Eventbrite 401");
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("boom");
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToEventbrite(ebSubmission(), ebEnv());
		expect(result).toEqual({ ok: false, error: "boom" });
	});
});
