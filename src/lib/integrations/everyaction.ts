/**
 * EveryAction / NGP VAN adapter — findOrCreate a Person via the SecureVAN API.
 * Docs: https://docs.everyaction.com/reference/people
 *
 * Auth: HTTP Basic with username "{app_name}" and password "{api_key}|0".
 * The trailing "|0" selects API mode 0 (MyCampaign); use "|1" for VoterFile.
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

export async function pushToEveryAction(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
  if (!env.EVERYACTION_API_KEY || !env.EVERYACTION_APP_NAME) return undefined;
  if (!submission.email) return { ok: false, error: "missing email" };

  try {
    const payload = {
      firstName: submission.firstName,
      lastName: submission.lastName,
      emails: [{ email: submission.email, isSubscribed: true }],
      ...(submission.postalCode && {
        addresses: [{ zipOrPostalCode: submission.postalCode }],
      }),
    };

    const auth = btoa(`${env.EVERYACTION_APP_NAME}:${env.EVERYACTION_API_KEY}|0`);
    const res = await fetch("https://api.securevan.com/v4/people/findOrCreate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `EveryAction ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
