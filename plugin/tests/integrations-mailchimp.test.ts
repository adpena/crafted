/**
 * Unit tests for the Mailchimp integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToMailchimp } from "../../src/lib/integrations/mailchimp.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

function mcEnv(overrides = {}) {
	return baseEnv({
		MAILCHIMP_API_KEY: "mc-key",
		MAILCHIMP_LIST_ID: "list123",
		MAILCHIMP_DC: "us7",
		...overrides,
	});
}

describe("pushToMailchimp", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when MAILCHIMP_API_KEY is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(
			baseSubmission(),
			mcEnv({ MAILCHIMP_API_KEY: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when MAILCHIMP_LIST_ID is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(
			baseSubmission(),
			mcEnv({ MAILCHIMP_LIST_ID: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when MAILCHIMP_DC is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(
			baseSubmission(),
			mcEnv({ MAILCHIMP_DC: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns error result when submission.email is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(
			baseSubmission({ email: undefined }),
			mcEnv(),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("email");
		expect(calls).toHaveLength(0);
	});

	it("uses correct URL pattern with datacenter and list id", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToMailchimp(baseSubmission(), mcEnv());
		expect(calls[0]!.url).toBe(
			"https://us7.api.mailchimp.com/3.0/lists/list123/members",
		);
	});

	it("sends HTTP Basic auth with anystring:{api_key} base64", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToMailchimp(baseSubmission(), mcEnv());
		const headers = calls[0]!.init.headers as Record<string, string>;
		const expected = `Basic ${btoa("anystring:mc-key")}`;
		expect(headers.Authorization).toBe(expected);
	});

	it("payload includes email, status, merge_fields, tags", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToMailchimp(
			baseSubmission({ type: "email_signup" }),
			mcEnv(),
		);
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.email_address).toBe("ada@example.com");
		expect(body.status).toBe("subscribed");
		expect(body.merge_fields.FNAME).toBe("Ada");
		expect(body.merge_fields.LNAME).toBe("Lovelace");
		expect(body.tags).toContain("email_signup");
		expect(body.tags).toContain("rally-2026");
	});

	it("returns { ok: true } on 200", async () => {
		const { fn } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(baseSubmission(), mcEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: false, error } on 4xx", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 400,
			body: '{"title":"Member Exists"}',
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(baseSubmission(), mcEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("Mailchimp 400");
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("timeout");
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToMailchimp(baseSubmission(), mcEnv());
		expect(result).toEqual({ ok: false, error: "timeout" });
	});
});
