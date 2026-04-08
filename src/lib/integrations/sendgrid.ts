/**
 * SendGrid adapter — sync contacts to SendGrid Marketing Campaigns.
 *
 * Adds the supporter to a SendGrid contact list so the campaign's existing
 * SendGrid email workflows pick them up. Does NOT send email — that's
 * SendGrid's job. We just sync the contact.
 *
 * Docs: https://docs.sendgrid.com/api-reference/contacts/add-or-update-a-contact
 *
 * Environment:
 *   SENDGRID_API_KEY — SendGrid API key with Marketing permission
 *   SENDGRID_LIST_ID — optional list ID to add contacts to
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://api.sendgrid.com/v3";
const TIMEOUT_MS = 10_000;

export async function pushToSendGrid(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.SENDGRID_API_KEY) return undefined;
	if (!submission.email) return undefined;

	try {
		const contacts = [{
			email: submission.email,
			first_name: submission.firstName ?? "",
			last_name: submission.lastName ?? "",
			postal_code: submission.postalCode ?? "",
			custom_fields: {
				crafted_source: submission.slug,
				crafted_action: submission.type,
			},
		}];

		const payload: Record<string, unknown> = { contacts };
		if (env.SENDGRID_LIST_ID) {
			payload.list_ids = [env.SENDGRID_LIST_ID];
		}

		const res = await fetch(`${API_BASE}/marketing/contacts`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: `SendGrid ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}
