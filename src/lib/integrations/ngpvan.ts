/**
 * NGP VAN / VoteBuilder adapter — sync contacts to the Democratic voter file.
 *
 * NGP VAN is the gold standard for Democratic campaigns. VAN (Voter Activation
 * Network) maintains the voter file. The API lets us match our supporters
 * against the voter file and apply activist codes or survey responses.
 *
 * This adapter uses the same VAN API as EveryAction (they merged) but targets
 * the VAN-specific endpoints for voter file operations rather than the
 * EveryAction CRM endpoints.
 *
 * Docs: https://docs.ngpvan.com/reference
 * Auth: HTTP Basic with "{appName}:{apiKey}|1" (mode 1 = VAN, mode 0 = EveryAction)
 *
 * Environment:
 *   NGPVAN_API_KEY — API key from VAN admin
 *   NGPVAN_APP_NAME — application name registered with VAN
 *   NGPVAN_ACTIVIST_CODE_ID — optional activist code to apply on match
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://api.securevan.com/v4";
const TIMEOUT_MS = 10_000;

export async function pushToNgpVan(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.NGPVAN_API_KEY || !env.NGPVAN_APP_NAME) return undefined;
	if (!submission.email) return undefined;

	try {
		// Step 1: Find or create the person in VAN
		const authValue = btoa(`${env.NGPVAN_APP_NAME}:${env.NGPVAN_API_KEY}|1`);

		const matchRes = await fetch(`${API_BASE}/people/findOrCreate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${authValue}`,
			},
			body: JSON.stringify({
				firstName: submission.firstName ?? "",
				lastName: submission.lastName ?? "",
				emails: [{ email: submission.email }],
				addresses: submission.postalCode
					? [{ zipOrPostalCode: submission.postalCode }]
					: [],
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});

		if (!matchRes.ok) {
			const body = await matchRes.text();
			return { ok: false, error: `VAN findOrCreate ${matchRes.status}: ${body.slice(0, 200)}` };
		}

		const person = await matchRes.json() as { vanId?: number };
		const vanId = person.vanId;
		// VAN created the contact but no voter file match — expected for email-only
		// submissions (match rates are typically 40-60%). Still ok: the contact
		// exists in VAN, just not linked to a voter file record.
		if (!vanId) return { ok: true, error: "no_van_match" };

		// Step 2: Apply activist code if configured
		if (env.NGPVAN_ACTIVIST_CODE_ID) {
			await fetch(`${API_BASE}/people/${vanId}/canvassResponses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${authValue}`,
				},
				body: JSON.stringify({
					canvassContext: {
						contactTypeId: 37, // API contact type
						inputTypeId: 11,   // API input type
					},
					responses: [{
						activistCodeId: parseInt(String(env.NGPVAN_ACTIVIST_CODE_ID), 10),
						action: "Apply",
						type: "ActivistCode",
					}],
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			// Non-fatal if activist code application fails
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}
