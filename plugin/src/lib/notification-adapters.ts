/**
 * Notification adapters for Campaign Action Pages.
 *
 * Each adapter formats submission events for a specific platform.
 * All adapters are optional — campaigns configure which ones to use
 * via plugin settings.
 *
 * Supported platforms:
 *   - Slack (incoming webhook)
 *   - Discord (webhook)
 *   - Email (via emdash email capability)
 *   - Analytics export (structured JSON for data pipelines)
 */

interface SubmissionEvent {
	type: string;
	page_slug: string;
	campaign_id?: string;
	timestamp: string;
	data: Record<string, unknown>;
}

// ─── Slack ────────────────────────────────────────────────

export function formatSlackMessage(event: SubmissionEvent): Record<string, unknown> {
	const emoji = {
		petition_sign: ":memo:",
		donation_click: ":money_with_wings:",
		gotv_pledge: ":ballot_box:",
		signup: ":envelope:",
	}[event.type] ?? ":bell:";

	const label = {
		petition_sign: "Petition Signature",
		donation_click: "Donation Click",
		gotv_pledge: "GOTV Pledge",
		signup: "List Signup",
	}[event.type] ?? event.type;

	const fields = Object.entries(event.data)
		.filter(([, v]) => v != null && v !== "")
		.map(([k, v]) => `*${k}:* ${String(v)}`)
		.join("\n");

	return {
		text: `${emoji} New ${label} on ${event.page_slug}`,
		blocks: [
			{
				type: "section",
				text: { type: "mrkdwn", text: `${emoji} *New ${label}*\nPage: \`${event.page_slug}\`` },
			},
			{
				type: "section",
				text: { type: "mrkdwn", text: fields || "_No additional data_" },
			},
			{
				type: "context",
				elements: [{ type: "mrkdwn", text: `${event.timestamp}${event.campaign_id ? ` · Campaign: ${event.campaign_id}` : ""}` }],
			},
		],
	};
}

export async function sendToSlack(url: string, event: SubmissionEvent): Promise<{ ok: boolean; error?: string }> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(formatSlackMessage(event)),
		});
		if (!res.ok) return { ok: false, error: `Slack ${res.status}` };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Network error" };
	}
}

// ─── Discord ──────────────────────────────────────────────

export function formatDiscordMessage(event: SubmissionEvent): Record<string, unknown> {
	const label = {
		petition_sign: "Petition Signature",
		donation_click: "Donation Click",
		gotv_pledge: "GOTV Pledge",
		signup: "List Signup",
	}[event.type] ?? event.type;

	const color = {
		petition_sign: 0x3b82f6,
		donation_click: 0x22c55e,
		gotv_pledge: 0xf59e0b,
		signup: 0x8b5cf6,
	}[event.type] ?? 0x6b7280;

	const fields = Object.entries(event.data)
		.filter(([, v]) => v != null && v !== "")
		.slice(0, 10)
		.map(([k, v]) => ({ name: k, value: String(v).slice(0, 200), inline: true }));

	return {
		embeds: [{
			title: `New ${label}`,
			description: `Page: \`${event.page_slug}\``,
			color,
			fields,
			timestamp: event.timestamp,
			footer: event.campaign_id ? { text: `Campaign: ${event.campaign_id}` } : undefined,
		}],
	};
}

export async function sendToDiscord(url: string, event: SubmissionEvent): Promise<{ ok: boolean; error?: string }> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(formatDiscordMessage(event)),
		});
		if (!res.ok) return { ok: false, error: `Discord ${res.status}` };
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Network error" };
	}
}

// ─── Email Summary ────────────────────────────────────────

export function formatEmailSummary(event: SubmissionEvent): { subject: string; text: string; html: string } {
	const label = {
		petition_sign: "Petition Signature",
		donation_click: "Donation Click",
		gotv_pledge: "GOTV Pledge",
		signup: "List Signup",
	}[event.type] ?? event.type;

	const dataLines = Object.entries(event.data)
		.filter(([, v]) => v != null && v !== "")
		.map(([k, v]) => `${k}: ${String(v)}`);

	const subject = `New ${label}: ${event.page_slug}`;

	const text = [
		`New ${label} on ${event.page_slug}`,
		"",
		...dataLines,
		"",
		`Time: ${event.timestamp}`,
		event.campaign_id ? `Campaign: ${event.campaign_id}` : "",
	].filter(Boolean).join("\n");

	const html = `<div style="font-family:Georgia,serif;max-width:32rem;margin:0 auto;padding:2rem">
<h2 style="font-weight:400;font-size:1.25rem">New ${label}</h2>
<p style="color:#707070">Page: ${event.page_slug}</p>
<table style="width:100%;border-collapse:collapse;margin:1rem 0">
${dataLines.map(line => {
		const [k, ...v] = line.split(": ");
		return `<tr><td style="padding:0.25rem 0;color:#707070;font-family:monospace;font-size:0.75rem">${k}</td><td style="padding:0.25rem 0">${v.join(": ")}</td></tr>`;
	}).join("\n")}
</table>
<p style="font-family:monospace;font-size:0.75rem;color:#707070">${event.timestamp}</p>
</div>`;

	return { subject, text, html };
}

// ─── Analytics Export ─────────────────────────────────────

/**
 * Format a submission for analytics ingestion.
 * Produces a flat, typed record suitable for BigQuery, Snowflake,
 * or any data warehouse that accepts JSONL.
 */
export function formatAnalyticsEvent(event: SubmissionEvent): Record<string, string | number | boolean | null> {
	const flat: Record<string, string | number | boolean | null> = {
		event_type: event.type,
		page_slug: event.page_slug,
		campaign_id: event.campaign_id ?? null,
		timestamp: event.timestamp,
		timestamp_unix: new Date(event.timestamp).getTime(),
	};

	for (const [k, v] of Object.entries(event.data)) {
		if (v === null || v === undefined) {
			flat[`data_${k}`] = null;
		} else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
			flat[`data_${k}`] = v;
		} else {
			flat[`data_${k}`] = JSON.stringify(v);
		}
	}

	return flat;
}
