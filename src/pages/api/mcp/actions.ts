/**
 * MCP-compatible HTTP endpoint for Campaign Action Pages.
 *
 * Exposes tools for AI agents to create, query, and manage action pages
 * and their submissions via HTTP.
 *
 * GET  /api/mcp/actions  → list available tools
 * POST /api/mcp/actions  → call a tool ({ tool, params })
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseRpcRequest, rpcResult, rpcError, RPC_PARSE_ERROR, RPC_INVALID_REQUEST, RPC_METHOD_NOT_FOUND, RPC_INVALID_PARAMS } from "../../../lib/jsonrpc.ts";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PLUGIN_ID = "crafted-action-pages";
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const VALID_ACTIONS = new Set(["fundraise", "petition", "gotv", "signup"]);

/**
 * Sanitize a user-provided string before storage. Strips HTML tags
 * and dangerous characters. Used for committee name, treasurer name,
 * and other display strings that come from untrusted input.
 */
function sanitize(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate that a URL is HTTPS. Throws on invalid input.
 * Used for media URLs, ActBlue URLs, video sources.
 */
function requireHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} is required`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  return parsed.href;
}

/**
 * Authenticate the request via Bearer token.
 * Token is read from MCP_ADMIN_TOKEN env var.
 * Returns true if authenticated, false otherwise.
 */
function isAuthenticated(request: Request): boolean {
  const token = (env as any).MCP_ADMIN_TOKEN as string | undefined;
  if (!token) {
    // No token configured — fail closed in production, log warning
    console.warn("[mcp/actions] MCP_ADMIN_TOKEN not configured — denying all writes");
    return false;
  }
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  // Constant-time comparison to prevent timing attacks
  if (provided.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Tools that read data — no auth required */
const READ_ONLY_TOOLS = new Set([
  "list_pages",
  "get_page",
  "list_templates",
  "list_actions",
  "list_themes",
  "generate_theme",
]);

/** Tools that write or read sensitive data — auth required */
const WRITE_TOOLS = new Set(["create_page", "get_submissions"]);

const TEMPLATES = [
  { name: "hero-simple", props: ["headline", "subhead", "align"] },
  { name: "hero-media", props: ["headline", "media_url", "overlay_opacity"] },
  { name: "hero-story", props: ["headline", "body", "pull_quote"] },
  {
    name: "hero-layered",
    props: [
      "headline",
      "subhead",
      "background_type",
      "background_color",
      "background_gradient",
      "background_image",
      "background_video",
      "background_position",
      "splash_image",
      "splash_alt",
      "splash_position",
      "splash_align",
      "splash_size",
      "overlay",
      "overlay_opacity",
      "content_position",
      "content_color",
      "height",
    ],
  },
  {
    name: "hero-split",
    props: [
      "headline",
      "subhead",
      "body",
      "media_type",
      "media_url",
      "media_alt",
      "media_side",
      "background_color",
      "ratio",
    ],
  },
];

const VALID_TEMPLATES = new Set(TEMPLATES.map((t) => t.name));

const ACTIONS = [
  { name: "fundraise", description: "Amount buttons + ActBlue redirect" },
  { name: "petition", description: "Name, email, zip, optional comment" },
  { name: "gotv", description: "Name, zip, pledge checkbox" },
  { name: "signup", description: "Email + optional name, list capture" },
];

const THEMES: Record<string, Record<string, string>> = {
  warm: {
    "--page-bg": "#f5f5f0", "--page-text": "#1a1a1a", "--page-accent": "#1a1a1a",
    "--page-secondary": "#6b6b6b", "--page-border": "#d4d4c8", "--page-radius": "0px",
    "--page-font-serif": "Georgia, 'Times New Roman', serif",
    "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
  },
  bold: {
    "--page-bg": "#0a0a0a", "--page-text": "#ffffff", "--page-accent": "#ef4444",
    "--page-secondary": "#a1a1a1", "--page-border": "#2a2a2a", "--page-radius": "8px",
    "--page-font-serif": "Inter, system-ui, sans-serif",
    "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
  },
  clean: {
    "--page-bg": "#ffffff", "--page-text": "#1a1a1a", "--page-accent": "#2563eb",
    "--page-secondary": "#6b7280", "--page-border": "#e5e5e5", "--page-radius": "4px",
    "--page-font-serif": "system-ui, -apple-system, sans-serif",
    "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
  },
};

/* ------------------------------------------------------------------ */
/*  Tool list (GET)                                                    */
/* ------------------------------------------------------------------ */

const TOOLS = [
  { name: "create_page", description: "Create a new action page", params: { slug: "string", template: "string", action: "string", template_props: "object", action_props: "object", "disclaimer": "object", "theme?": "string | object", "followup?": "string", "followup_props?": "object", "followup_message?": "string", "campaign_id?": "string", "variants?": "string[]", "callbacks?": "object[]" } },
  { name: "list_pages", description: "List all action pages" },
  { name: "get_page", description: "Get an action page by slug", params: { slug: "string" } },
  { name: "get_submissions", description: "Get submissions for a page", params: { page_id: "string", "limit?": "number", "offset?": "number" } },
  { name: "generate_theme", description: "Generate a theme from a natural language description", params: { prompt: "string" } },
  { name: "list_templates", description: "List available templates" },
  { name: "list_actions", description: "List available action types" },
  { name: "list_themes", description: "List available themes" },
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    name: "action-pages",
    description: "Campaign action page management — create pages, query submissions, generate themes",
    tools: TOOLS,
    transport: "http",
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// These helpers are redefined inside POST to capture the request `id`.
// Declared here as types only so the switch block can reference them.
type JsonFn = (data: unknown, status?: number) => Response;
type ErrFn = (code: string, message: string, status?: number) => Response;

function getDb() {
  return env.DB;
}

/* ------------------------------------------------------------------ */
/*  Theme generator (deterministic, no AI call)                        */
/* ------------------------------------------------------------------ */

const COLOR_MAP: Record<string, string> = {
  red: "#dc2626", blue: "#2563eb", green: "#16a34a", purple: "#9333ea",
  orange: "#ea580c", pink: "#ec4899", yellow: "#eab308", teal: "#0d9488",
  navy: "#1e3a5f", gold: "#b8860b", black: "#0a0a0a", white: "#ffffff",
  crimson: "#dc143c", indigo: "#4f46e5", emerald: "#059669", slate: "#475569",
};

function generateTheme(prompt: string): Record<string, string> {
  const p = prompt.toLowerCase();

  // Start from warm base
  const theme = { ...THEMES.warm };

  // Detect base style
  if (p.includes("dark") || p.includes("night") || p.includes("bold")) {
    Object.assign(theme, THEMES.bold);
  } else if (p.includes("clean") || p.includes("modern") || p.includes("minimal")) {
    Object.assign(theme, THEMES.clean);
  }

  // Override accent with detected color
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (p.includes(name)) {
      theme["--page-accent"] = hex;
      break;
    }
  }

  // Rounded corners
  if (p.includes("round") || p.includes("soft") || p.includes("friendly")) {
    theme["--page-radius"] = "12px";
  } else if (p.includes("sharp") || p.includes("angular") || p.includes("brutalist")) {
    theme["--page-radius"] = "0px";
  }

  // Font style
  if (p.includes("serif") || p.includes("classic") || p.includes("traditional")) {
    theme["--page-font-serif"] = "Georgia, 'Times New Roman', serif";
  } else if (p.includes("sans") || p.includes("modern") || p.includes("tech")) {
    theme["--page-font-serif"] = "Inter, system-ui, sans-serif";
  }

  return theme;
}

/* ------------------------------------------------------------------ */
/*  Tool dispatch (POST)                                               */
/* ------------------------------------------------------------------ */

export const POST: APIRoute = async ({ request }) => {
  // Accepts both JSON-RPC 2.0 and legacy { tool, params } formats
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, RPC_PARSE_ERROR, "Request body must be valid JSON.", 400);
  }

  const req = parseRpcRequest(body);
  if (!req) {
    return rpcError(null, RPC_INVALID_REQUEST, "Expected JSON-RPC 2.0 { jsonrpc, method, params, id } or legacy { tool, params }", 400);
  }

  const { method: tool, params, id } = req;

  // Closure-scoped helpers that include the request id in responses
  const json: JsonFn = (data, _status = 200) => rpcResult(id, data);
  const err: ErrFn = (_code, message, status = 400) =>
    rpcError(id, status === 401 ? -32001 : status === 404 ? -32004 : RPC_INVALID_PARAMS, message, status);

  // Auth gate: write/read-sensitive tools require Bearer token
  if (WRITE_TOOLS.has(tool) && !isAuthenticated(request)) {
    return rpcError(id, -32001, "This tool requires authentication. Set MCP_ADMIN_TOKEN and provide Authorization: Bearer <token>.", 401);
  }

  switch (tool) {
    /* -------------------------------------------------------------- */
    case "create_page": {
      const p = params;
      const slug = p.slug as string | undefined;
      if (!slug || typeof slug !== "string" || !SLUG_RE.test(slug)) {
        return err("INVALID_SLUG", "slug must match /^[a-z0-9][a-z0-9-]*$/");
      }
      if (!p.template || typeof p.template !== "string") {
        return err("MISSING_FIELD", "template is required (string)");
      }
      if (!VALID_TEMPLATES.has(p.template)) {
        return err(
          "INVALID_TEMPLATE",
          `template must be one of: ${[...VALID_TEMPLATES].join(", ")}`,
        );
      }
      if (!p.action || typeof p.action !== "string") {
        return err("MISSING_FIELD", "action is required (string)");
      }
      if (!VALID_ACTIONS.has(p.action)) {
        return err(
          "INVALID_ACTION",
          `action must be one of: ${[...VALID_ACTIONS].join(", ")}`,
        );
      }
      if (!p.disclaimer || typeof p.disclaimer !== "object") {
        return err("MISSING_FIELD", "disclaimer is required (object with committee_name)");
      }

      // Sanitize disclaimer fields (user-provided strings)
      const disclaimer = p.disclaimer as Record<string, unknown>;
      const sanitizedDisclaimer: Record<string, string> = {
        committee_name: sanitize(disclaimer.committee_name, 200),
      };
      if (disclaimer.treasurer_name) sanitizedDisclaimer.treasurer_name = sanitize(disclaimer.treasurer_name, 200);
      if (disclaimer.candidate_name) sanitizedDisclaimer.candidate_name = sanitize(disclaimer.candidate_name, 200);
      if (disclaimer.office) sanitizedDisclaimer.office = sanitize(disclaimer.office, 200);

      if (!sanitizedDisclaimer.committee_name) {
        return err("MISSING_FIELD", "disclaimer.committee_name is required (FEC compliance)");
      }

      // Validate URLs in template_props (user-provided, may be malicious)
      const templateProps = (p.template_props ?? {}) as Record<string, unknown>;
      const urlFields = ["media_url", "background_image", "background_video", "splash_image"];
      for (const field of urlFields) {
        if (templateProps[field]) {
          try {
            templateProps[field] = requireHttpsUrl(templateProps[field], `template_props.${field}`);
          } catch (e) {
            return err("INVALID_URL", e instanceof Error ? e.message : "URL validation failed");
          }
        }
      }

      // Validate ActBlue URL in action_props if action is fundraise
      const actionProps = (p.action_props ?? {}) as Record<string, unknown>;
      if (p.action === "fundraise" && actionProps.actblue_url) {
        try {
          const url = requireHttpsUrl(actionProps.actblue_url, "action_props.actblue_url");
          const parsed = new URL(url);
          if (!parsed.hostname.endsWith("actblue.com")) {
            return err("INVALID_URL", "actblue_url must be on actblue.com");
          }
          actionProps.actblue_url = url;
        } catch (e) {
          return err("INVALID_URL", e instanceof Error ? e.message : "URL validation failed");
        }
      }

      const pageData = {
        slug,
        campaign_id: p.campaign_id ?? null,
        template: p.template,
        template_props: templateProps,
        action: p.action,
        action_props: actionProps,
        followup: p.followup ?? null,
        followup_props: p.followup_props ?? null,
        followup_message: p.followup_message ? sanitize(p.followup_message, 500) : null,
        disclaimer: sanitizedDisclaimer,
        theme: p.theme ?? "warm",
        variants: p.variants ?? [],
        callbacks: p.callbacks ?? [],
        status: "active",
        created_at: new Date().toISOString(),
      };

      const db = getDb();
      const id = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO _plugin_storage (id, plugin_id, collection, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        id, PLUGIN_ID, "action_pages",
        JSON.stringify(pageData),
        pageData.created_at, pageData.created_at,
      ).run();

      return json({ data: { ok: true, page_id: id, url: `/action/${slug}` } });
    }

    /* -------------------------------------------------------------- */
    case "list_pages": {
      const db = getDb();
      const { results } = await db.prepare(
        "SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = 'action_pages' ORDER BY created_at DESC"
      ).bind(PLUGIN_ID).all();

      const pages = (results ?? []).map((row: any) => {
        const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        return { id: row.id, slug: d.slug, title: d.template_props?.headline ?? d.title ?? d.slug, action: d.action, template: d.template, created_at: d.created_at ?? row.created_at };
      });
      return json({ data: pages });
    }

    /* -------------------------------------------------------------- */
    case "get_page": {
      const slug = params.slug as string | undefined;
      if (!slug || typeof slug !== "string") {
        return err("MISSING_FIELD", "slug is required (string)");
      }

      const db = getDb();
      const row = await db.prepare(
        "SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = 'action_pages' AND json_extract(data, '$.slug') = ?"
      ).bind(PLUGIN_ID, slug).first() as any;

      if (!row) return err("NOT_FOUND", `No action page with slug '${String(slug).slice(0, 64)}'`, 404);

      const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

      // Strip sensitive fields from public responses — callbacks may contain
      // webhook URLs and HMAC secrets. Authenticated callers get full data.
      if (!isAuthenticated(request)) {
        delete d.callbacks;
      }

      return json({ data: { id: row.id, ...d } });
    }

    /* -------------------------------------------------------------- */
    case "get_submissions": {
      const pageId = params.page_id as string | undefined;
      if (!pageId || typeof pageId !== "string") {
        return err("MISSING_FIELD", "page_id is required (string)");
      }
      const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 500);
      const offset = Math.max(Number(params.offset) || 0, 0);

      const db = getDb();
      const { results } = await db.prepare(
        "SELECT id, data, created_at FROM _plugin_storage WHERE plugin_id = ? AND collection = 'submissions' AND json_extract(data, '$.page_id') = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).bind(PLUGIN_ID, pageId, limit, offset).all();

      const submissions = (results ?? []).map((row: any) => {
        const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
        return { id: row.id, ...d, created_at: d.created_at ?? row.created_at };
      });
      return json({ data: submissions });
    }

    /* -------------------------------------------------------------- */
    case "generate_theme": {
      const prompt = params.prompt as string | undefined;
      if (!prompt || typeof prompt !== "string") {
        return err("MISSING_FIELD", "prompt is required (string)");
      }
      const theme = generateTheme(prompt);
      return json({ data: { theme, prompt: prompt.slice(0, 200) } });
    }

    /* -------------------------------------------------------------- */
    case "list_templates": {
      return json({ data: TEMPLATES });
    }

    /* -------------------------------------------------------------- */
    case "list_actions": {
      return json({ data: ACTIONS });
    }

    /* -------------------------------------------------------------- */
    case "list_themes": {
      const data = Object.entries(THEMES).map(([name, vars]) => ({ name, preview: vars }));
      return json({ data });
    }

    /* -------------------------------------------------------------- */
    default: {
      const safeName = String(tool).slice(0, 64);
      return err("UNKNOWN_TOOL", `Tool '${safeName}' is not available. GET this endpoint for the tool list.`);
    }
  }
};
