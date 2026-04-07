import type { WebhookConfig } from "@adpena/notifications";

const ALL_EVENTS = ["petition_sign", "donation_click", "gotv_pledge", "signup"];

/**
 * Validate that a webhook URL is HTTPS and not an internal address.
 * Prevents SSRF via configured webhook URLs.
 */
function isValidWebhookUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") return false;
		// Block internal/loopback addresses
		const host = parsed.hostname.toLowerCase();
		if (host === "localhost" || host === "0.0.0.0") return false;
		if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.")) return false;
		if (host.startsWith("172.")) {
			const second = parseInt(host.split(".")[1] ?? "0", 10);
			if (second >= 16 && second <= 31) return false;
		}
		// Block link-local
		if (host.startsWith("169.254.")) return false;
		return true;
	} catch {
		return false;
	}
}

/**
 * Build webhook configurations from plugin KV settings.
 */
export async function buildCallbacks(ctx: { kv: { get<T>(key: string): Promise<T | null> } }): Promise<WebhookConfig[]> {
	const [url1, url2, secret, sheetsUrl] = await Promise.all([
		ctx.kv.get<string>("settings:webhook_url_1"),
		ctx.kv.get<string>("settings:webhook_url_2"),
		ctx.kv.get<string>("settings:webhook_secret"),
		ctx.kv.get<string>("settings:google_sheets_webhook"),
	]);

	const callbacks: WebhookConfig[] = [];

	const trimmedSecret = secret?.trim();

	for (const rawUrl of [url1, url2]) {
		const trimmed = rawUrl?.trim();
		if (trimmed && isValidWebhookUrl(trimmed)) {
			callbacks.push({
				url: trimmed,
				events: ALL_EVENTS,
				format: "json",
				...(trimmedSecret ? { secret: trimmedSecret } : {}),
			});
		} else if (trimmed) {
			console.warn("[webhook-config] rejected invalid webhook URL");
		}
	}

	const sheets = sheetsUrl?.trim();
	if (sheets && isValidWebhookUrl(sheets)) {
		callbacks.push({
			url: sheets,
			events: ALL_EVENTS,
			format: "json",
		});
	}

	return callbacks;
}
