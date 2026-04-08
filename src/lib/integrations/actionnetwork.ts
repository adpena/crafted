/**
 * Action Network adapter — POST people to AN's OSDI-style People API.
 * Docs: https://actionnetwork.org/docs/v2/people
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

export async function pushToActionNetwork(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
  if (!env.ACTION_NETWORK_API_KEY) return undefined;
  if (!submission.email) return { ok: false, error: "missing email" };

  try {
    const payload = {
      person: {
        family_name: submission.lastName,
        given_name: submission.firstName,
        email_addresses: [{ address: submission.email }],
        ...(submission.postalCode && {
          postal_addresses: [{ postal_code: submission.postalCode }],
        }),
      },
      add_tags: [
        `crafted:${submission.type}`,
        ...(submission.slug ? [`page:${submission.slug}`] : []),
      ],
    };

    const res = await fetch("https://actionnetwork.org/api/v2/people", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "OSDI-API-Token": env.ACTION_NETWORK_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `ActionNetwork ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
