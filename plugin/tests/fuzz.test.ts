import { describe, it, expect } from "vitest";
import { validateSubmission } from "../src/modules/validate.ts";
import { captureAttribution, detectPlatform, mergeAttribution } from "../src/lib/click-tracking.ts";
import { t, getLocale } from "../src/lib/i18n.ts";

describe("fuzz: validateSubmission", () => {
	const inputs: unknown[] = [
		null, undefined, 0, "", false, true, [], {},
		{ type: null }, { type: "" }, { type: "unknown" },
		{ type: "petition_sign", data: null },
		{ type: "petition_sign", data: undefined },
		{ type: "petition_sign", data: [] },
		{ type: "petition_sign", data: 123 },
		{ type: "petition_sign", data: "string" },
		{ type: "signup", data: {} },
		{ type: "signup", data: { email: 123 } },
		{ type: "signup", data: { email: null } },
		{ type: "donation_click", data: {} },
	];

	inputs.forEach((input, i) => {
		it("handles fuzz input #" + i + " without throwing", () => {
			expect(() => validateSubmission(input as any)).not.toThrow();
		});
	});
});

describe("fuzz: click tracking", () => {
	it("captureAttribution handles missing URL", () => {
		const result = captureAttribution(undefined);
		expect(result.captured_at).toBeTruthy();
	});

	it("detectPlatform handles empty attribution", () => {
		expect(detectPlatform({ captured_at: "" })).toBeNull();
	});

	it("mergeAttribution handles null", () => {
		expect(mergeAttribution({}, null)).toEqual({});
	});
});

describe("fuzz: i18n", () => {
	it("t() returns key for unknown key", () => {
		const result = t("en", "nonexistent_key" as any);
		expect(result).toBe("nonexistent_key");
	});

	it("getLocale handles garbage", () => {
		expect(getLocale(undefined)).toBe("en");
		expect(getLocale("xx")).toBe("en");
		expect(getLocale("")).toBe("en");
	});
});
