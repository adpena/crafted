/**
 * Salsa Labs (Salsa Engage) adapter — sync contacts to Salsa CRM.
 *
 * Salsa is used by many progressive nonprofits and issue advocacy orgs.
 * Now part of Bonterra but the Salsa Engage API remains operational.
 *
 * This adapter creates/updates a supporter record in Salsa so the org's
 * existing email campaigns and advocacy workflows pick them up.
 *
 * Docs: https://help.salsalabs.com/hc/en-us/categories/360000023171-Engage-API
 * Auth: Bearer token (API token from Salsa Engage settings)
 *
 * Environment:
 *   SALSA_API_TOKEN — API token from Salsa Engage
 *   SALSA_HOST — Salsa API host (e.g., "api.salsalabs.org" — varies by instance)
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const TIMEOUT_MS = 10_000;

export async function pushToSalsa(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.SALSA_API_TOKEN || !env.SALSA_HOST) return undefined;
	if (!submission.email) return undefined;

	try {
		// Salsa Engage uses a upsert-style PUT for supporters
		const res = await fetch(
			`https://${encodeURIComponent(env.SALSA_HOST)}/api/integration/ext/v1/supporters`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					authToken: env.SALSA_API_TOKEN,
				},
				body: JSON.stringify({
					payload: {
						supporters: [{
							contacts: [{
								type: "EMAIL",
								value: submission.email,
								status: "OPT_IN",
							}],
							firstName: submission.firstName ?? "",
							lastName: submission.lastName ?? "",
							address: submission.postalCode ? {
								postalCode: submission.postalCode,
							} : undefined,
							customFieldValues: [
								{ fieldId: "crafted_source", value: submission.slug },
								{ fieldId: "crafted_action", value: submission.type },
							],
						}],
					},
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: `Salsa ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}
