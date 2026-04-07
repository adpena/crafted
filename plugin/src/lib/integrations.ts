import { fireCallbacks, type Callback } from "./callbacks.ts";
import { sendToSheets, type SubmissionData } from "./sheets-adapter.ts";
import { sendToSlack, sendToDiscord, formatEmailSummary, formatAnalyticsEvent } from "./notification-adapters.ts";

export interface IntegrationConfig {
	callbacks: Callback[];
	sheetsUrl?: string;
	slackUrl?: string;
	discordUrl?: string;
	notificationEmail?: string;
	emailSend?: (message: { to: string; subject: string; text: string; html?: string }) => Promise<void>;
}

interface SubmissionEvent {
	type: string;
	page_slug: string;
	campaign_id?: string;
	timestamp: string;
	data: Record<string, unknown>;
}

interface IntegrationResult {
	webhooks: number;
	sheets: boolean;
	slack: boolean;
	discord: boolean;
	email: boolean;
	analytics: Record<string, string | number | boolean | null> | null;
}

/**
 * Fire all configured integrations for a submission event.
 * Runs everything in parallel. Never throws.
 */
export async function fireIntegrations(
	config: IntegrationConfig,
	event: string,
	data: Record<string, unknown>,
): Promise<IntegrationResult> {
	const timestamp = new Date().toISOString();
	const submissionEvent: SubmissionEvent = {
		type: event,
		page_slug: String(data.page_slug ?? data.page_id ?? ""),
		campaign_id: data.campaign_id != null ? String(data.campaign_id) : undefined,
		timestamp,
		data,
	};

	const sheetsData: SubmissionData = {
		type: event,
		page_slug: submissionEvent.page_slug,
		campaign_id: submissionEvent.campaign_id,
		timestamp,
		...data,
	};

	try {
		const results = await Promise.allSettled([
			// Webhooks (Zapier, custom endpoints)
			fireCallbacks(config.callbacks, event, data),
			// Google Sheets
			config.sheetsUrl ? sendToSheets(config.sheetsUrl, sheetsData) : null,
			// Slack
			config.slackUrl ? sendToSlack(config.slackUrl, submissionEvent) : null,
			// Discord
			config.discordUrl ? sendToDiscord(config.discordUrl, submissionEvent) : null,
			// Email notification
			config.notificationEmail && config.emailSend
				? config.emailSend({ to: config.notificationEmail, ...formatEmailSummary(submissionEvent) })
				: null,
		]);

		const ok = (r: PromiseSettledResult<unknown>) =>
			r.status === "fulfilled" && (r.value === null || (r.value as any)?.ok !== false);

		return {
			webhooks: config.callbacks.filter(cb => cb.events.includes(event)).length,
			sheets: ok(results[1]!),
			slack: ok(results[2]!),
			discord: ok(results[3]!),
			email: ok(results[4]!),
			analytics: formatAnalyticsEvent(submissionEvent),
		};
	} catch {
		return { webhooks: 0, sheets: false, slack: false, discord: false, email: false, analytics: null };
	}
}
