/**
 * Hustle adapter — sync contacts for P2P texting outreach.
 *
 * Hustle is the leading Democratic P2P texting platform. This adapter
 * adds supporters to a Hustle group so campaign texters can reach them.
 * We don't send texts — Hustle's volunteer texters do that.
 *
 * Docs: https://developers.hustle.com/docs
 * Auth: Bearer token (OAuth2)
 *
 * Environment:
 *   HUSTLE_API_TOKEN — OAuth2 access token
 *   HUSTLE_ORGANIZATION_ID — organization ID
 *   HUSTLE_GROUP_ID — optional default group ID to add contacts to
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://api.hustle.com/v1";
const TIMEOUT_MS = 10_000;

export async function pushToHustle(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.HUSTLE_API_TOKEN || !env.HUSTLE_ORGANIZATION_ID) return undefined;
	if (!submission.email) return undefined;

	const groupId = env.HUSTLE_GROUP_ID;

	try {
		// Create or update the lead (Hustle's term for a contact)
		const res = await fetch(
			`${API_BASE}/organizations/${encodeURIComponent(env.HUSTLE_ORGANIZATION_ID)}/leads`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.HUSTLE_API_TOKEN}`,
				},
				body: JSON.stringify({
					firstName: submission.firstName ?? "",
					lastName: submission.lastName ?? "",
					email: submission.email,
					phoneNumber: "", // We don't collect phone — Hustle will match or skip
					address: submission.postalCode
						? { zip: submission.postalCode }
						: undefined,
					customFields: {
						source: "crafted",
						campaign: submission.slug,
						action_type: submission.type,
					},
					...(groupId ? { groupId } : {}),
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: `Hustle ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}
