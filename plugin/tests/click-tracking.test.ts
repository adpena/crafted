import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	captureAttribution,
	detectPlatform,
	mergeAttribution,
	type ClickAttribution,
} from "../src/lib/click-tracking.ts";

describe("captureAttribution", () => {
	it("captures fbclid from URL", () => {
		const attr = captureAttribution("https://example.com/action/petition?fbclid=abc123");
		expect(attr.fbclid).toBe("abc123");
		expect(attr.page_url).toBe("https://example.com/action/petition?fbclid=abc123");
	});

	it("captures gclid from URL", () => {
		const attr = captureAttribution("https://example.com/?gclid=CjOKBQ");
		expect(attr.gclid).toBe("CjOKBQ");
	});

	it("captures UTM params", () => {
		const attr = captureAttribution("https://example.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=spring26");
		expect(attr.utm_source).toBe("facebook");
		expect(attr.utm_medium).toBe("cpc");
		expect(attr.utm_campaign).toBe("spring26");
	});

	it("captures multiple click IDs and UTMs together", () => {
		const attr = captureAttribution("https://example.com/?fbclid=fb1&utm_source=ig&utm_campaign=test");
		expect(attr.fbclid).toBe("fb1");
		expect(attr.utm_source).toBe("ig");
		expect(attr.utm_campaign).toBe("test");
	});

	it("truncates long values", () => {
		const longValue = "a".repeat(1000);
		const attr = captureAttribution(`https://example.com/?fbclid=${longValue}`);
		expect(attr.fbclid!.length).toBe(500);
	});

	it("returns minimal object when no params present", () => {
		const attr = captureAttribution("https://example.com/");
		expect(attr.captured_at).toBeTruthy();
		expect(attr.fbclid).toBeUndefined();
		expect(attr.utm_source).toBeUndefined();
	});

	it("handles all 8 click ID params", () => {
		const params = "fbclid=1&gclid=2&ttclid=3&twclid=4&li_fat_id=5&rdt_cid=6&scid=7&msclkid=8";
		const attr = captureAttribution(`https://example.com/?${params}`);
		expect(attr.fbclid).toBe("1");
		expect(attr.gclid).toBe("2");
		expect(attr.ttclid).toBe("3");
		expect(attr.twclid).toBe("4");
		expect(attr.li_fat_id).toBe("5");
		expect(attr.rdt_cid).toBe("6");
		expect(attr.scid).toBe("7");
		expect(attr.msclkid).toBe("8");
	});
});

describe("detectPlatform", () => {
	it("detects Meta from fbclid", () => {
		expect(detectPlatform({ fbclid: "abc", captured_at: "" })).toBe("meta");
	});

	it("detects Google from gclid", () => {
		expect(detectPlatform({ gclid: "abc", captured_at: "" })).toBe("google");
	});

	it("detects TikTok from ttclid", () => {
		expect(detectPlatform({ ttclid: "abc", captured_at: "" })).toBe("tiktok");
	});

	it("returns null when no click IDs", () => {
		expect(detectPlatform({ captured_at: "" })).toBeNull();
	});

	it("returns first match when multiple present", () => {
		expect(detectPlatform({ fbclid: "a", gclid: "b", captured_at: "" })).toBe("meta");
	});
});

describe("mergeAttribution", () => {
	it("merges attribution into fields", () => {
		const fields = { email: "ada@example.com" };
		const attr: ClickAttribution = { fbclid: "fb1", utm_source: "ig", captured_at: "2026-04-07T00:00:00Z" };
		const merged = mergeAttribution(fields, attr);
		expect(merged.email).toBe("ada@example.com");
		expect(merged.fbclid).toBe("fb1");
		expect(merged.utm_source).toBe("ig");
	});

	it("does not overwrite existing fields", () => {
		const fields = { fbclid: "original" };
		const attr: ClickAttribution = { fbclid: "new", captured_at: "" };
		const merged = mergeAttribution(fields, attr);
		expect(merged.fbclid).toBe("original");
	});

	it("handles null attribution", () => {
		const fields = { email: "ada@example.com" };
		const merged = mergeAttribution(fields, null);
		expect(merged).toEqual(fields);
	});
});
