/**
 * Brand extraction from a public URL.
 * Worker-compatible: uses only fetch() and regex-based HTML parsing.
 *
 * Adapted from enjoice/packages/plugin/src/brand/extractor.ts
 *
 * Security:
 * - SSRF protection: blocks private, loopback, link-local, and metadata IPs
 * - 5 MB response cap (prevents OOM from hostile servers)
 * - 5s fetch timeout
 * - Manual redirect handling (validates each hop against SSRF rules)
 * - robots.txt respect (refuses if disallowed)
 */

import { dominantColors } from "./color-utils.ts";
import type { BrandKit } from "./types.ts";

const USER_AGENT = "CraftedActionPages/1.0 (brand-extractor)";
const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// --- SSRF guards -----------------------------------------------------------

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal")
	) {
		return true;
	}
	const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4) {
		const a = parseInt(ipv4[1]!, 10);
		const b = parseInt(ipv4[2]!, 10);
		if (a === 10) return true;
		if (a === 127) return true;
		if (a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
		if (a >= 224) return true;
	}
	if (host.startsWith("[") && host.endsWith("]")) return isPrivateIpv6(host.slice(1, -1));
	if (host.includes(":")) return isPrivateIpv6(host);
	return false;
}

function isPrivateIpv6(addr: string): boolean {
	const a = addr.toLowerCase();
	return (
		a === "::" || a === "::1" ||
		a.startsWith("fc") || a.startsWith("fd") ||
		a.startsWith("fe80") || a.startsWith("ff") ||
		a.startsWith("::ffff:")
	);
}

async function fetchBounded(url: string): Promise<string> {
	let currentUrl = url;
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		const hostname = new URL(currentUrl).hostname;
		if (isPrivateHostname(hostname)) {
			throw new Error(`Blocked private/internal URL: ${hostname}`);
		}

		const res = await fetch(currentUrl, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: "manual",
		});

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) throw new Error("Redirect with no Location header");
			currentUrl = new URL(location, currentUrl).href;
			continue;
		}

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const body = res.body;
		if (!body) return await res.text();

		const reader = body.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				total += value.byteLength;
				if (total > MAX_RESPONSE_BYTES) {
					try { await reader.cancel(); } catch { /* ignore */ }
					throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
				}
				chunks.push(value);
			}
		}
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
		return new TextDecoder("utf-8", { fatal: false }).decode(merged);
	}
	throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}

// --- robots.txt ------------------------------------------------------------

async function isAllowedByRobots(url: string): Promise<boolean> {
	try {
		const parsed = new URL(url);
		// Defense-in-depth: re-verify SSRF guard at the robots.txt fetch site
		if (isPrivateHostname(parsed.hostname)) return false;
		const robotsUrl = `${parsed.origin}/robots.txt`;
		const res = await fetch(robotsUrl, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(3_000),
		});
		if (!res.ok) return true;
		const text = await res.text();
		const lines = text.split("\n");
		let inRelevantBlock = false;
		for (const raw of lines) {
			const line = raw.trim();
			if (/^user-agent:\s*\*/i.test(line) || /^user-agent:\s*CraftedActionPages/i.test(line)) {
				inRelevantBlock = true;
				continue;
			}
			if (/^user-agent:/i.test(line)) {
				inRelevantBlock = false;
				continue;
			}
			if (inRelevantBlock && /^disallow:\s*\/$/i.test(line)) return false;
			const disallowMatch = line.match(/^disallow:\s*(.+)/i);
			if (inRelevantBlock && disallowMatch) {
				const path = disallowMatch[1]!.trim();
				if (path && new URL(url).pathname.startsWith(path)) return false;
			}
		}
		return true;
	} catch {
		return true;
	}
}

// --- HTML parsing helpers --------------------------------------------------

function getMetaContent(html: string, nameOrProperty: string): string | null {
	const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const patterns = [
		new RegExp(`<meta[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
		new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["']`, "i"),
	];
	for (const re of patterns) {
		const m = html.match(re);
		if (m?.[1]) return m[1];
	}
	return null;
}

function getTitle(html: string): string | null {
	const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	return m?.[1]?.trim() ?? null;
}

function getAllStyleContent(html: string): string {
	const blocks: string[] = [];
	const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
	let m: RegExpExecArray | null;
	while ((m = styleRegex.exec(html)) !== null) blocks.push(m[1]!);
	const inlineRegex = /style=["']([^"']+)["']/gi;
	while ((m = inlineRegex.exec(html)) !== null) blocks.push(m[1]!);
	return blocks.join("\n");
}

function extractName(html: string, url: string): string {
	const ogTitle = getMetaContent(html, "og:title");
	if (ogTitle) return ogTitle;
	const title = getTitle(html);
	if (title) return title.split(/\s*[|\-–—]\s*/)[0]!.trim();
	try {
		const hostname = new URL(url).hostname.replace(/^www\./, "");
		const first = hostname.split(".")[0]!;
		return first.charAt(0).toUpperCase() + first.slice(1);
	} catch {
		return "Unknown";
	}
}

function extractLogoUrl(html: string, baseUrl: string): string | null {
	const resolve = (src: string): string => {
		try { return new URL(src, baseUrl).href; } catch { return src; }
	};

	const ogImage = getMetaContent(html, "og:image");
	if (ogImage) return resolve(ogImage);

	const imgRegex = /<img[^>]*>/gi;
	let m: RegExpExecArray | null;
	while ((m = imgRegex.exec(html)) !== null) {
		const tag = m[0];
		if (/logo/i.test(tag)) {
			const srcMatch = tag.match(/src=["']([^"']+)["']/);
			if (srcMatch?.[1]) return resolve(srcMatch[1]);
		}
	}

	const touchIcon = html.match(
		/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
	);
	if (touchIcon?.[1]) return resolve(touchIcon[1]);

	return extractFaviconUrl(html, baseUrl);
}

function extractFaviconUrl(html: string, baseUrl: string): string | null {
	const resolve = (src: string): string => {
		try { return new URL(src, baseUrl).href; } catch { return src; }
	};
	const faviconLink = html.match(
		/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i,
	);
	if (faviconLink?.[1]) return resolve(faviconLink[1]);
	try { return new URL("/favicon.ico", baseUrl).href; } catch { return null; }
}

const HEX_REGEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const RGB_REGEX = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;

function extractColors(html: string, css: string): BrandKit["colors"] {
	const allColors: string[] = [];
	const sources = css + " " + html;

	let m: RegExpExecArray | null;
	while ((m = HEX_REGEX.exec(sources)) !== null) allColors.push(m[0]);

	while ((m = RGB_REGEX.exec(sources)) !== null) {
		const r = parseInt(m[1]!, 10);
		const g = parseInt(m[2]!, 10);
		const b = parseInt(m[3]!, 10);
		const hex = "#" + [r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("");
		allColors.push(hex);
	}

	const themeColor = getMetaContent(html, "theme-color");
	if (themeColor && /^#[0-9a-fA-F]{3,6}$/i.test(themeColor.trim())) {
		for (let i = 0; i < 10; i++) allColors.push(themeColor.trim());
	}

	const filtered = allColors.filter((c) => {
		const norm = c.replace(/^#/, "").toLowerCase();
		return !/^(fff|ffffff|000|000000|ccc|cccccc|ddd|dddddd|eee|eeeeee|333|333333|666|666666|999|999999|aaa|aaaaaa|bbb|bbbbbb)$/.test(norm);
	});

	const top = dominantColors(filtered.length > 0 ? filtered : allColors, 5);

	return {
		primary: top[0] ?? "#1a1a1a",
		secondary: top[1] ?? "#555555",
		accent: top[2] ?? top[0] ?? "#0066cc",
		background: "#ffffff",
		text: "#111111",
	};
}

function extractFonts(css: string): BrandKit["fonts"] {
	const fontFamilyRegex = /font-family\s*:\s*([^;}"]+)/gi;
	const headingFonts: string[] = [];
	const bodyFonts: string[] = [];
	const allFonts: string[] = [];

	let m: RegExpExecArray | null;
	while ((m = fontFamilyRegex.exec(css)) !== null) {
		const family = m[1]!.trim().split(",")[0]!.trim().replace(/["']/g, "");
		allFonts.push(family);
	}

	const headingBlockRegex = /h[1-3][^{]*\{([^}]+)\}/gi;
	while ((m = headingBlockRegex.exec(css)) !== null) {
		const block = m[1]!;
		const ff = block.match(/font-family\s*:\s*([^;}"]+)/i);
		if (ff?.[1]) {
			headingFonts.push(ff[1].trim().split(",")[0]!.trim().replace(/["']/g, ""));
		}
	}

	const bodyBlockRegex = /(?:body|^p)[^{]*\{([^}]+)\}/gim;
	while ((m = bodyBlockRegex.exec(css)) !== null) {
		const block = m[1]!;
		const ff = block.match(/font-family\s*:\s*([^;}"]+)/i);
		if (ff?.[1]) {
			bodyFonts.push(ff[1].trim().split(",")[0]!.trim().replace(/["']/g, ""));
		}
	}

	const freq = (arr: string[]): string | null => {
		if (arr.length === 0) return null;
		const counts = new Map<string, number>();
		for (const f of arr) counts.set(f, (counts.get(f) ?? 0) + 1);
		return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
	};

	return {
		heading: freq(headingFonts) ?? freq(allFonts) ?? "Georgia",
		body: freq(bodyFonts) ?? freq(allFonts) ?? "Georgia",
	};
}

// --- Main entry point ------------------------------------------------------

export async function extractBrand(url: string): Promise<BrandKit> {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			throw new Error("Only HTTP/HTTPS URLs are supported");
		}
	} catch (e) {
		throw new Error(`Invalid URL: ${(e as Error).message}`);
	}

	// SSRF check BEFORE any outbound network call (including robots.txt).
	// Without this, isAllowedByRobots() would be the first unprotected fetch.
	if (isPrivateHostname(parsedUrl.hostname)) {
		throw new Error(`Refusing to fetch private/internal host: ${parsedUrl.hostname}`);
	}

	const allowed = await isAllowedByRobots(url);
	if (!allowed) throw new Error(`Crawling disallowed by robots.txt`);

	let html: string;
	try {
		html = await fetchBounded(url);
	} catch (e) {
		const msg = (e as Error).message;
		if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
			throw new Error(`Timed out after ${FETCH_TIMEOUT_MS}ms`);
		}
		throw new Error(`Fetch failed: ${msg}`);
	}

	const css = getAllStyleContent(html);
	const description =
		getMetaContent(html, "og:description") ??
		getMetaContent(html, "description") ??
		"";

	return {
		source_url: url,
		name: extractName(html, url),
		logo_url: extractLogoUrl(html, url),
		favicon_url: extractFaviconUrl(html, url),
		colors: extractColors(html, css),
		fonts: extractFonts(css),
		meta: { description },
		extracted_at: new Date().toISOString(),
	};
}
