/**
 * Mailchimp adapter — upsert a member to a Mailchimp audience.
 *
 * Uses PUT /lists/{list_id}/members/{subscriber_hash} which is Mailchimp's
 * official upsert pattern. This handles both new and existing contacts:
 * - New contacts are created with status "subscribed"
 * - Existing contacts keep their current status (including "unsubscribed")
 *   via `status_if_new` — this prevents re-subscribing contacts who opted out
 *
 * The subscriber_hash is the MD5 of the lowercase email address.
 *
 * Docs: https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";
import { md5Hex } from "../md5.ts";

export async function pushToMailchimp(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_LIST_ID || !env.MAILCHIMP_DC) {
    return undefined;
  }
  if (!submission.email) return { ok: false, error: "missing email" };

  try {
    const emailLower = submission.email.toLowerCase().trim();
    const subscriberHash = md5Hex(emailLower);
    const url = `https://${env.MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_LIST_ID}/members/${subscriberHash}`;
    const payload = {
      email_address: emailLower,
      status_if_new: "subscribed",
      // Custom merge fields ACTION_TYPE and PAGE_SLUG must be pre-created
      // in Mailchimp's audience settings before these values will appear.
      // Audience → Settings → Audience fields → Add field (text, tags).
      merge_fields: {
        ...(submission.firstName && { FNAME: submission.firstName }),
        ...(submission.lastName && { LNAME: submission.lastName }),
        ACTION_TYPE: submission.type,
        PAGE_SLUG: submission.slug,
      },
      tags: [submission.type, ...(submission.slug ? [submission.slug] : [])],
    };

    const auth = btoa(`anystring:${env.MAILCHIMP_API_KEY}`);
    const res = await fetch(url, {
      method: "PUT",
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
