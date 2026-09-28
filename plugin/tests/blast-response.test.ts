import { describe, expect, it } from "vitest";
import { parseDryRunResponse, parseSendResponse } from "../src/admin/blast-response.ts";

describe("email blast response validation", () => {
	it("accepts an empty recipient preview", () => {
		expect(parseDryRunResponse({ dry_run: true, eligible: 0 })).toEqual({ dry_run: true, eligible: 0 });
	});

	it.each([null, {}, { eligible: 1 }, { dry_run: false, eligible: 1 }, { dry_run: true, eligible: "10" }, { dry_run: true, eligible: -1 }])(
		"rejects a malformed preview: %j", (value) => {
			expect(() => parseDryRunResponse(value)).toThrow("invalid recipient preview");
		},
	);

	it("preserves partial delivery results", () => {
		const result = { sent: 2, failed: 1, skipped: 3, errors: ["Service unavailable"] };
		expect(parseSendResponse(result)).toEqual(result);
	});

	it.each([null, {}, { sent: NaN, failed: 0, skipped: 0, errors: [] }, { sent: 1, failed: 0, skipped: 0, errors: [3] }])(
		"does not encourage resending after an ambiguous result: %j", (value) => {
			expect(() => parseSendResponse(value)).toThrow("Check delivery status before sending again");
		},
	);
});
