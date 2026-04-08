/**
 * Unit tests for the SendGrid integration adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToSendGrid } from "../../src/lib/integrations/sendgrid.js";
import { baseEnv, baseSubmission, makeFetchStub } from "./integrations-helpers.js";

describe("pushToSendGrid", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns undefined when SENDGRID_API_KEY is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToSendGrid(baseSubmission(), baseEnv());
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("returns undefined when email is missing", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		const result = await pushToSendGrid(
			baseSubmission({ email: undefined }),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);
		expect(result).toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it("happy path → returns { ok: true } on 200 with correct URL and headers", async () => {
		const { fn, calls } = makeFetchStub({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fn);

		const result = await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);

		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		const call = calls[0]!;
		expect(call.url).toBe("https://api.sendgrid.com/v3/marketing/contacts");
		expect(call.init.method).toBe("PUT");
		const headers = call.init.headers as Record<string, string>;
		expect(headers["Authorization"]).toBe("Bearer sg-key");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("payload shape: contacts array with email, names, postal_code, and custom_fields", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.contacts).toHaveLength(1);
		const contact = body.contacts[0];
		expect(contact.email).toBe("ada@example.com");
		expect(contact.first_name).toBe("Ada");
		expect(contact.last_name).toBe("Lovelace");
		expect(contact.postal_code).toBe("20001");
		expect(contact.custom_fields.crafted_source).toBe("rally-2026");
		expect(contact.custom_fields.crafted_action).toBe("event_rsvp");
	});

	it("includes list_ids when SENDGRID_LIST_ID is set", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key", SENDGRID_LIST_ID: "list-abc" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.list_ids).toEqual(["list-abc"]);
	});

	it("omits list_ids when SENDGRID_LIST_ID is not set", async () => {
		const { fn, calls } = makeFetchStub({ ok: true });
		vi.stubGlobal("fetch", fn);

		await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);

		const body = JSON.parse(calls[0]!.init.body as string);
		expect(body.list_ids).toBeUndefined();
	});

	it("non-200 response → returns { ok: false, error } with body truncated", async () => {
		const longBody = "x".repeat(500);
		const { fn } = makeFetchStub({ ok: false, status: 400, body: longBody });
		vi.stubGlobal("fetch", fn);

		const result = await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("SendGrid 400");
		// body is sliced to 200 chars
		expect(result?.error?.length).toBeLessThan(260);
	});

	it("network error → returns { ok: false, error }", async () => {
		const fn = vi.fn(async () => {
			throw new Error("ECONNRESET");
		});
		vi.stubGlobal("fetch", fn);

		const result = await pushToSendGrid(
			baseSubmission(),
			baseEnv({ SENDGRID_API_KEY: "sg-key" }),
		);
		expect(result).toEqual({ ok: false, error: "ECONNRESET" });
	});
});
