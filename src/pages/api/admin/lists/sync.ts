/**
 * Sync a saved list's contacts to a campaign platform.
 *
 * POST /api/admin/lists/sync?id=<list_id>
 * Authorization: Bearer <MCP_ADMIN_TOKEN>
 * Content-Type: application/json
 *
 * Body: { "platform": "mailchimp", "tag": "tx-petition-no-donation" }
 *
 * Re-runs the saved list query, caps at 500 contacts, then dispatches
 * each contact to the specified platform adapter with the given tag.
 *
 * No PII is logged. All queries are parameterized.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyBearer } from "../../../../lib/auth.ts";
import type { ContactsD1 } from "../../../../lib/contacts.ts";
import { logAudit, type AuditD1 } from "../../../../lib/audit.ts";
import { runContactSearch, type SearchFilters } from "../../../../lib/contact-search.ts";
import {
  dispatchIntegrations,
  type IntegrationEnv,
} from "../../../../lib/integrations/index.ts";

const PLUGIN_ID = "action-pages";
const LIST_COLLECTION = "saved_lists";
const MAX_SYNC_CONTACTS = 500;
const SYNC_BATCH = 50;

interface SavedList {
  name: string;
  filters: SearchFilters;
  created_at: string;
  updated_at: string;
}

interface SyncBody {
  platform?: string;
  tag?: string;
}

export const POST: APIRoute = async ({ request }) => {
  const token = (env as Record<string, unknown>).MCP_ADMIN_TOKEN as string | undefined;
  if (!(await verifyBearer(request.headers.get("Authorization"), token))) {
    return json(401, { error: "Unauthorized" });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { error: "Content-Type must be application/json" });
  }

  const url = new URL(request.url);
  const listId = url.searchParams.get("id");
  if (!listId) {
    return json(400, { error: "id query parameter is required" });
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const platform = (body.platform ?? "").trim().toLowerCase();
  if (!platform) {
    return json(400, { error: "platform is required" });
  }

  const tag = (body.tag ?? "").trim().slice(0, 100);

  const db = (env as Record<string, unknown>).DB as ContactsD1 | undefined;
  if (!db) {
    return json(503, { error: "Storage not available" });
  }

  // Load saved list
  const row = await db
    .prepare("SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = ? LIMIT 1")
    .bind(listId, PLUGIN_ID, LIST_COLLECTION)
    .first();

  if (!row) {
    return json(404, { error: "List not found" });
  }

  let saved: SavedList;
  try {
    saved = JSON.parse(row.data as string) as SavedList;
  } catch {
    return json(500, { error: "Corrupted list data" });
  }

  // Re-run the query
  const { data: contacts, total } = await runContactSearch(db, saved.filters, MAX_SYNC_CONTACTS, 0);

  if (contacts.length === 0) {
    return json(200, { synced: 0, failed: 0, platform, total_matching: total });
  }

  // Build integration env
  const e = env as Record<string, unknown>;
  const integrationEnv: IntegrationEnv = {
    ACTION_NETWORK_API_KEY: e.ACTION_NETWORK_API_KEY as string | undefined,
    MAILCHIMP_API_KEY: e.MAILCHIMP_API_KEY as string | undefined,
    MAILCHIMP_LIST_ID: e.MAILCHIMP_LIST_ID as string | undefined,
    MAILCHIMP_DC: e.MAILCHIMP_DC as string | undefined,
    NATIONBUILDER_NATION_SLUG: e.NATIONBUILDER_NATION_SLUG as string | undefined,
    NATIONBUILDER_API_TOKEN: e.NATIONBUILDER_API_TOKEN as string | undefined,
    EVERYACTION_API_KEY: e.EVERYACTION_API_KEY as string | undefined,
    EVERYACTION_APP_NAME: e.EVERYACTION_APP_NAME as string | undefined,
    MOBILIZE_API_TOKEN: e.MOBILIZE_API_TOKEN as string | undefined,
    MOBILIZE_ORGANIZATION_ID: e.MOBILIZE_ORGANIZATION_ID as string | undefined,
    MOBILIZE_EVENT_ID: e.MOBILIZE_EVENT_ID as string | undefined,
    MOBILIZE_TIMESLOT_ID: e.MOBILIZE_TIMESLOT_ID as string | undefined,
    MOBILIZE_ACTIVIST_CODE: e.MOBILIZE_ACTIVIST_CODE as string | undefined,
    EVENTBRITE_API_TOKEN: e.EVENTBRITE_API_TOKEN as string | undefined,
    EVENTBRITE_ORGANIZATION_ID: e.EVENTBRITE_ORGANIZATION_ID as string | undefined,
    FACEBOOK_ACCESS_TOKEN: e.FACEBOOK_ACCESS_TOKEN as string | undefined,
    SENDGRID_API_KEY: e.SENDGRID_API_KEY as string | undefined,
    SENDGRID_LIST_ID: e.SENDGRID_LIST_ID as string | undefined,
    CONSTANT_CONTACT_API_KEY: e.CONSTANT_CONTACT_API_KEY as string | undefined,
    CONSTANT_CONTACT_LIST_ID: e.CONSTANT_CONTACT_LIST_ID as string | undefined,
  };

  let synced = 0;
  let failed = 0;

  // Dispatch in batches to avoid overwhelming external APIs
  for (let i = 0; i < contacts.length; i += SYNC_BATCH) {
    const batch = contacts.slice(i, i + SYNC_BATCH);
    const results = await Promise.allSettled(
      batch.map((contact) =>
        dispatchIntegrations({
          submission: {
            type: "signup",
            slug: tag || "list-sync",
            email: contact.email,
            firstName: contact.first_name,
            lastName: contact.last_name,
            postalCode: contact.zip,
          },
          env: integrationEnv,
        }),
      ),
    );

    for (const r of results) {
      if (r.status === "fulfilled") synced++;
      else failed++;
    }
  }

  await logAudit(db as AuditD1, {
    action: "list_sync",
    target: `list:${listId}`,
    actor: "admin",
    metadata: {
      platform,
      tag: tag || undefined,
      synced,
      failed,
      total_matching: total,
    },
    request,
  }).catch(() => {});

  console.info(`[lists/sync] list=${listId} platform=${platform} synced=${synced} failed=${failed}`);

  return json(200, {
    synced,
    failed,
    platform,
    ...(total > MAX_SYNC_CONTACTS ? { capped_at: MAX_SYNC_CONTACTS, total_matching: total } : {}),
  });
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-cache" },
  });
}
