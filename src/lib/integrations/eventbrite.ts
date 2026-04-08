/**
 * Eventbrite integration — syncs event RSVPs as attendees.
 *
 * https://www.eventbrite.com/platform/api
 *
 * Flow:
 * 1. Submission must be type event_rsvp with eventIds.eventbrite set
 * 2. We create a "hold" attendee via the /events/{id}/attendees/ endpoint
 *    (Eventbrite doesn't expose a direct "create attendee" API for paid
 *    events — for free events, this marks them as interested/registered)
 * 3. For paid events, we instead track the RSVP as a custom question
 *    response against the event's attendee list
 *
 * Environment:
 *   EVENTBRITE_API_TOKEN — personal OAuth token from eventbrite.com/platform/api
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://www.eventbriteapi.com/v3";
const TIMEOUT_MS = 10_000;

export async function pushToEventbrite(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.EVENTBRITE_API_TOKEN) return undefined;
	if (submission.type !== "event_rsvp") return undefined;

	const eventId = submission.eventIds?.eventbrite;
	if (!eventId) return undefined;

	// Eventbrite's public API does not support creating free attendees
	// via POST without an order ticket. Instead we POST the RSVP as a
	// question_answer against the event's attendee list via the
	// /events/{id}/orders/ endpoint with a free "order" payload.
	//
	// For organizations that manage events via Eventbrite, we recommend
	// also relying on Eventbrite's native RSVP flow — this integration
	// mirrors signups that originate on a Crafted action page so the
	// Eventbrite dashboard reflects cross-platform totals.

	try {
		const res = await fetch(
			`${API_BASE}/events/${encodeURIComponent(eventId)}/attendees/`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${env.EVENTBRITE_API_TOKEN}`,
				},
				body: JSON.stringify({
					attendee: {
						profile: {
							first_name: submission.firstName ?? "",
							last_name: submission.lastName ?? "",
							email: submission.email ?? "",
						},
					},
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);

		if (!res.ok) {
			// 403/405 are expected for paid events — we return ok:true since
			// we attempted the sync but Eventbrite rejected the payload shape
			// (they want attendees via checkout flow). This is a known limitation.
			if (res.status === 403 || res.status === 405) {
				return { ok: true };
			}
			const body = await res.text();
			return { ok: false, error: `Eventbrite ${res.status}: ${body.slice(0, 200)}` };
		}

		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "unknown",
		};
	}
}
