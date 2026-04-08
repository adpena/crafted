/**
 * Unit tests for the NGP VAN integration adapter.
 *
 * Covers the full precedence chain for activist code resolution:
 *   submission.activist_code_ids > activist_code_id
 *     > env.NGPVAN_ACTIVIST_CODES_JSON[type]
 *     > env.NGPVAN_ACTIVIST_CODE_ID
 *
 * Plus: no-match handling, error propagation from both API calls,
 * survey response forwarding, KV counter increments.
 */

import { describe, expect, it } from "vitest";
import {
	pushToNgpVan,
	resolveActivistCodes,
} from "../../src/lib/integrations/ngpvan.js";
import { baseEnv, baseSubmission } from "./integrations-helpers.js";
import type {
	IntegrationEnv,
	IntegrationSubmission,
} from "../../src/lib/integrations/types.js";

/**
 * Multi-call fetch stub: returns a different response per call in sequence.
 */
function sequentialFetch(responses: Array<Partial<Response> & {
	ok: boolean;
	status?: number;
	jsonBody?: unknown;
	textBody?: string;
}>) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	let i = 0;
	const fn = async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} });
		const r = responses[Math.min(i, responses.length - 1)];
		i++;
		return {
			ok: r.ok,
			status: r.status ?? (r.ok ? 200 : 500),
			text: async () => r.textBody ?? "",
			json: async () => r.jsonBody ?? {},
		} as Response;
	};
	return { fn, calls };
}

function vanEnv(overrides: Partial<IntegrationEnv> = {}): IntegrationEnv {
	return baseEnv({
		NGPVAN_API_KEY: "van-key",
		NGPVAN_APP_NAME: "crafted",
		...overrides,
	});
}

function sub(overrides: Partial<IntegrationSubmission> = {}): IntegrationSubmission {
	return baseSubmission({ type: "petition_sign", slug: "signup-bill", ...overrides });
}

function memoryKv() {
	const store = new Map<string, string>();
	return {
		store,
		kv: {
			async get(k: string) {
				return store.get(k) ?? null;
			},
			async put(k: string, v: string) {
				store.set(k, v);
			},
		},
	};
}

describe("resolveActivistCodes", () => {
	it("returns empty when nothing is configured", () => {
		expect(resolveActivistCodes(sub(), vanEnv())).toEqual([]);
	});

	it("prefers explicit activist_code_ids array", () => {
		const codes = resolveActivistCodes(
			sub({ activist_code_ids: [111, "222"] }),
			vanEnv({ NGPVAN_ACTIVIST_CODE_ID: "999" }),
		);
		expect(codes).toContain(111);
		expect(codes).toContain(222);
		expect(codes).toContain(999); // global default is still merged in
	});

	it("includes legacy single activist_code_id", () => {
		const codes = resolveActivistCodes(
			sub({ activist_code_id: "444" }),
			vanEnv(),
		);
		expect(codes).toEqual([444]);
	});

	it("resolves type-mapped code from NGPVAN_ACTIVIST_CODES_JSON", () => {
		const codes = resolveActivistCodes(
			sub({ type: "letter_sent" }),
			vanEnv({
				NGPVAN_ACTIVIST_CODES_JSON: JSON.stringify({
					petition_sign: 100,
					letter_sent: 200,
					signup: 300,
				}),
			}),
		);
		expect(codes).toEqual([200]);
	});

	it("de-duplicates codes across precedence levels", () => {
		const codes = resolveActivistCodes(
			sub({ type: "signup", activist_code_id: "500" }),
			vanEnv({
				NGPVAN_ACTIVIST_CODES_JSON: JSON.stringify({ signup: 500 }),
				NGPVAN_ACTIVIST_CODE_ID: "500",
			}),
		);
		expect(codes).toEqual([500]);
	});

	it("ignores malformed NGPVAN_ACTIVIST_CODES_JSON", () => {
		const codes = resolveActivistCodes(
			sub({ type: "petition_sign" }),
			vanEnv({ NGPVAN_ACTIVIST_CODES_JSON: "not json" }),
		);
		expect(codes).toEqual([]);
	});

	it("skips non-numeric entries", () => {
		const codes = resolveActivistCodes(
			sub({ activist_code_ids: ["abc", "123", ""] }),
			vanEnv(),
		);
		expect(codes).toEqual([123]);
	});
});

describe("pushToNgpVan", () => {
	it("returns undefined when API key missing", async () => {
		const result = await pushToNgpVan(sub(), vanEnv({ NGPVAN_API_KEY: undefined }));
		expect(result).toBeUndefined();
	});

	it("returns undefined when app name missing", async () => {
		const result = await pushToNgpVan(sub(), vanEnv({ NGPVAN_APP_NAME: undefined }));
		expect(result).toBeUndefined();
	});

	it("returns undefined when submission.email missing", async () => {
		const result = await pushToNgpVan(sub({ email: undefined }), vanEnv());
		expect(result).toBeUndefined();
	});

	it("returns ok with no_van_match marker when voter file has no record", async () => {
		const { fn } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: null } },
		]);
		const { kv, store } = memoryKv();
		const result = await pushToNgpVan(
			sub({ activist_code_id: "100" }),
			vanEnv(),
			{ kv, fetchImpl: fn as typeof fetch },
		);
		expect(result).toEqual({ ok: true, error: "no_van_match" });
		// misses counter bumped
		const key = Array.from(store.keys()).find((k) => k.startsWith("van-misses:"));
		expect(key).toBeDefined();
		expect(store.get(key!)).toBe("1");
	});

	it("applies a single activist code via canvassResponses", async () => {
		const { fn, calls } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 42 } },
			{ ok: true, status: 204 },
		]);
		const result = await pushToNgpVan(
			sub({ activist_code_id: "100" }),
			vanEnv(),
			{ fetchImpl: fn as typeof fetch },
		);
		expect(result).toEqual({ ok: true });
		expect(calls[1]?.url).toContain("/people/42/canvassResponses");

		const payload = JSON.parse(String(calls[1]?.init.body));
		expect(payload.responses).toHaveLength(1);
		expect(payload.responses[0]).toMatchObject({
			activistCodeId: 100,
			action: "Apply",
			type: "ActivistCode",
		});
	});

	it("applies multiple activist codes and survey responses in one batch", async () => {
		const { fn, calls } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 77 } },
			{ ok: true, status: 204 },
		]);
		const result = await pushToNgpVan(
			sub({
				activist_code_ids: [111, 222],
				survey_responses: [
					{ surveyQuestionId: 9000, surveyResponseId: 9001 },
				],
			}),
			vanEnv({ NGPVAN_ACTIVIST_CODE_ID: "333" }),
			{ fetchImpl: fn as typeof fetch },
		);
		expect(result).toEqual({ ok: true });
		const payload = JSON.parse(String(calls[1]?.init.body));
		expect(payload.responses).toHaveLength(4); // 3 codes (111,222,333) + 1 survey
		const activistIds = payload.responses
			.filter((r: { type: string }) => r.type === "ActivistCode")
			.map((r: { activistCodeId: number }) => r.activistCodeId)
			.sort();
		expect(activistIds).toEqual([111, 222, 333]);
		const survey = payload.responses.find((r: { type: string }) => r.type === "SurveyResponse");
		expect(survey).toMatchObject({ surveyQuestionId: 9000, surveyResponseId: 9001 });
	});

	it("uses type-mapped activist code when submission has none", async () => {
		const { fn, calls } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 1 } },
			{ ok: true, status: 204 },
		]);
		await pushToNgpVan(
			sub({ type: "letter_sent" }),
			vanEnv({
				NGPVAN_ACTIVIST_CODES_JSON: JSON.stringify({
					petition_sign: 100,
					letter_sent: 200,
				}),
			}),
			{ fetchImpl: fn as typeof fetch },
		);
		const payload = JSON.parse(String(calls[1]?.init.body));
		expect(payload.responses[0].activistCodeId).toBe(200);
	});

	it("returns ok:true with no canvass call when nothing to apply", async () => {
		const { fn, calls } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 1 } },
		]);
		const result = await pushToNgpVan(sub(), vanEnv(), { fetchImpl: fn as typeof fetch });
		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1); // only findOrCreate, no canvass
	});

	it("propagates findOrCreate failure", async () => {
		const { fn } = sequentialFetch([
			{ ok: false, status: 401, textBody: "Unauthorized" },
		]);
		const result = await pushToNgpVan(sub(), vanEnv(), { fetchImpl: fn as typeof fetch });
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("401");
	});

	it("propagates canvassResponses failure (previously silent)", async () => {
		const { fn } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 42 } },
			{ ok: false, status: 422, textBody: "Invalid activistCodeId" },
		]);
		const { kv, store } = memoryKv();
		const result = await pushToNgpVan(
			sub({ activist_code_id: "999" }),
			vanEnv(),
			{ kv, fetchImpl: fn as typeof fetch },
		);
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("422");
		const key = Array.from(store.keys()).find((k) => k.startsWith("van-codes_failed:"));
		expect(key).toBeDefined();
	});

	it("increments match and codes_applied counters", async () => {
		const { fn } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 42 } },
			{ ok: true, status: 204 },
		]);
		const { kv, store } = memoryKv();
		await pushToNgpVan(
			sub({ activist_code_id: "100" }),
			vanEnv(),
			{ kv, fetchImpl: fn as typeof fetch },
		);
		expect(Array.from(store.keys()).some((k) => k.startsWith("van-matches:"))).toBe(true);
		expect(Array.from(store.keys()).some((k) => k.startsWith("van-codes_applied:"))).toBe(true);
	});

	it("sends HTTP Basic auth with mode=1 suffix", async () => {
		const { fn, calls } = sequentialFetch([
			{ ok: true, jsonBody: { vanId: 1 } },
		]);
		await pushToNgpVan(sub(), vanEnv(), { fetchImpl: fn as typeof fetch });
		const auth = (calls[0]?.init.headers as Record<string, string>).Authorization;
		expect(auth).toMatch(/^Basic /);
		const decoded = atob(auth.slice(6));
		expect(decoded).toBe("crafted:van-key|1");
	});

	it("handles fetch throwing (network/timeout)", async () => {
		const fn = (async () => {
			throw new Error("fetch failed");
		}) as unknown as typeof fetch;
		const result = await pushToNgpVan(sub(), vanEnv(), { fetchImpl: fn });
		expect(result?.ok).toBe(false);
		expect(result?.error).toContain("fetch failed");
	});
});
