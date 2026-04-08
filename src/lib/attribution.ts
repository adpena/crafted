/**
 * Attribution events storage and query layer.
 *
 * Stores downstream conversion events (donations, second actions, email opens,
 * volunteer signups) linked back to action page slugs via email hash joins.
 * Email is SHA-256 hashed before storage — raw PII never hits the event table.
 *
 * Storage: D1 `_plugin_storage` (plugin_id='action-pages', collection='attribution_events')
 */

import type { D1Database } from "./cf-types.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "attribution_events";

export type AttributionSource = "actblue" | "actionnetwork" | "mailchimp" | "mobilize";

export type AttributionEventType =
  | "donation"
  | "refund"
  | "action"
  | "email_open"
  | "attendance"
  | "volunteer_signup"
  | "unsubscribe"
  | "bounce";

export interface AttributionEvent {
  id: string;
  source: AttributionSource;
  event_type: AttributionEventType;
  email_hash: string;
  slug?: string;
  amount?: number;
  recurring?: boolean;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AttributionSummary {
  slug: string;
  submissions: number;
  downstream: {
    donations: { count: number; total_amount: number; avg_amount: number };
    second_actions: number;
    email_opens: number;
    volunteer_signups: number;
  };
  conversion_rate: number;
}

/**
 * Store an attribution event in D1.
 * The event must already have email_hash set (never pass raw email here).
 */
export async function storeAttributionEvent(
  db: D1Database,
  event: AttributionEvent,
): Promise<void> {
  const timestamp = event.timestamp || new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(event.id, PLUGIN_ID, COLLECTION, JSON.stringify(event), timestamp, timestamp)
    .run();
}

/**
 * Get attribution summary for an action page slug.
 *
 * Strategy: fetch all attribution events, then cross-reference with
 * submissions for the same slug to compute conversion rates. We also
 * count submissions from `_plugin_storage` where collection='submissions'
 * and the data JSON contains the slug.
 */
export async function getAttributionForPage(
  db: D1Database,
  slug: string,
): Promise<AttributionSummary> {
  // Count submissions for this slug
  const subResult = await db
    .prepare(
      "SELECT COUNT(*) as total FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND data LIKE ?",
    )
    .bind(PLUGIN_ID, `%"slug":"${slug}"%`)
    .first();
  const submissions = (subResult?.total as number) ?? 0;

  // Fetch all attribution events for this slug
  const { results } = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY created_at DESC LIMIT 5000",
    )
    .bind(PLUGIN_ID, COLLECTION)
    .all();

  const events: AttributionEvent[] = [];
  for (const row of results) {
    try {
      const evt = JSON.parse(row.data as string) as AttributionEvent;
      if (evt.slug === slug) events.push(evt);
    } catch {
      // Skip malformed rows
    }
  }

  let donationCount = 0;
  let donationTotal = 0;
  let secondActions = 0;
  let emailOpens = 0;
  let volunteerSignups = 0;

  for (const evt of events) {
    switch (evt.event_type) {
      case "donation":
        donationCount++;
        donationTotal += evt.amount ?? 0;
        break;
      case "refund":
        donationCount--;
        donationTotal -= evt.amount ?? 0;
        break;
      case "action":
        secondActions++;
        break;
      case "email_open":
        emailOpens++;
        break;
      case "volunteer_signup":
      case "attendance":
        volunteerSignups++;
        break;
    }
  }

  // Clamp to zero (refunds could push negative)
  donationCount = Math.max(0, donationCount);
  donationTotal = Math.max(0, donationTotal);

  const avgAmount = donationCount > 0 ? Math.round(donationTotal / donationCount) : 0;
  const conversionRate = submissions > 0 ? Math.round((donationCount / submissions) * 1000) / 1000 : 0;

  return {
    slug,
    submissions,
    downstream: {
      donations: { count: donationCount, total_amount: donationTotal, avg_amount: avgAmount },
      second_actions: secondActions,
      email_opens: emailOpens,
      volunteer_signups: volunteerSignups,
    },
    conversion_rate: conversionRate,
  };
}

/**
 * Get all attribution events for a contact by email hash.
 * Returns newest-first, capped at 500.
 */
export async function getAttributionForContact(
  db: D1Database,
  emailHash: string,
): Promise<AttributionEvent[]> {
  const { results } = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? ORDER BY created_at DESC LIMIT 500",
    )
    .bind(PLUGIN_ID, COLLECTION)
    .all();

  const events: AttributionEvent[] = [];
  for (const row of results) {
    try {
      const evt = JSON.parse(row.data as string) as AttributionEvent;
      if (evt.email_hash === emailHash) events.push(evt);
    } catch {
      // Skip malformed rows
    }
  }
  return events;
}
