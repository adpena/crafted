/**
 * Unit tests for the Action Network integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToActionNetwork } from "../../src/lib/integrations/actionnetwork.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

describe("pushToActionNetwork", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("happy path → returns { ok: true } on 200 with correct URL and headers", async () => {
		const { fn, calls } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);

		const result = await pushToActionNetwork(
			baseSubmission({ type: "petition_sign" }),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);

		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		const call = calls[0]!;
		expect(call.url).toBe("https://actionnetwork.org/api/v2/people");
		expect(call.init.method).toBe("POST");
		const headers = call.init.headers as Record<string, string>;
		expect(headers["OSDI-API-Token"]).toBe("an-key");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("payload shape: person wrapper with name, email, postal address, and tags", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToActionNetwork(
			baseSubmission({ type: "petition_sign" }),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.person.given_name).toBe("Ada");
		expect(body.person.family_name).toBe("Lovelace");
		expect(body.person.email_addresses).toEqual([
			{ address: "ada@example.com" },
		]);
		expect(body.person.postal_addresses).toEqual([{ postal_code: "20001" }]);
		expect(body.add_tags).toContain("crafted:petition_sign");
		expect(body.add_tags).toContain("page:rally-2026");
	});

	it("action type is included in add_tags as crafted:{type}", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToActionNetwork(
			baseSubmission({ type: "email_signup" }),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.add_tags).toContain("crafted:email_signup");
	});

	it("returns undefined when ACTION_NETWORK_API_KEY is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToActionNetwork(baseSubmission(), baseEnv());
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns error result when submission.email is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToActionNetwork(
			baseSubmission({ email: undefined }),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("email");
		expect(calls).toHaveLength(0);
	});

	it("non-200 response → returns { ok: false, error } with body truncated", async () => {
		const longBody = "x".repeat(500);
		const { fn } = makeFetchStub({ ok: false, status: 422, body: longBody });
		vi.stubGlobal("fetch", fn);

		const result = await pushToActionNetwork(
			baseSubmission(),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("ActionNetwork 422");
		// body is sliced to 200 chars
		expect(result?.error?.length).toBeLessThan(260);
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ECONNRESET");
		});
		vi.stubGlobal("fetch", fn);

		const result = await pushToActionNetwork(
			baseSubmission(),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);
		expect(result).toEqual({ ok: false, error: "ECONNRESET" });
	});

	it("omits postal_addresses when postalCode is not provided", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToActionNetwork(
			baseSubmission({ postalCode: undefined }),
			baseEnv({ ACTION_NETWORK_API_KEY: "an-key" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.person.postal_addresses).toBeUndefined();
	});
});
