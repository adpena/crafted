/**
 * Unit tests for the NationBuilder integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToNationBuilder } from "../../src/lib/integrations/nationbuilder.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

function nbEnv(overrides = {}) {
	return baseEnv({
		NATIONBUILDER_NATION_SLUG: "my-campaign",
		NATIONBUILDER_API_TOKEN: "nb-token",
		...overrides,
	});
}

describe("pushToNationBuilder", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when NATIONBUILDER_NATION_SLUG missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission(),
			nbEnv({ NATIONBUILDER_NATION_SLUG: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when NATIONBUILDER_API_TOKEN missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission(),
			nbEnv({ NATIONBUILDER_API_TOKEN: undefined }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("invalid slug → returns { ok: false, error: 'invalid nation slug' }", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission(),
			nbEnv({ NATIONBUILDER_NATION_SLUG: "Has_Underscore" }),
		);
		expect(result).toEqual({ ok: false, error: "invalid nation slug" });
		expect(calls).toHaveLength(0);
	});

	it("rejects slug injection attempt ('evil.com#/hack')", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission(),
			nbEnv({ NATIONBUILDER_NATION_SLUG: "evil.com#/hack" }),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toBe("invalid nation slug");
		expect(calls).toHaveLength(0);
	});

	it("rejects slug with uppercase characters", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission(),
			nbEnv({ NATIONBUILDER_NATION_SLUG: "MyCampaign" }),
		);
		expect(result?.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});

	it("URL built from slug → https://{slug}.nationbuilder.com/api/v2/signups", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToNationBuilder(baseSubmission(), nbEnv());
		expect(calls[0]!.url).toBe(
			"https://my-campaign.nationbuilder.com/api/v2/signups",
		);
	});

	it("uses Bearer auth header", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToNationBuilder(baseSubmission(), nbEnv());
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer nb-token");
	});

	it("payload: JSON:API v2 format with signups type and attributes", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		await pushToNationBuilder(
			baseSubmission({ type: "petition_sign" }),
			nbEnv(),
		);
		const body = JSON.parse(calls[0]!.init.body as string);
		// v2 uses JSON:API format
		expect(body.data.type).toBe("signups");
		expect(body.data.attributes.email).toBe("ada@example.com");
		expect(body.data.attributes.first_name).toBe("Ada");
		expect(body.data.attributes.last_name).toBe("Lovelace");
		expect(body.data.attributes.tag_list).toContain("crafted:petition_sign");
		expect(body.data.attributes.tag_list).toContain("page:rally-2026");
	});

	it("returns { ok: true } on 200", async () => {
		const { fn } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(baseSubmission(), nbEnv());
		expect(result).toEqual({ ok: true });
	});

	it("returns { ok: false, error } on 4xx", async () => {
		const { fn } = makeFetchStub({
			ok: false,
			status: 401,
			body: "unauthorized",
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(baseSubmission(), nbEnv());
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("NationBuilder 401");
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ETIMEDOUT");
		});
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(baseSubmission(), nbEnv());
		expect(result).toEqual({ ok: false, error: "ETIMEDOUT" });
	});

	it("missing email returns error result", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);
		const result = await pushToNationBuilder(
			baseSubmission({ email: undefined }),
			nbEnv(),
		);
		expect(result?.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});
});
