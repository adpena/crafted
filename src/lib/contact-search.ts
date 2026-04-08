/**
 * Shared cross-campaign contact search logic.
 *
 * Used by both the /api/admin/contacts/search endpoint and the
 * saved-list query runner. Queries the contacts collection in D1
 * and applies SQL-level + JS-level filters.
 *
 * No PII is logged. All queries are parameterized.
 */

import type { ContactsD1 } from "./contacts.ts";
import type { Contact } from "./contacts-types.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";

export interface SearchFilters {
  has_action?: string[];
  missing_action?: string[];
  campaigns?: string[];
  any_campaign?: boolean;
  tags?: string[];
  zip_prefix?: string;
  min_actions?: number;
  since?: string;
}

export interface ContactResult {
  email: string;
  first_name?: string;
  last_name?: string;
  zip?: string;
  total_actions: number;
  campaigns: string[];
  action_types: string[];
  first_seen: string;
  last_action: string;
  tags: string[];
}

export interface SearchResult {
  data: ContactResult[];
  total: number;
}

/**
 * Run a contact search with the given filters and pagination.
 *
 * Applies SQL-level filters (zip, min_actions, since) then
 * JS-level filters (action types, campaigns, tags) for complex
 * cross-campaign queries that can't be expressed in D1 SQL.
 */
export async function runContactSearch(
  db: ContactsD1,
  filters: SearchFilters,
  limit: number,
  offset: number,
): Promise<SearchResult> {
  const conditions: string[] = [
    "plugin_id = ?",
    "collection = ?",
  ];
  const binds: unknown[] = [PLUGIN_ID, COLLECTION];

  // Zip prefix — filterable in SQL via json_extract
  if (filters.zip_prefix && /^\d{1,5}$/.test(filters.zip_prefix)) {
    conditions.push("json_extract(data, '$.zip') LIKE ?");
    binds.push(`${filters.zip_prefix}%`);
  }

  // min_actions — filterable in SQL via json_extract
  if (typeof filters.min_actions === "number" && filters.min_actions > 0) {
    conditions.push("json_extract(data, '$.total_actions') >= ?");
    binds.push(filters.min_actions);
  }

  // since — filter by last_action_at in SQL
  if (filters.since && /^\d{4}-\d{2}-\d{2}/.test(filters.since)) {
    conditions.push("json_extract(data, '$.last_action_at') >= ?");
    binds.push(filters.since);
  }

  const sql = `SELECT data FROM _plugin_storage WHERE ${conditions.join(" AND ")} ORDER BY json_extract(data, '$.last_action_at') DESC`;

  const rows = await db.prepare(sql).bind(...binds).all();

  const results: ContactResult[] = [];
  let total = 0;

  for (const row of rows.results) {
    let contact: Contact;
    try {
      contact = JSON.parse(row.data as string) as Contact;
    } catch {
      continue;
    }

    if (!contact.email || !Array.isArray(contact.action_history)) continue;

    // Determine which actions to consider based on campaign filter
    let relevantActions = contact.action_history;

    if (filters.campaigns && filters.campaigns.length > 0 && !filters.any_campaign) {
      const campaignSet = new Set(filters.campaigns);
      relevantActions = relevantActions.filter((a) => campaignSet.has(a.slug));
    }

    // Apply since filter to action history too
    if (filters.since) {
      relevantActions = relevantActions.filter((a) => a.timestamp >= filters.since!);
    }

    // has_action: must have at least one action of each specified type
    if (filters.has_action && filters.has_action.length > 0) {
      const actionTypes = new Set(relevantActions.map((a) => a.type));
      if (!filters.has_action.every((t) => actionTypes.has(t))) continue;
    }

    // missing_action: must NOT have any action of these types
    if (filters.missing_action && filters.missing_action.length > 0) {
      const actionTypes = new Set(relevantActions.map((a) => a.type));
      if (filters.missing_action.some((t) => actionTypes.has(t))) continue;
    }

    // tags: must have ALL specified tags
    if (filters.tags && filters.tags.length > 0) {
      const contactTags = new Set(contact.tags ?? []);
      if (!filters.tags.every((t) => contactTags.has(t))) continue;
    }

    // min_actions on relevant actions (re-check after campaign filter)
    if (typeof filters.min_actions === "number" && relevantActions.length < filters.min_actions) {
      continue;
    }

    total++;

    // Apply pagination
    if (total <= offset || results.length >= limit) continue;

    const campaigns = [...new Set(relevantActions.map((a) => a.slug))];
    const actionTypes = [...new Set(relevantActions.map((a) => a.type))];

    results.push({
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      zip: contact.zip,
      total_actions: relevantActions.length,
      campaigns,
      action_types: actionTypes,
      first_seen: contact.first_seen_at,
      last_action: contact.last_action_at,
      tags: contact.tags ?? [],
    });
  }

  return { data: results, total };
}
