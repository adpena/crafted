/**
 * Ad platform click ID capture and UTM parameter tracking.
 *
 * When a visitor clicks an ad on Facebook/Google/TikTok/etc., the platform
 * appends a click ID to the URL. Capturing and storing this ID allows
 * server-side conversion events (Meta CAPI, Google Enhanced Conversions)
 * to match the conversion back to the original ad click.
 *
 * Usage: call captureAttribution() on page load, persist to localStorage,
 * then include the attribution object in the submission data.
 */

/** Known ad platform click ID parameters */
const CLICK_ID_PARAMS = [
	"fbclid",     // Meta (Facebook + Instagram)
	"gclid",      // Google Ads
	"ttclid",     // TikTok Ads
	"twclid",     // Twitter/X Ads
	"li_fat_id",  // LinkedIn Ads
	"rdt_cid",    // Reddit Ads
	"scid",       // Snapchat Ads
	"msclkid",    // Microsoft Ads (Bing)
] as const;

/** UTM parameters for campaign tracking */
const UTM_PARAMS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_content",
	"utm_term",
] as const;

const STORAGE_KEY = "crafted:attribution";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ClickAttribution {
	// Click IDs (one per platform, usually only one present)
	fbclid?: string;
	gclid?: string;
	ttclid?: string;
	twclid?: string;
	li_fat_id?: string;
	rdt_cid?: string;
	scid?: string;
	msclkid?: string;

	// UTM parameters
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_content?: string;
	utm_term?: string;

	// Context
	referrer?: string;
	page_url?: string;
	captured_at: string;
}

/**
 * Parse the current URL for all known click IDs and UTM params.
 * Call this on page load in the action page component.
 */
export function captureAttribution(url?: string): ClickAttribution {
	const parsedUrl = url ? new URL(url) : (typeof window !== "undefined" ? new URL(window.location.href) : null);
	const params = parsedUrl?.searchParams;

	const attr: ClickAttribution = {
		captured_at: new Date().toISOString(),
		page_url: parsedUrl?.href,
		referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
	};

	if (!params) return attr;

	// Capture click IDs
	for (const param of CLICK_ID_PARAMS) {
		const value = params.get(param);
		if (value) {
			attr[param] = value.slice(0, 500);
		}
	}

	// Capture UTM params
	for (const param of UTM_PARAMS) {
		const value = params.get(param);
		if (value) {
			attr[param] = value.slice(0, 200);
		}
	}

	return attr;
}

/**
 * Persist attribution to localStorage for cross-page survival
 * (e.g., petition → followup fundraise). Uses 7-day TTL.
 */
export function persistAttribution(attr: ClickAttribution): void {
	try {
		const payload = JSON.stringify({ attr, expires: Date.now() + TTL_MS });
		localStorage.setItem(STORAGE_KEY, payload);
	} catch {
		// localStorage unavailable (private browsing, quota exceeded)
	}
}

/**
 * Read persisted attribution. Returns null if expired or never set.
 */
export function readAttribution(): ClickAttribution | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const { attr, expires } = JSON.parse(raw);
		if (Date.now() > expires) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return attr;
	} catch {
		return null;
	}
}

/**
 * Determine which ad platform the visitor came from.
 * Returns the first matching platform based on click ID presence.
 */
export function detectPlatform(attr: ClickAttribution): string | null {
	if (attr.fbclid) return "meta";
	if (attr.gclid) return "google";
	if (attr.ttclid) return "tiktok";
	if (attr.twclid) return "twitter";
	if (attr.li_fat_id) return "linkedin";
	if (attr.rdt_cid) return "reddit";
	if (attr.scid) return "snapchat";
	if (attr.msclkid) return "microsoft";
	return null;
}

/**
 * Merge attribution data into a submission object's fields.
 * This is what gets sent to the notification adapters (Meta CAPI, etc.)
 * so they can match the conversion to the original click.
 */
export function mergeAttribution(
	fields: Record<string, string>,
	attr: ClickAttribution | null,
): Record<string, string> {
	if (!attr) return fields;
	const merged = { ...fields };
	for (const [key, value] of Object.entries(attr)) {
		if (value && typeof value === "string" && !merged[key]) {
			merged[key] = value;
		}
	}
	return merged;
}
