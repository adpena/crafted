import type { Callback } from "./callbacks.ts";

const ALL_EVENTS = ["petition_sign", "donation_click", "gotv_pledge", "signup"];

/**
 * Build webhook callback configurations from plugin KV settings.
 * Reads configured webhook URLs and secret, returns Callback[] objects
 * ready to pass to fireCallbacks().
 */
export async function buildCallbacks(ctx: { kv: { get<T>(key: string): Promise<T | null> } }): Promise<Callback[]> {
	const [url1, url2, secret, sheetsUrl] = await Promise.all([
		ctx.kv.get<string>("settings:webhook_url_1"),
		ctx.kv.get<string>("settings:webhook_url_2"),
		ctx.kv.get<string>("settings:webhook_secret"),
		ctx.kv.get<string>("settings:google_sheets_webhook"),
	]);

	const callbacks: Callback[] = [];

	if (url1?.trim()) {
		callbacks.push({
			url: url1.trim(),
			events: ALL_EVENTS,
			format: "json",
			...(secret?.trim() ? { secret: secret.trim() } : {}),
		});
	}

	if (url2?.trim()) {
		callbacks.push({
			url: url2.trim(),
			events: ALL_EVENTS,
			format: "json",
			...(secret?.trim() ? { secret: secret.trim() } : {}),
		});
	}

	if (sheetsUrl?.trim()) {
		callbacks.push({
			url: sheetsUrl.trim(),
			events: ALL_EVENTS,
			format: "json",
		});
	}

	return callbacks;
}
