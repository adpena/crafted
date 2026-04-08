import { describe, it, expect } from "vitest";
import { checkDedup } from "../../src/lib/dedup.js";

function createMockKV() {
  const store: Record<string, string> = {};
  return {
    get: async (key: string) => store[key] ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store[key] = value;
    },
    /** Expose store for assertions */
    _store: store,
  };
}

describe("checkDedup", () => {
  it("first submission is not duplicate", async () => {
    const kv = createMockKV();
    const result = await checkDedup(kv as any, "ada@example.com", "my-petition");
    expect(result.duplicate).toBe(false);
  });

  it("same email + same slug is duplicate", async () => {
    const kv = createMockKV();
    await checkDedup(kv as any, "ada@example.com", "my-petition");
    const result = await checkDedup(kv as any, "ada@example.com", "my-petition");
    expect(result.duplicate).toBe(true);
  });

  it("same email + different slug is not duplicate", async () => {
    const kv = createMockKV();
    await checkDedup(kv as any, "ada@example.com", "petition-a");
    const result = await checkDedup(kv as any, "ada@example.com", "petition-b");
    expect(result.duplicate).toBe(false);
  });

  it("no email is not duplicate", async () => {
    const kv = createMockKV();
    const result = await checkDedup(kv as any, undefined, "my-petition");
    expect(result.duplicate).toBe(false);
  });

  it("email is case-insensitive", async () => {
    const kv = createMockKV();
    await checkDedup(kv as any, "Ada@Example.COM", "my-petition");
    const result = await checkDedup(kv as any, "ada@example.com", "my-petition");
    expect(result.duplicate).toBe(true);
  });

  it("key is SHA-256 hash, not raw email", async () => {
    const kv = createMockKV();
    await checkDedup(kv as any, "secret@example.com", "test-page");

    const keys = Object.keys(kv._store);
    expect(keys.length).toBe(1);
    expect(keys[0]).toMatch(/^dedup:/);
    // Key should not contain the raw email
    expect(keys[0]).not.toContain("secret@example.com");
    // SHA-256 hex fragment should be 32 hex chars (16 bytes)
    const hash = keys[0].replace("dedup:", "");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("no email means no KV write", async () => {
    const kv = createMockKV();
    await checkDedup(kv as any, undefined, "my-petition");
    expect(Object.keys(kv._store).length).toBe(0);
  });
});
