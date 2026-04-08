/**
 * Multi-tenancy auth + access control layer.
 *
 * Resolves Bearer tokens to either firm-level or campaign-level auth contexts.
 * Campaign tokens are cached in KV for fast lookup (1 KV read vs 1 D1 query).
 *
 * Backwards compatible: if no firms exist, resolveAuth falls back to
 * verifying against MCP_ADMIN_TOKEN and returns firm-level access.
 */

import { sha256Hex, verifyBearer } from "./auth.ts";

const PLUGIN_ID = "action-pages";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CampaignSharing {
  /** Can this campaign see contacts from other campaigns in the same firm? */
  cross_campaign_contacts: boolean;
  /** Can this campaign see attribution data from other campaigns? */
  cross_campaign_attribution: boolean;
  /** Can this campaign use the firm-level list builder? */
  list_builder_access: boolean;
  /** Tags from other campaigns visible to this campaign (empty = none) */
  visible_tags: string[];
}

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  firm_id: string;
  sharing: CampaignSharing;
  api_token_hash: string;
  created_at: string;
  status: "active" | "archived";
}

export interface Firm {
  id: string;
  slug: string;
  name: string;
  admin_token_hash: string;
  created_at: string;
}

export interface AuthContext {
  level: "firm" | "campaign";
  firmId: string;
  campaignId?: string;
  campaign?: Campaign;
}

/* ------------------------------------------------------------------ */
/*  D1 / KV type stubs                                                 */
/* ------------------------------------------------------------------ */

export interface TenancyD1 {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first(): Promise<Record<string, unknown> | null>;
      all(): Promise<{ results: Array<Record<string, unknown>> }>;
    };
  };
}

export interface TenancyKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** KV key for the cached firm token hash */
const FIRM_TOKEN_HASH_KEY = "firm-token-hash";

/** KV prefix for cached campaign token lookups */
const CAMPAIGN_TOKEN_PREFIX = "campaign-token:";

/** KV prefix for cached campaign config */
const CAMPAIGN_CONFIG_PREFIX = "campaign-config:";

/** TTL for campaign token cache: 1 hour */
const CAMPAIGN_TOKEN_TTL = 3600;

/** TTL for campaign config cache: 5 minutes */
const CAMPAIGN_CONFIG_TTL = 300;

/** Minimum token length (matches auth.ts MIN_TOKEN_LENGTH) */
const MIN_TOKEN_LENGTH = 32;

/* ------------------------------------------------------------------ */
/*  Core auth resolution                                               */
/* ------------------------------------------------------------------ */

/**
 * Resolve auth context from the request.
 *
 * Flow:
 * 1. Extract Bearer token from header
 * 2. Hash with SHA-256
 * 3. Check against firm token (KV cache, then D1 fallback)
 * 4. If no firm match, check campaign tokens (KV cache, then D1 fallback)
 * 5. Return null if no match (caller should return 401)
 *
 * Backwards compatibility: if no firms/campaigns exist in D1, falls back
 * to checking MCP_ADMIN_TOKEN via verifyBearer. This means existing
 * deployments work without any setup.
 */
export async function resolveAuth(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  authHeader: string | null,
  mcpAdminToken?: string,
): Promise<AuthContext | null> {
  if (!authHeader) return null;

  // Extract the raw token from "Bearer <token>"
  const token = extractBearerToken(authHeader);
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;

  const tokenHash = await sha256Hex(token);

  // --- 1. Check firm token (fast path via KV) ---
  const firmAuth = await checkFirmToken(db, kv, tokenHash);
  if (firmAuth) return firmAuth;

  // --- 2. Check campaign tokens (fast path via KV) ---
  const campaignAuth = await checkCampaignToken(db, kv, tokenHash);
  if (campaignAuth) return campaignAuth;

  // --- 3. Backwards compatibility fallback: check MCP_ADMIN_TOKEN ---
  // If no firms exist at all, the legacy MCP_ADMIN_TOKEN still works as
  // firm-level access. This keeps existing deployments functional.
  if (mcpAdminToken && await verifyBearer(authHeader, mcpAdminToken)) {
    const hasFirms = await firmRecordExists(db);
    if (!hasFirms) {
      return { level: "firm", firmId: "legacy" };
    }
  }

  return null;
}

/**
 * Simplified auth resolver for endpoints that should work in both
 * legacy (MCP_ADMIN_TOKEN only) and multi-tenant modes.
 *
 * Returns firm-level AuthContext for MCP_ADMIN_TOKEN holders,
 * campaign-level for campaign token holders, or null for 401.
 */
export async function resolveAuthCompat(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  authHeader: string | null,
  mcpAdminToken?: string,
): Promise<AuthContext | null> {
  // First try legacy MCP_ADMIN_TOKEN (always grants firm-level)
  if (mcpAdminToken && await verifyBearer(authHeader, mcpAdminToken)) {
    // If a firm record exists, resolve the actual firm ID
    const firm = await getFirstFirm(db);
    return { level: "firm", firmId: firm?.id ?? "legacy" };
  }

  // Then try multi-tenant auth
  if (!authHeader) return null;
  const token = extractBearerToken(authHeader);
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;

  const tokenHash = await sha256Hex(token);

  const firmAuth = await checkFirmToken(db, kv, tokenHash);
  if (firmAuth) return firmAuth;

  const campaignAuth = await checkCampaignToken(db, kv, tokenHash);
  if (campaignAuth) return campaignAuth;

  return null;
}

/* ------------------------------------------------------------------ */
/*  Access control helpers                                             */
/* ------------------------------------------------------------------ */

/**
 * Check if the current auth context can access a resource owned by
 * a specific campaign. Firm-level can access everything. Campaign-level
 * can only access their own campaign's resources.
 */
export function canAccess(auth: AuthContext, resourceCampaignId: string): boolean {
  if (auth.level === "firm") return true;
  return auth.campaignId === resourceCampaignId;
}

/**
 * Get the list of campaign IDs visible to the current auth context.
 *
 * - Firm-level: returns all active campaign IDs
 * - Campaign-level: returns only their own campaign ID
 *   (plus cross-campaign if sharing.cross_campaign_contacts is true)
 */
export async function getVisibleCampaigns(
  db: TenancyD1,
  auth: AuthContext,
): Promise<string[]> {
  if (auth.level === "firm") {
    return getAllCampaignIds(db, auth.firmId);
  }

  if (!auth.campaignId) return [];

  const ids = [auth.campaignId];

  // If this campaign has cross-campaign contact access, include siblings
  if (auth.campaign?.sharing?.cross_campaign_contacts) {
    const allIds = await getAllCampaignIds(db, auth.campaign.firm_id);
    return allIds;
  }

  return ids;
}

/**
 * Get the page slugs that belong to a specific set of campaigns.
 * Used to scope queries by campaign ownership.
 */
export async function getPageSlugsForCampaigns(
  db: TenancyD1,
  campaignIds: string[],
): Promise<string[]> {
  if (campaignIds.length === 0) return [];

  // Query action pages that belong to these campaigns (capped at 5000 pages)
  const rows = await db
    .prepare(
      `SELECT data FROM _plugin_storage
       WHERE plugin_id = ? AND collection = 'action_pages' LIMIT 5000`,
    )
    .bind(PLUGIN_ID)
    .all();

  const slugs: string[] = [];
  const campaignSet = new Set(campaignIds);

  for (const row of rows.results) {
    try {
      const page = JSON.parse(row.data as string) as { slug?: string; campaign_id?: string };
      if (page.slug && page.campaign_id && campaignSet.has(page.campaign_id)) {
        slugs.push(page.slug);
      }
    } catch {
      // Skip malformed
    }
  }

  return slugs;
}

/**
 * Get the campaign_id for a specific page slug.
 * Returns undefined if the page has no campaign or doesn't exist.
 */
export async function getCampaignForPage(
  db: TenancyD1,
  pageSlug: string,
): Promise<string | undefined> {
  const row = await db
    .prepare(
      `SELECT data FROM _plugin_storage
       WHERE plugin_id = ? AND collection = 'action_pages'
       AND json_extract(data, '$.slug') = ? LIMIT 1`,
    )
    .bind(PLUGIN_ID, pageSlug)
    .first();

  if (!row) return undefined;
  try {
    const page = JSON.parse(row.data as string) as { campaign_id?: string };
    return page.campaign_id;
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/*  Campaign CRUD helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Generate a cryptographically secure API token (32 bytes, hex-encoded = 64 chars).
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a new campaign. Returns the campaign record and the plain-text token.
 * The token is only available at creation time — after this, only the hash is stored.
 */
export async function createCampaign(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  input: { name: string; slug: string; firmId: string },
): Promise<{ campaign: Campaign; token: string }> {
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const campaign: Campaign = {
    id,
    slug: input.slug,
    name: input.name,
    firm_id: input.firmId,
    sharing: {
      cross_campaign_contacts: false,
      cross_campaign_attribution: false,
      list_builder_access: false,
      visible_tags: [],
    },
    api_token_hash: tokenHash,
    created_at: now,
    status: "active",
  };

  await db
    .prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, PLUGIN_ID, "campaigns", JSON.stringify(campaign), now, now)
    .run();

  // Cache the token lookup in KV
  if (kv) {
    await kv.put(
      `${CAMPAIGN_TOKEN_PREFIX}${tokenHash}`,
      JSON.stringify({ campaignId: id, firmId: input.firmId }),
      { expirationTtl: CAMPAIGN_TOKEN_TTL },
    );
    await kv.put(
      `${CAMPAIGN_CONFIG_PREFIX}${id}`,
      JSON.stringify(campaign),
      { expirationTtl: CAMPAIGN_CONFIG_TTL },
    );
  }

  return { campaign, token };
}

/**
 * Update a campaign record. Invalidates KV caches.
 */
export async function updateCampaign(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  campaignId: string,
  updates: Partial<Pick<Campaign, "name" | "sharing" | "status">>,
): Promise<Campaign | null> {
  const row = await db
    .prepare(
      "SELECT id, data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = 'campaigns' LIMIT 1",
    )
    .bind(campaignId, PLUGIN_ID)
    .first();

  if (!row) return null;

  let campaign: Campaign;
  try {
    campaign = JSON.parse(row.data as string) as Campaign;
  } catch {
    return null;
  }

  if (updates.name !== undefined) campaign.name = updates.name;
  if (updates.status !== undefined) campaign.status = updates.status;
  if (updates.sharing !== undefined) campaign.sharing = updates.sharing;

  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE _plugin_storage SET data = ?, updated_at = ? WHERE id = ? AND plugin_id = ? AND collection = 'campaigns'",
    )
    .bind(JSON.stringify(campaign), now, campaignId, PLUGIN_ID)
    .run();

  // Invalidate KV caches
  if (kv) {
    await kv.put(
      `${CAMPAIGN_CONFIG_PREFIX}${campaignId}`,
      JSON.stringify(campaign),
      { expirationTtl: CAMPAIGN_CONFIG_TTL },
    );
    // Note: we can't easily invalidate the token cache since we'd need the hash.
    // It will expire naturally within 1 hour (CAMPAIGN_TOKEN_TTL).
  }

  return campaign;
}

/**
 * List all campaigns for a firm.
 */
export async function listCampaigns(
  db: TenancyD1,
  firmId: string,
): Promise<Campaign[]> {
  const rows = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'campaigns' ORDER BY created_at DESC",
    )
    .bind(PLUGIN_ID)
    .all();

  const campaigns: Campaign[] = [];
  for (const row of rows.results) {
    try {
      const c = JSON.parse(row.data as string) as Campaign;
      if (c.firm_id === firmId || firmId === "legacy") {
        campaigns.push(c);
      }
    } catch {
      // Skip malformed
    }
  }
  return campaigns;
}

/**
 * Get a single campaign by ID.
 */
export async function getCampaign(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  campaignId: string,
): Promise<Campaign | null> {
  // Try KV cache first
  if (kv) {
    const cached = await kv.get(`${CAMPAIGN_CONFIG_PREFIX}${campaignId}`);
    if (cached) {
      try {
        return JSON.parse(cached) as Campaign;
      } catch {
        // Fall through to D1
      }
    }
  }

  const row = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE id = ? AND plugin_id = ? AND collection = 'campaigns' LIMIT 1",
    )
    .bind(campaignId, PLUGIN_ID)
    .first();

  if (!row) return null;
  try {
    const campaign = JSON.parse(row.data as string) as Campaign;
    if (kv) {
      await kv.put(
        `${CAMPAIGN_CONFIG_PREFIX}${campaignId}`,
        JSON.stringify(campaign),
        { expirationTtl: CAMPAIGN_CONFIG_TTL },
      );
    }
    return campaign;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Firm CRUD helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Create a firm record. Caches the admin_token_hash in KV.
 */
export async function createFirm(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  input: { name: string; slug: string; adminToken: string },
): Promise<Firm> {
  const tokenHash = await sha256Hex(input.adminToken);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const firm: Firm = {
    id,
    slug: input.slug,
    name: input.name,
    admin_token_hash: tokenHash,
    created_at: now,
  };

  await db
    .prepare(
      "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, PLUGIN_ID, "firms", JSON.stringify(firm), now, now)
    .run();

  // Cache firm token hash in KV
  if (kv) {
    await kv.put(FIRM_TOKEN_HASH_KEY, JSON.stringify({ firmId: id, hash: tokenHash }));
  }

  return firm;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function extractBearerToken(header: string): string | null {
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

async function checkFirmToken(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  tokenHash: string,
): Promise<AuthContext | null> {
  // Try KV cache first
  if (kv) {
    const cached = await kv.get(FIRM_TOKEN_HASH_KEY);
    if (cached) {
      try {
        const { firmId, hash } = JSON.parse(cached) as { firmId: string; hash: string };
        if (hash === tokenHash) {
          return { level: "firm", firmId };
        }
      } catch {
        // Fall through to D1
      }
    }
  }

  // Query D1 for firm records
  const rows = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'firms' LIMIT 10",
    )
    .bind(PLUGIN_ID)
    .all();

  for (const row of rows.results) {
    try {
      const firm = JSON.parse(row.data as string) as Firm;
      if (firm.admin_token_hash === tokenHash) {
        // Cache for next time
        if (kv) {
          await kv.put(FIRM_TOKEN_HASH_KEY, JSON.stringify({ firmId: firm.id, hash: tokenHash }));
        }
        return { level: "firm", firmId: firm.id };
      }
    } catch {
      // Skip malformed
    }
  }

  return null;
}

async function checkCampaignToken(
  db: TenancyD1,
  kv: TenancyKV | undefined,
  tokenHash: string,
): Promise<AuthContext | null> {
  // Try KV cache first
  if (kv) {
    const cached = await kv.get(`${CAMPAIGN_TOKEN_PREFIX}${tokenHash}`);
    if (cached) {
      try {
        const { campaignId, firmId } = JSON.parse(cached) as { campaignId: string; firmId: string };
        const campaign = await getCampaign(db, kv, campaignId);
        if (campaign && campaign.status === "active") {
          return { level: "campaign", firmId, campaignId, campaign };
        }
      } catch {
        // Fall through to D1
      }
    }
  }

  // Query D1 for campaign records (bounded to prevent unbounded scans)
  const rows = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'campaigns' LIMIT 500",
    )
    .bind(PLUGIN_ID)
    .all();

  for (const row of rows.results) {
    try {
      const campaign = JSON.parse(row.data as string) as Campaign;
      if (campaign.api_token_hash === tokenHash && campaign.status === "active") {
        // Cache for next time
        if (kv) {
          await kv.put(
            `${CAMPAIGN_TOKEN_PREFIX}${tokenHash}`,
            JSON.stringify({ campaignId: campaign.id, firmId: campaign.firm_id }),
            { expirationTtl: CAMPAIGN_TOKEN_TTL },
          );
        }
        return { level: "campaign", firmId: campaign.firm_id, campaignId: campaign.id, campaign };
      }
    } catch {
      // Skip malformed
    }
  }

  return null;
}

async function firmRecordExists(db: TenancyD1): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) as cnt FROM _plugin_storage WHERE plugin_id = ? AND collection = 'firms'",
    )
    .bind(PLUGIN_ID)
    .first();
  return ((row?.cnt as number) ?? 0) > 0;
}

async function getFirstFirm(db: TenancyD1): Promise<Firm | null> {
  const row = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'firms' LIMIT 1",
    )
    .bind(PLUGIN_ID)
    .first();
  if (!row) return null;
  try {
    return JSON.parse(row.data as string) as Firm;
  } catch {
    return null;
  }
}

/** Returns all active campaign IDs for a firm. Capped at 1000 campaigns. */
async function getAllCampaignIds(db: TenancyD1, firmId: string): Promise<string[]> {
  const rows = await db
    .prepare(
      "SELECT data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'campaigns' LIMIT 1000",
    )
    .bind(PLUGIN_ID)
    .all();

  const ids: string[] = [];
  for (const row of rows.results) {
    try {
      const c = JSON.parse(row.data as string) as Campaign;
      if ((c.firm_id === firmId || firmId === "legacy") && c.status === "active") {
        ids.push(c.id);
      }
    } catch {
      // Skip
    }
  }
  return ids;
}
