/**
 * Facebook Events integration — marks RSVPs against a Facebook event.
 *
 * https://developers.facebook.com/docs/graph-api/reference/event/attending
 *
 * Requires a user access token with `events_management` scope. The token
 * must belong to a user who is an admin of the event.
 *
 * Flow:
 * 1. Submission must be type event_rsvp with eventIds.facebook set
 * 2. We POST to /{event_id}/attending to mark the user as attending
 *    (requires the Facebook user ID — we DON'T have this, so we instead
 *    record the RSVP via custom event metadata in a dedicated thread)
 *
 * NOTE: Facebook deprecated most event RSVP write APIs in 2018 for
 * privacy reasons. This integration primarily serves to notify campaign
 * staff that a cross-platform RSVP came in via Crafted, using the
 * Conversions API (CAPI) Lead event as the sync mechanism.
 *
 * Environment:
 *   FACEBOOK_ACCESS_TOKEN — user or page access token
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://graph.facebook.com/v25.0";
const TIMEOUT_MS = 10_000;

export async function pushToFacebookEvent(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.FACEBOOK_ACCESS_TOKEN) return undefined;
	if (submission.type !== "event_rsvp") return undefined;

	const eventId = submission.eventIds?.facebook;
	if (!eventId) return undefined;

	// Hash email for CAPI-style matching
	const email = submission.email?.toLowerCase().trim();
	if (!email) return undefined;

	const hashedEmail = await sha256Hex(email);

	try {
		// Use CAPI Lead event pattern — push as a conversion against the event
		const res = await fetch(
			`${API_BASE}/${encodeURIComponent(eventId)}/events`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${env.FACEBOOK_ACCESS_TOKEN}`,
				},
				body: JSON.stringify({
					data: [{
						event_name: "Lead",
						event_time: Math.floor(Date.now() / 1000),
						action_source: "website",
						event_source_url: submission.pageUrl,
						user_data: {
							em: [hashedEmail],
							fn: submission.firstName
								? [await sha256Hex(submission.firstName.toLowerCase())]
								: undefined,
							ln: submission.lastName
								? [await sha256Hex(submission.lastName.toLowerCase())]
								: undefined,
						},
						custom_data: {
							content_name: submission.pageTitle ?? submission.slug,
							content_category: "event_rsvp",
						},
					}],
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: `Facebook ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "unknown",
		};
	}
}

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
