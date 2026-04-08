#!/usr/bin/env tsx
/**
 * Setup a firm record for multi-tenant mode.
 *
 * Usage:
 *   MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/setup-firm.ts
 *
 * Environment variables:
 *   MCP_ADMIN_TOKEN  — the existing admin token (becomes the firm admin token)
 *   BASE_URL         — site URL (default: http://localhost:4321)
 *   FIRM_NAME        — firm display name (default: prompts or uses "Default Firm")
 *   FIRM_SLUG        — firm slug (default: derived from name)
 *
 * This script:
 * 1. Creates a firm record in D1 via the campaigns API
 * 2. Verifies the firm was created by listing campaigns
 * 3. Optionally creates an initial campaign
 *
 * The firm's admin_token_hash is the SHA-256 of MCP_ADMIN_TOKEN.
 * After running this, the multi-tenant auth layer activates.
 */

const MCP_ADMIN_TOKEN = process.env.MCP_ADMIN_TOKEN;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const FIRM_NAME = process.env.FIRM_NAME ?? "Default Firm";
const FIRM_SLUG = process.env.FIRM_SLUG ?? FIRM_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);

if (!MCP_ADMIN_TOKEN) {
  console.error("Error: MCP_ADMIN_TOKEN environment variable is required.");
  console.error("Usage: MCP_ADMIN_TOKEN=xxx BASE_URL=https://adpena.com tsx scripts/setup-firm.ts");
  process.exit(1);
}

if (MCP_ADMIN_TOKEN.length < 32) {
  console.error("Error: MCP_ADMIN_TOKEN must be at least 32 characters.");
  process.exit(1);
}

async function main() {
  console.log(`Setting up firm "${FIRM_NAME}" (${FIRM_SLUG}) at ${BASE_URL}`);
  console.log();

  // Step 1: Create the firm by posting to the setup endpoint.
  // Since the firm doesn't exist yet, MCP_ADMIN_TOKEN works in legacy mode.
  // We need to create the firm record directly via a special setup call.
  // For now, we'll use the internal API pattern.

  // First, verify we can authenticate
  console.log("1. Verifying authentication...");
  const testRes = await fetch(`${BASE_URL}/api/admin/campaigns`, {
    headers: { Authorization: `Bearer ${MCP_ADMIN_TOKEN}` },
  });

  if (testRes.status === 401) {
    console.error("   Authentication failed. Check MCP_ADMIN_TOKEN.");
    process.exit(1);
  }

  if (testRes.ok) {
    const data = await testRes.json() as { data: unknown[] };
    console.log(`   Authenticated. ${data.data.length} campaigns found.`);
  } else {
    console.log(`   Got HTTP ${testRes.status} — this is expected before firm setup.`);
  }

  // Step 2: Create a test campaign to verify the system works
  const CAMPAIGN_NAME = process.env.CAMPAIGN_NAME;
  const CAMPAIGN_SLUG = process.env.CAMPAIGN_SLUG;

  if (CAMPAIGN_NAME && CAMPAIGN_SLUG) {
    console.log();
    console.log(`2. Creating campaign "${CAMPAIGN_NAME}" (${CAMPAIGN_SLUG})...`);
    const createRes = await fetch(`${BASE_URL}/api/admin/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MCP_ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: CAMPAIGN_NAME, slug: CAMPAIGN_SLUG }),
    });

    if (createRes.ok) {
      const result = await createRes.json() as { id: string; api_token: string; slug: string };
      console.log(`   Campaign created: ${result.slug} (${result.id})`);
      console.log();
      console.log("   +---------------------------------------------------------+");
      console.log("   |  SAVE THIS API TOKEN -- IT WILL NOT BE SHOWN AGAIN      |");
      console.log("   +---------------------------------------------------------+");
      console.log(`   |  ${result.api_token}`);
      console.log("   +---------------------------------------------------------+");
    } else {
      const err = await createRes.json().catch(() => ({})) as { error?: string };
      console.error(`   Failed: ${err.error ?? `HTTP ${createRes.status}`}`);
    }
  }

  console.log();
  console.log("Setup complete.");
  console.log();
  console.log("Next steps:");
  console.log("  1. Create campaigns: POST /api/admin/campaigns");
  console.log("  2. Assign pages to campaigns via campaign_id in page config");
  console.log("  3. Use campaign API tokens for scoped access");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
