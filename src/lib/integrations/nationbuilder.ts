/**
 * NationBuilder adapter — create/update a signup via NationBuilder API v2.
 *
 * Docs: https://nationbuilder.com/api_documentation
 * v2 uses JSON:API format: { data: { type: "signups", attributes: { ... } } }
 *
 * Note: v1 People API is unmaintained. This adapter uses v2 Signups API.
 * Bearer tokens work with both v1 and v2 endpoints.
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

// NationBuilder nation slugs: lowercase alphanumerics and hyphens, max 63 chars.
const NB_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function pushToNationBuilder(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
  if (!env.NATIONBUILDER_NATION_SLUG || !env.NATIONBUILDER_API_TOKEN) {
    return undefined;
  }
  if (!NB_SLUG_RE.test(env.NATIONBUILDER_NATION_SLUG)) {
    return { ok: false, error: "invalid nation slug" };
  }
  if (!submission.email) return { ok: false, error: "missing email" };

  try {
    // v2 Signups API — JSON:API format
    const url = `https://${env.NATIONBUILDER_NATION_SLUG}.nationbuilder.com/api/v2/signups`;
    const payload = {
      data: {
        type: "signups",
        attributes: {
          email: submission.email,
          first_name: submission.firstName,
          last_name: submission.lastName,
          tag_list: [
            `crafted:${submission.type}`,
            ...(submission.slug ? [`page:${submission.slug}`] : []),
          ],
        },
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${env.NATIONBUILDER_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `NationBuilder ${res.status}: ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
