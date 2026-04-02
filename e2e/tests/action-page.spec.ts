import { test, expect } from "@playwright/test";

// Plugin routes follow the pattern: /api/plugins/{plugin-id}/{route-name}
// Based on the plugin id "crafted-action-pages" and route names from sandbox-entry.ts
const PLUGIN_BASE = "/api/plugins/crafted-action-pages";

test.describe("Action Page plugin routes", () => {
  test("embed script returns JavaScript", async ({ request }) => {
    const response = await request.get(
      `${PLUGIN_BASE}/embed?slug=test-page`
    );

    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("javascript");
  });

  test("stats endpoint returns JSON with variants", async ({ request }) => {
    const response = await request.get(
      `${PLUGIN_BASE}/stats?page_id=test-page`
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("variants");
  });

  test("submit endpoint rejects invalid data", async ({ request }) => {
    // POST with missing required fields
    const response = await request.post(`${PLUGIN_BASE}/submit`, {
      data: {},
    });

    // Should return 400 for missing/invalid fields
    expect(response.status()).toBe(400);
  });

  test("submit endpoint rejects without turnstile token", async ({
    request,
  }) => {
    // POST with valid-looking data but no turnstile token
    const response = await request.post(`${PLUGIN_BASE}/submit`, {
      data: {
        page_id: "test-page",
        type: "petition",
        data: {
          first_name: "Test",
          last_name: "User",
          email: "test@example.com",
          state: "CA",
          zip: "90210",
        },
        // No turnstile token
      },
    });

    // The server should reject the submission — either 400 or 403
    expect([400, 403]).toContain(response.status());
  });
});
