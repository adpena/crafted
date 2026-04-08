/**
 * Contacts dedup + upsert layer.
 *
 * Contacts are derived from action-page submissions. Each contact is keyed
 * by lowercased email (within plugin_id='action-pages', collection='contacts')
 * and accumulates an action_history across submissions.
 *
 * Concurrency note: D1 read-modify-write is not atomic. Two simultaneous
 * upserts for the same email may collide; we accept last-write-wins. The
 * underlying submissions table remains the authoritative log.
 */

import type { Contact, ContactAction } from "./contacts-types.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "contacts";

/** Minimal D1 binding shape — we only use what we need. */
export interface ContactsD1 {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

export interface UpsertContactInput {
  email: string;
  first_name?: string;
  last_name?: string;
  zip?: string;
  slug: string;
  type: string;
  timestamp?: string;
}

export interface UpsertContactResult {
  id: string;
  isNew: boolean;
}

/**
 * Insert or update a contact for the given submission.
 *
 * - Email is lowercased and trimmed before lookup/storage.
 * - Existing contacts have the action appended to action_history,
 *   total_actions incremented, last_action_at refreshed.
 * - Missing first_name/last_name/zip are backfilled from submission data
 *   when the existing record has no value.
 * - All queries are parameterized.
 */
export async function upsertContact(
  db: ContactsD1,
  submission: UpsertContactInput,
): Promise<UpsertContactResult> {
  const email = submission.email.trim().toLowerCase();
  if (!email) {
    throw new Error("upsertContact: email is required");
  }

  const now = submission.timestamp ?? new Date().toISOString();
  const action: ContactAction = {
    slug: submission.slug,
    type: submission.type,
    timestamp: now,
  };

  // Look up existing contact by lowercased email.
  const existing = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = ? AND json_extract(data, '$.email') = ? LIMIT 1",
    )
    .bind(PLUGIN_ID, COLLECTION, email)
    .first();

  if (existing) {
    const id = existing.id as string;
    let current: Contact;
    try {
      current = JSON.parse(existing.data as string) as Contact;
    } catch {
      // Corrupted row — rebuild from scratch but keep id.
      current = {
        email,
        first_seen_at: now,
        last_action_at: now,
        total_actions: 0,
        tags: [],
        action_history: [],
      };
    }

    const history = Array.isArray(current.action_history) ? current.action_history.slice() : [];
    history.push(action);

    const updated: Contact = {
      email,
      first_name: current.first_name || submission.first_name || undefined,
      last_name: current.last_name || submission.last_name || undefined,
      zip: current.zip || submission.zip || undefined,
      first_seen_at: current.first_seen_at || now,
      last_action_at: now,
      total_actions: (typeof current.total_actions === "number" ? current.total_actions : 0) + 1,
      tags: Array.isArray(current.tags) ? current.tags : [],
      action_history: history,
    };

    await db
      .prepare(
        "UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE id = ? AND plugin_id = ? AND collection = ?",
      )
      .bind(JSON.stringify(updated), now, id, PLUGIN_ID, COLLECTION)
      .run();

    return { id, isNew: false };
  }

  // Insert new contact.
  const id = crypto.randomUUID();
  const fresh: Contact = {
    email,
    first_name: submission.first_name || undefined,
    last_name: submission.last_name || undefined,
    zip: submission.zip || undefined,
    first_seen_at: now,
    last_action_at: now,
    total_actions: 1,
    tags: [],
    action_history: [action],
  };

  await db
    .prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, PLUGIN_ID, COLLECTION, JSON.stringify(fresh), now, now)
    .run();

  return { id, isNew: true };
}

/**
 * Sanitize a tag value: trim, strip non-printable, cap at 50 chars.
 * Returns null if the tag is empty after sanitization.
 */
export function sanitizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Strip control chars (C0 + DEL + C1) — keep printable + whitespace, then trim.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim().slice(0, 50);
  return cleaned.length === 0 ? null : cleaned;
}

export const MAX_TAGS_PER_CONTACT = 20;
