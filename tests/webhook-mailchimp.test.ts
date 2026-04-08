/**
 * Unit tests for the Mailchimp webhook dispatch helper.
 *
 * Exercises processMailchimpEvent against an in-memory D1-like store and
 * an in-memory KV, covering every event type, every opt-out reason, and
 * the failure paths (no db, no email, storage error).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { processMailchimpEvent } from "../src/lib/webhooks/mailchimp.ts";
import type { ContactsD1 } from "../src/lib/contacts.ts";
import type { Contact } from "../src/lib/contacts-types.ts";

/** Minimal in-memory D1-like store keyed by (plugin_id, collection, id). */
function memoryDb() {
  const rows = new Map<string, { id: string; plugin_id: string; collection: string; data: string; created_at: string; updated_at: string }>();

  const db = {
    prepare(sql: string) {
      // Only support the three queries markContactOptedOut / storeAttributionEvent use.
      const bindings: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          bindings.push(...args);
          return statement;
        },
        async run() {
          if (sql.startsWith("INSERT INTO _plugin_storage")) {
            const [id, plugin_id, collection, data, created_at, updated_at] = bindings as string[];
            rows.set(id, { id, plugin_id, collection, data, created_at, updated_at });
          } else if (sql.startsWith("UPDATE _plugin_storage")) {
            const [data, updated_at, id, plugin_id, collection] = bindings as string[];
            const existing = rows.get(id);
            if (existing && existing.plugin_id === plugin_id && existing.collection === collection) {
              rows.set(id, { ...existing, data, updated_at });
            }
          }
          return {};
        },
        async first() {
          if (sql.includes("SELECT id, data FROM _plugin_storage")) {
            const [plugin_id, collection, emailValue] = bindings as string[];
            for (const row of rows.values()) {
              if (row.plugin_id === plugin_id && row.collection === collection) {
                try {
                  const parsed = JSON.parse(row.data) as { email?: string };
                  if (parsed.email === emailValue) return { id: row.id, data: row.data };
                } catch {
                  // skip
                }
              }
            }
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
      return statement;
    },
  } as ContactsD1;

  return { db, rows };
}

/** Minimal in-memory KV with the `put/get` surface we need. */
function memoryKv() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
    },
  };
}

function findContact(rows: Map<string, { data: string }>, email: string): Contact | undefined {
  for (const row of rows.values()) {
    try {
      const parsed = JSON.parse(row.data) as Contact;
      if (parsed.email === email) return parsed;
    } catch {
      // skip
    }
  }
  return undefined;
}

describe("processMailchimpEvent", () => {
  let store: ReturnType<typeof memoryDb>;
  let kv: ReturnType<typeof memoryKv>;

  beforeEach(() => {
    store = memoryDb();
    kv = memoryKv();
  });

  it("rejects missing type", async () => {
    const r = await processMailchimpEvent("", { db: store.db, kv: kv.kv });
    expect(r.status).toBe(422);
  });

  it("ignores subscribe events (200)", async () => {
    const r = await processMailchimpEvent(
      "type=subscribe&data[email]=a@b.com",
      { db: store.db, kv: kv.kv },
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ignored: "subscribe" });
    expect(store.rows.size).toBe(0);
  });

  it("ignores profile / campaign events", async () => {
    const r1 = await processMailchimpEvent("type=profile", { db: store.db, kv: kv.kv });
    const r2 = await processMailchimpEvent("type=campaign", { db: store.db, kv: kv.kv });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(store.rows.size).toBe(0);
  });

  it("acks upemail without mutating contacts", async () => {
    const body =
      "type=upemail&data[old_email]=old@example.com&data[new_email]=new@example.com";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);
    expect(store.rows.size).toBe(0);
  });

  it("rejects unsubscribe without email", async () => {
    const r = await processMailchimpEvent(
      "type=unsubscribe&fired_at=2026-04-08",
      { db: store.db, kv: kv.kv },
    );
    expect(r.status).toBe(422);
  });

  it("rejects unsubscribe with malformed email", async () => {
    const r = await processMailchimpEvent(
      "type=unsubscribe&data[email]=notanemail",
      { db: store.db, kv: kv.kv },
    );
    expect(r.status).toBe(422);
  });

  it("creates a new opted-out contact on unsubscribe when none exists", async () => {
    const body =
      "type=unsubscribe&fired_at=2026-04-08T10%3A00%3A00Z" +
      "&data[action]=unsub&data[reason]=manual&data[email]=foo%40example.com&data[list_id]=L1";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ recorded: "unsubscribe" });

    const contact = findContact(store.rows, "foo@example.com");
    expect(contact).toBeDefined();
    expect(contact?.opted_out).toBe(true);
    expect(contact?.opted_out_reason).toBe("manual");
    expect(contact?.opted_out_at).toBe("2026-04-08T10:00:00Z");
  });

  it("marks existing contact opted-out on unsubscribe", async () => {
    // Pre-seed a contact (not yet opted out)
    const seed: Contact = {
      email: "jane@example.com",
      first_name: "Jane",
      first_seen_at: "2026-01-01T00:00:00Z",
      last_action_at: "2026-01-01T00:00:00Z",
      total_actions: 3,
      tags: ["donor"],
      action_history: [],
    };
    store.rows.set("pre-existing-id", {
      id: "pre-existing-id",
      plugin_id: "action-pages",
      collection: "contacts",
      data: JSON.stringify(seed),
      created_at: seed.first_seen_at,
      updated_at: seed.first_seen_at,
    });

    const body =
      "type=unsubscribe&data[email]=jane%40example.com&data[reason]=manual";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);

    const contact = findContact(store.rows, "jane@example.com");
    expect(contact?.opted_out).toBe(true);
    // Pre-existing fields preserved
    expect(contact?.first_name).toBe("Jane");
    expect(contact?.total_actions).toBe(3);
    expect(contact?.tags).toEqual(["donor"]);
  });

  it("writes KV suppression entry on opt-out", async () => {
    const body =
      "type=unsubscribe&data[email]=bob%40example.com&data[reason]=manual";
    await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    const key = Array.from(kv.store.keys()).find((k) => k.startsWith("suppressed:"));
    expect(key).toBeDefined();
    expect(kv.store.get(key!)).toBe("manual");
  });

  it("maps cleaned+abuse to spam reason", async () => {
    const body =
      "type=cleaned&data[email]=spam%40example.com&data[reason]=abuse";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);
    const contact = findContact(store.rows, "spam@example.com");
    expect(contact?.opted_out_reason).toBe("spam");
  });

  it("maps cleaned+hard to bounce reason", async () => {
    const body =
      "type=cleaned&data[email]=dead%40example.com&data[reason]=hard";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);
    const contact = findContact(store.rows, "dead@example.com");
    expect(contact?.opted_out_reason).toBe("bounce");
  });

  it("lowercases and trims the email before storage", async () => {
    const body =
      "type=unsubscribe&data[email]=%20FOO%40EXAMPLE.COM%20&data[reason]=manual";
    const r = await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    expect(r.status).toBe(200);
    const contact = findContact(store.rows, "foo@example.com");
    expect(contact).toBeDefined();
  });

  it("returns 503 when db is missing (still caps status)", async () => {
    const body =
      "type=unsubscribe&data[email]=x%40example.com&data[reason]=manual";
    const r = await processMailchimpEvent(body, { kv: kv.kv });
    expect(r.status).toBe(503);
  });

  it("ignores unknown event types (200)", async () => {
    const r = await processMailchimpEvent(
      "type=mysterious&data[email]=a@b.com",
      { db: store.db, kv: kv.kv },
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ignored: "mysterious" });
    expect(store.rows.size).toBe(0);
  });

  it("is idempotent — double unsubscribe leaves a single contact", async () => {
    const body =
      "type=unsubscribe&data[email]=dup%40example.com&data[reason]=manual";
    await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    await processMailchimpEvent(body, { db: store.db, kv: kv.kv });
    const contacts = Array.from(store.rows.values()).filter((r) => {
      try {
        return (JSON.parse(r.data) as Contact).email === "dup@example.com";
      } catch {
        return false;
      }
    });
    expect(contacts).toHaveLength(1);
  });
});
