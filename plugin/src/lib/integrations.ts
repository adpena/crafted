import { fireWebhooks, type WebhookConfig, sendToSheets, type SubmissionData } from "@crafted/notifications";

export type { WebhookConfig as Callback };

export interface IntegrationConfig {
	callbacks: WebhookConfig[];
	sheetsUrl?: string;
}

/**
 * Fire all configured integrations for a submission event.
 * Runs webhooks and Sheets in parallel. Never throws.
 */
export async function fireIntegrations(
	config: IntegrationConfig,
	event: string,
	data: Record<string, unknown>,
): Promise<{ webhooks: number; sheets: boolean }> {
	const timestamp = new Date().toISOString();
	const sheetsData: SubmissionData = {
		type: event,
		page_slug: String(data.page_slug ?? data.page_id ?? ""),
		campaign_id: data.campaign_id != null ? String(data.campaign_id) : undefined,
		timestamp,
		...data,
	};

	try {
		const [, sheetsResult] = await Promise.allSettled([
			fireWebhooks(config.callbacks, event, data),
			config.sheetsUrl ? sendToSheets(config.sheetsUrl, sheetsData) : null,
		]);

		const sheetsOk =
			sheetsResult.status === "fulfilled" &&
			(sheetsResult.value === null || sheetsResult.value.ok === true);

		return {
			webhooks: config.callbacks.filter(cb => cb.events.includes(event)).length,
			sheets: sheetsOk,
		};
	} catch {
		return { webhooks: 0, sheets: false };
	}
}
