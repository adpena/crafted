/**
 * Unit tests for the EveryAction / NGP VAN integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToEveryAction } from "../../src/lib/integrations/everyaction.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

function eaEnv(overrides = {}) {
	return baseEnv({
		EVERYACTION_API_KEY: "ea-key",
		EVERYACTION_APP_NAME: "crafted-app",
		...overrides,
	});
}

describe("pushToEveryAction", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when EVERYACTION_API_KEY missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(
			baseSubmission(),
			eaEnv({ EVERYACTION_API_KEY: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when EVERYACTION_APP_NAME missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(
			baseSubmission(),
			eaEnv({ EVERYACTION_APP_NAME: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("uses correct URL: https://api.securevan.com/v4/people/findOrCreate", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEveryAction(baseSubmission(), eaEnv());
		expect(calls[0]!.url).toBe(
			"https://api.securevan.com/v4/people/findOrCreate",
		);
	});

	it("uses HTTP Basic auth with '{app_name}:{api_key}|0' format", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEveryAction(baseSubmission(), eaEnv());
		const headers = calls[0]!.init.headers as Record<string, string>;
		const expected = `Basic ${btoa("crafted-app:ea-key|0")}`;
		expect(headers.Authorization).toBe(expected);
	});

	it("payload includes firstName, lastName, emails, addresses", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToEveryAction(baseSubmission(), eaEnv());
		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.firstName).toBe("Ada");
		expect(body.lastName).toBe("Lovelace");
		expect(body.emails).toEqual([
			{ email: "ada@example.com", isSubscribed: true },
		]);
		expect(body.addresses).toEqual([{ zipOrPostalCode: "20001" }]);
	});

	it("returns { ok: true } on 200", async () => {
		const { fn } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(baseSubmission(), eaEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: false, error } on 4xx", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 401,
			body: "invalid credentials",
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(baseSubmission(), eaEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("EveryAction 401");
	});

	it("missing email returns error result", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(
			baseSubmission({ email: undefined }),
			eaEnv(),
		);
		expect(result?.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToEveryAction(baseSubmission(), eaEnv());
		expect(result).toEqual({ ok: false, error: "ECONNREFUSED" });
	});
});
