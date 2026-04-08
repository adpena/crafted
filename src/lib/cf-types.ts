/**
 * Minimal type stubs for Cloudflare KV and D1 bindings.
 * Shared across rate-limit, dedup, and post-submit modules.
 *
 * These are intentionally minimal — only the methods we actually use.
 * The full types come from @cloudflare/workers-types in dev.
 */

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface D1Database {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}
