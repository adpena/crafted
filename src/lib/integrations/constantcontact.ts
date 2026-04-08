/**
 * Constant Contact adapter — sync contacts to Constant Contact lists.
 *
 * Adds the supporter to a CC contact list. Does NOT send email — CC's
 * existing automation handles that.
 *
 * Docs: https://developer.constantcontact.com/api_reference/index.html#!/Contacts/createContact
 * Auth: OAuth2 Bearer token
 *
 * Environment:
 *   CONSTANT_CONTACT_API_KEY — OAuth2 access token
 *   CONSTANT_CONTACT_LIST_ID — list ID to add contacts to (required)
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://api.cc.email/v3";
const TIMEOUT_MS = 10_000;

export async function pushToConstantContact(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.CONSTANT_CONTACT_API_KEY || !env.CONSTANT_CONTACT_LIST_ID) return undefined;
	if (!submission.email) return undefined;

	try {
		const payload = {
			email_address: {
				address: submission.email,
				permission_to_send: "implicit",
			},
			first_name: submission.firstName ?? "",
			last_name: submission.lastName ?? "",
			list_memberships: [env.CONSTANT_CONTACT_LIST_ID],
			taggings: [
				`crafted:${submission.type}`,
				...(submission.slug ? [`page:${submission.slug}`] : []),
			],
		};

		const res = await fetch(`${API_BASE}/contacts`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.CONSTANT_CONTACT_API_KEY}`,
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});

		// 409 = contact already exists — treat as success (idempotent)
		if (res.status === 409) return { ok: true };

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: `ConstantContact ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}
