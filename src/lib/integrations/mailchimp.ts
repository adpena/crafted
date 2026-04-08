/**
 * Mailchimp adapter — POST a member to a Mailchimp audience.
 * Docs: https://mailchimp.com/developer/marketing/api/list-members/
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

export async function pushToMailchimp(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_LIST_ID || !env.MAILCHIMP_DC) {
    return undefined;
  }
  if (!submission.email) return { ok: false, error: "missing email" };

  try {
    const url = `https://${env.MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_LIST_ID}/members`;
    const payload = {
      email_address: submission.email,
      status: "subscribed",
      merge_fields: {
        ...(submission.firstName && { FNAME: submission.firstName }),
        ...(submission.lastName && { LNAME: submission.lastName }),
      },
      tags: [submission.type, ...(submission.slug ? [submission.slug] : [])],
    };

    const auth = btoa(`anystring:${env.MAILCHIMP_API_KEY}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Mailchimp ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
