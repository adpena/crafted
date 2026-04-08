/**
 * Audit log for action-pages admin operations.
 *
 * Stores entries in `_plugin_storage` with plugin_id='action-pages',
 * collection='audit_log'. Designed to be fire-and-forget — never throws.
 *
 * NEVER log raw PII. IPs are SHA-256 hashed (prefix) for privacy.
 * Metadata is JSON-stringified but the caller is responsible for
 * ensuring no PII enters it.
 */

import { sha256Hex } from "./auth.ts";

const PLUGIN_ID = "action-pages";
const COLLECTION = "audit_log";
const MAX_TARGET_LEN = 500;
const MAX_ACTION_LEN = 100;
const MAX_ACTOR_LEN = 200;
const MAX_UA_LEN = 200;

export interface AuditEntry {
  action: string;
  target: string;
  actor: string;
  metadata?: Record<string, unknown>;
  /** Optional request to extract IP + user agent from. */
  request?: Request;
}

export interface AuditRow {
  id: string;
  action: string;
  target: string;
  actor: string;
  metadata: Record<string, unknown> | null;
  ip_hash: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface AuditD1 {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

/**
 * Write an audit log entry. Fire-and-forget — errors are caught and
 * logged sanitized. Returns a promise that always resolves.
 */
export async function logAudit(db: AuditD1 | undefined, entry: AuditEntry): Promise<void> {
  if (!db) return;

  try {
    const action = String(entry.action ?? "").slice(0, MAX_ACTION_LEN);
    const target = String(entry.target ?? "").slice(0, MAX_TARGET_LEN);
    const actor = String(entry.actor ?? "").slice(0, MAX_ACTOR_LEN);

    if (!action || !target || !actor) {
      console.warn("[audit] missing required field");
      return;
    }

    let ipHash: string | null = null;
    let userAgent: string | null = null;
    if (entry.request) {
      const ip = entry.request.headers.get("cf-connecting-ip")
        ?? entry.request.headers.get("x-forwarded-for")
        ?? "";
      if (ip) {
        // SHA-256 prefix (16 bytes hex) — privacy-preserving vs djb2 which
        // is trivially reversible for IPv4 via rainbow tables.
        const full = await sha256Hex(ip.split(",")[0]!.trim());
        ipHash = full.slice(0, 32);
      }
      const ua = entry.request.headers.get("user-agent");
      if (ua) userAgent = ua.slice(0, MAX_UA_LEN);
    }

    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: AuditRow = {
      id,
      action,
      target,
      actor,
      metadata: entry.metadata ?? null,
      ip_hash: ipHash,
      user_agent: userAgent,
      timestamp,
    };

    await db
      .prepare(
        "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, PLUGIN_ID, COLLECTION, JSON.stringify(row), timestamp, timestamp)
      .run();
  } catch (err) {
    // Sanitized — never log entry contents which may contain PII.
    console.error("[audit] write failed:", err instanceof Error ? err.message : "unknown");
  }
}

export const AUDIT_PLUGIN_ID = PLUGIN_ID;
export const AUDIT_COLLECTION = COLLECTION;
