/**
 * Post-submit pipeline tests.
 *
 * Tests the orchestration logic: all 5 tasks run in parallel, individual
 * task failures don't block others, and the result includes all task statuses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks — must use vi.hoisted so they're available in mock factories
const mocks = vi.hoisted(() => ({
  renderConfirmationEmail: vi.fn(() => ({
    subject: "Thanks",
    html: "<p>Thanks</p>",
    text: "Thanks",
  })),
  fireConversions: vi.fn(async () => ({})),
  dispatchIntegrations: vi.fn(async () => ({})),
  upsertContact: vi.fn(async () => {}),
}));

vi.mock("../../src/lib/email-templates.ts", () => ({
  renderConfirmationEmail: mocks.renderConfirmationEmail,
}));

vi.mock("../../src/lib/conversion-tracking.ts", () => ({
  fireConversions: mocks.fireConversions,
}));

vi.mock("../../src/lib/integrations/index.ts", () => ({
  dispatchIntegrations: mocks.dispatchIntegrations,
}));

vi.mock("../../src/lib/contacts.ts", () => ({
  upsertContact: mocks.upsertContact,
}));

import { runPostSubmitPipeline, type PostSubmitContext } from "../../src/lib/post-submit.ts";

function makeCtx(overrides: Partial<PostSubmitContext> = {}): PostSubmitContext {
  return {
    kv: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
      getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
    } as unknown as PostSubmitContext["kv"],
    db: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => ({})),
          first: vi.fn(async () => null),
          all: vi.fn(async () => ({ results: [] })),
        })),
      })),
    } as unknown as PostSubmitContext["db"],
    submission: {
      type: "petition_sign",
      slug: "test-page",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      zip: "02139",
    },
    env: {
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.com",
    },
    ...overrides,
  };
}

describe("runPostSubmitPipeline", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) {
      fn.mockClear();
    }
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock global fetch for the email sending
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email-123" }), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs all 5 tasks in parallel and returns result", async () => {
    const ctx = makeCtx();
    const result = await runPostSubmitPipeline(ctx);

    // Result should have all task statuses
    expect(result).toHaveProperty("kvCache");
    expect(result).toHaveProperty("email");
    expect(result).toHaveProperty("conversions");
    expect(result).toHaveProperty("contact");
    expect(result).toHaveProperty("integrations");
  });

  it("individual task failure does not block others", async () => {
    // Make integrations throw
    mocks.dispatchIntegrations.mockRejectedValueOnce(new Error("integration kaboom"));

    const ctx = makeCtx();
    const result = await runPostSubmitPipeline(ctx);

    // Pipeline should still complete — kvCache should succeed
    expect(result.kvCache).toBe(true);
    // Pipeline completed despite integration failure
    expect(result).toHaveProperty("integrations");
  });

  it("result includes all task statuses even when some fail", async () => {
    // Make contact upsert throw
    mocks.upsertContact.mockRejectedValueOnce(new Error("db error"));

    const ctx = makeCtx();
    const result = await runPostSubmitPipeline(ctx);

    // contact should be false due to the error
    expect(result.contact).toBe(false);
    // other tasks should still run
    expect(result).toHaveProperty("kvCache");
    expect(result).toHaveProperty("email");
  });

  it("skips email when no RESEND_API_KEY", async () => {
    const ctx = makeCtx({ env: {} });
    const result = await runPostSubmitPipeline(ctx);

    expect(result.email).toBe(false);
  });

  it("enforces daily email send cap", async () => {
    const mockKv = {
      get: vi.fn(async () => "500"), // already at limit
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: "" })),
      getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
    } as unknown as PostSubmitContext["kv"];

    const ctx = makeCtx({ kv: mockKv });
    const result = await runPostSubmitPipeline(ctx);

    // Email should not be sent due to daily cap
    // (the fetch for email should NOT have been called with Resend URL)
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const resendCalls = fetchCalls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("resend.com"),
    );
    expect(resendCalls.length).toBe(0);
  });
});
