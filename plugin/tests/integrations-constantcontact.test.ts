/**
 * Unit tests for the Constant Contact integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToConstantContact } from "../../src/lib/integrations/constantcontact.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

describe("pushToConstantContact", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when CONSTANT_CONTACT_API_KEY is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when CONSTANT_CONTACT_LIST_ID is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key" }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when email is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission({ email: undefined }),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("happy path → returns { ok: true } on 200 with correct URL and headers", async () => {
		const { fn, calls } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);

		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		const call = calls[0]!;
		expect(call.url).toBe("https://api.cc.email/v3/contacts");
		expect(call.init.method).toBe("POST");
		const headers = call.init.headers as Record<string, string>;
		expect(headers["Authorization"]).toBe("Bearer cc-key");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("payload shape: email_address, names, list_memberships, and taggings", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.email_address).toEqual({
			address: "ada@example.com",
			permission_to_send: "implicit",
		});
		expect(body.first_name).toBe("Ada");
		expect(body.last_name).toBe("Lovelace");
		expect(body.list_memberships).toEqual(["list-1"]);
		expect(body.taggings).toContain("crafted:event_rsvp");
		expect(body.taggings).toContain("page:rally-2026");
	});

	it("409 (already exists) treated as success", async () => {
		const { fn } = makeFetchStub({ ok: false, status: 409, body: "conflict" });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);
		expect(result).toEqual({ ok: true });
	});

	it("non-200/non-409 response → returns { ok: false, error } with body truncated", async () => {
		const longBody = "x".repeat(500);
		const { fn } = makeFetchStub({ ok: false, status: 422, body: longBody });
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("ConstantContact 422");
		// body is sliced to 200 chars
		expect(result?.error?.length).toBeLessThan(260);
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ECONNRESET");
		});
		vi.stubGlobal("fetch", fn);

		const result = await pushToConstantContact(
			baseSubmission(),
			baseEnv({ CONSTANT_CONTACT_API_KEY: "cc-key", CONSTANT_CONTACT_LIST_ID: "list-1" }),
		);
		expect(result).toEqual({ ok: false, error: "ECONNRESET" });
	});
});
