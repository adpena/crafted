/**
 * Mobilize America adapter — syncs event RSVPs to Mobilize.
 *
 * Docs: https://github.com/mobilizeamerica/api
 *
 * API reality check:
 *   Mobilize America is an event-centric platform. The public v1 API does NOT
 *   expose a `POST /people` endpoint — people are only read-only via list
 *   endpoints. The only supported write paths relevant to action pages are:
 *
 *     POST /v1/organizations/:org_id/events/:event_id/attendances
 *     POST /v1/organizations/:org_id/affiliations
 *     POST /v1/organizations/:org_id/events             (create event)
 *
 *   So this adapter:
 *     - Pushes `event_rsvp` submissions to the attendances endpoint
 *       (the canonical use case for a campaign landing page).
 *     - Silently skips all other submission types — Mobilize is not a
 *       petition/signup CRM and lacks a write endpoint for tagging a person.
 *
 * Event / timeslot resolution:
 *   The attendances endpoint requires an organization_id, event_id AND at
 *   least one timeslot_id. We resolve them in this priority order:
 *     1. submission.eventIds.mobilize        (per-page override, "<eventId>"
 *                                             or "<eventId>:<timeslotId>")
 *     2. env.MOBILIZE_EVENT_ID / MOBILIZE_TIMESLOT_ID (global default)
 *   env.MOBILIZE_ORGANIZATION_ID is always required.
 *
 * Activist codes / tagging:
 *   Mobilize does not natively support activist codes or person tags over the
 *   public API. As a best-effort alternative, pushToActivistCode() forwards
 *   the configured MOBILIZE_ACTIVIST_CODE as a `utm_campaign` value on the
 *   attendance referrer object, so the code shows up in Mobilize reporting
 *   and on the exported CSV for downstream segmentation.
 *
 * Environment:
 *   MOBILIZE_API_TOKEN       Bearer token from mobilize.us/admin/settings/api/
 *   MOBILIZE_ORGANIZATION_ID Required numeric organization id
 *   MOBILIZE_EVENT_ID        Optional default event id (single-event orgs)
 *   MOBILIZE_TIMESLOT_ID     Optional default timeslot id
 *   MOBILIZE_ACTIVIST_CODE   Optional tag forwarded as utm_campaign
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

const API_BASE = "https://api.mobilize.us/v1";
const TIMEOUT_MS = 10_000;
const ID_RE = /^[0-9]{1,19}$/; // Mobilize IDs are numeric; cap at int64 width
const SAFE_CODE_RE = /^[a-zA-Z0-9_.:\-]{1,64}$/;

export async function pushToMobilize(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	if (!env.MOBILIZE_API_TOKEN) return undefined;
	if (!submission.email) return undefined;

	// Mobilize only accepts writes for event attendances — skip non-event actions
	if (submission.type !== "event_rsvp") return undefined;

	return pushAttendance(submission, env);
}

interface ResolvedIds {
	eventId: string;
	timeslotId?: string;
}

/**
 * Parse submission.eventIds.mobilize which may be:
 *   "12345"           → { eventId: "12345" }
 *   "12345:67890"     → { eventId: "12345", timeslotId: "67890" }
 */
function parseEventRef(raw: string | undefined): ResolvedIds | undefined {
	if (!raw) return undefined;
	const [eventId, timeslotId] = raw.split(":", 2);
	if (!eventId || !ID_RE.test(eventId)) return undefined;
	if (timeslotId !== undefined && !ID_RE.test(timeslotId)) return undefined;
	return { eventId, timeslotId };
}

async function pushAttendance(
	submission: IntegrationSubmission,
	env: IntegrationEnv,
): Promise<IntegrationResult | undefined> {
	const orgId = env.MOBILIZE_ORGANIZATION_ID;
	if (!orgId) return undefined; // org not configured — skip silently
	if (!ID_RE.test(orgId)) {
		return { ok: false, error: "invalid organization id" };
	}

	const perPage = parseEventRef(submission.eventIds?.mobilize);
	const eventId = perPage?.eventId ?? env.MOBILIZE_EVENT_ID;
	if (!eventId) return undefined; // no event configured — skip silently
	if (!ID_RE.test(eventId)) {
		return { ok: false, error: "invalid event id" };
	}

	const timeslotId = perPage?.timeslotId ?? env.MOBILIZE_TIMESLOT_ID;
	if (!timeslotId) return undefined; // no timeslot configured — skip silently
	if (!ID_RE.test(timeslotId)) {
		return { ok: false, error: "invalid timeslot id" };
	}

	const payload: Record<string, unknown> = {
		person: {
			given_name: submission.firstName ?? "",
			family_name: submission.lastName ?? "",
			email_address: submission.email,
			// Mobilize requires phone_number key; empty string is allowed
			phone_number: "",
			postal_code: submission.postalCode ?? "",
		},
		timeslots: [{ timeslot_id: Number(timeslotId) }],
	};

	// Forward activist code as utm_campaign on the referrer — best-effort
	// tagging since Mobilize has no native activist-code write API.
	const activistCode = env.MOBILIZE_ACTIVIST_CODE;
	if (activistCode && SAFE_CODE_RE.test(activistCode)) {
		const referrer: Record<string, string> = {
			utm_source: "crafted",
			utm_medium: "action-page",
			utm_campaign: activistCode,
		};
		if (submission.slug) referrer.utm_content = submission.slug;
		if (submission.pageUrl) {
			try {
				const u = new URL(submission.pageUrl);
				if (u.protocol === "https:" || u.protocol === "http:") {
					referrer.url = u.toString();
				}
			} catch {
				// ignore malformed url
			}
		}
		payload.referrer = referrer;
	}

	try {
		const res = await fetch(
			`${API_BASE}/organizations/${encodeURIComponent(orgId)}` +
				`/events/${encodeURIComponent(eventId)}/attendances`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.MOBILIZE_API_TOKEN}`,
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);

		if (!res.ok) {
			const body = await res.text();
			return {
				ok: false,
				error: `Mobilize attendance ${res.status}: ${body.slice(0, 200)}`,
			};
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "unknown" };
	}
}

