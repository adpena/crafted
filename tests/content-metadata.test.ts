import { describe, expect, it } from "vitest";
import { contentDate, publicationDate, contentText } from "../src/lib/content-metadata";

describe("CMS metadata used in RSS and sitemap", () => {
	it("puts year-only projects on the same timeline as dated publications", () => {
		const dates = [{ date: "2024-05-01" }, { year: 2023 }, { year: "2025" }]
			.map((data) => publicationDate(data)!)
			.sort((a, b) => b.getTime() - a.getTime());
		expect(dates.map((date) => date.toISOString())).toEqual([
			"2025-01-01T00:00:00.000Z", "2024-05-01T00:00:00.000Z", "2023-01-01T00:00:00.000Z",
		]);
	});

	it("uses a valid year when the date is malformed", () => {
		expect(publicationDate({ date: "invalid", year: "2024" })?.getUTCFullYear()).toBe(2024);
	});

	it.each([undefined, null, {}, [], "", "invalid", Infinity])("omits invalid date metadata: %j", (value) => {
		expect(contentDate(value)).toBeUndefined();
	});

	it.each(["2024–present", "2024-2026", "2024 — present"])("uses a project's start year: %s", (year) => {
		expect(publicationDate({ year })?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	it.each(["a year", "24", {}, undefined])("omits non-year values: %j", (year) => {
		expect(publicationDate({ year })).toBeUndefined();
	});

	it("does not serialize objects as titles or summaries", () => {
		expect(contentText({ title: "nested" }, "Untitled")).toBe("Untitled");
		expect(contentText("A title & subtitle")).toBe("A title & subtitle");
	});
});
