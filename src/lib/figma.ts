/**
 * Figma file metadata import helpers.
 *
 * Parses a Figma file URL, fetches the file from the Figma API, and walks
 * the document tree to collect the most-used fill colors. Returns
 * everything an operator needs to bootstrap a new action page theme from
 * a Figma mockup.
 *
 * Figma REST API docs: https://www.figma.com/developers/api
 *
 * Authentication: the caller must supply a Personal Access Token (PAT) as
 * the X-Figma-Token header, supplied via env.FIGMA_ACCESS_TOKEN.
 *
 * Rate limits: Figma allows ~30 req/min/token. This module does not
 * enforce that — the HTTP endpoint wrapping it should cache aggressively.
 */

/** Supported Figma URL forms (public + private, with or without file name). */
const FIGMA_URL_RE =
  /^https?:\/\/(?:www\.)?figma\.com\/(?:file|design|proto)\/([A-Za-z0-9]{8,40})(?:\/|$)/;

export interface FigmaMetadata {
  /** Figma file key extracted from the URL. */
  file_key: string;
  /** File name as set by the owner in Figma. */
  name: string;
  /** Figma-generated preview thumbnail (may expire). */
  thumbnail_url?: string;
  /** ISO timestamp of the file's last modification. */
  last_modified?: string;
  /** Top fill colors from the document, most-used first. */
  colors: Array<{
    /** 6-digit hex without leading #. */
    hex: string;
    /** Usage count in the scanned subtree. */
    count: number;
  }>;
}

/** Max nodes to walk — prevents runaway traversal on huge files. */
const MAX_NODE_VISITS = 5_000;

/** Max fill colors returned. */
const MAX_COLORS = 8;

/**
 * Extract the file key from a Figma URL. Accepts both /file/ and /design/
 * formats and tolerates trailing segments / query params.
 *
 * Returns null for invalid URLs — callers should treat this as a 400.
 */
export function parseFigmaUrl(url: string): string | null {
  if (typeof url !== "string" || url.length > 4096) return null;
  const m = url.match(FIGMA_URL_RE);
  return m ? m[1] ?? null : null;
}

/**
 * Convert a Figma color (0-1 floats) to a 6-digit hex string.
 * Alpha is discarded — the caller decides whether to show the color as
 * opaque or tinted.
 */
export function figmaColorToHex(c: { r: number; g: number; b: number }): string {
  const to8 = (x: number) => {
    const v = Math.round(Math.max(0, Math.min(1, x)) * 255);
    return v.toString(16).padStart(2, "0");
  };
  return `${to8(c.r)}${to8(c.g)}${to8(c.b)}`;
}

/** Minimal shape of a Figma node for tree walking. */
interface FigmaNode {
  type?: string;
  children?: FigmaNode[];
  fills?: Array<{
    type?: string;
    visible?: boolean;
    opacity?: number;
    color?: { r: number; g: number; b: number; a?: number };
  }>;
}

/**
 * Walk a Figma document tree and return fill colors sorted by usage count.
 * Only counts visible SOLID fills. Bounded by MAX_NODE_VISITS to cap
 * worst-case cost on massive design systems.
 */
export function collectFigmaColors(
  root: FigmaNode,
  maxColors: number = MAX_COLORS,
): FigmaMetadata["colors"] {
  const counts = new Map<string, number>();
  let visits = 0;
  const stack: FigmaNode[] = [root];

  while (stack.length > 0 && visits < MAX_NODE_VISITS) {
    const node = stack.pop()!;
    visits++;

    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type !== "SOLID") continue;
        if (fill.visible === false) continue;
        if (!fill.color) continue;
        // Treat fully-transparent fills as absent — they do not contribute
        // to the visual identity of the design.
        const effectiveAlpha = (fill.opacity ?? 1) * (fill.color.a ?? 1);
        if (effectiveAlpha < 0.05) continue;
        const hex = figmaColorToHex(fill.color);
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([hex, count]) => ({ hex, count }));
}

export interface FetchFigmaDeps {
  /** Figma API personal access token. */
  token: string;
  /** Overridable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch a Figma file and return normalized metadata + top colors.
 *
 * Throws on network failure or non-2xx responses. The caller is expected
 * to catch and translate to an HTTP error.
 */
export async function fetchFigmaMetadata(
  fileUrl: string,
  deps: FetchFigmaDeps,
): Promise<FigmaMetadata> {
  const fileKey = parseFigmaUrl(fileUrl);
  if (!fileKey) {
    throw new Error("Invalid Figma URL");
  }
  if (!deps.token) {
    throw new Error("FIGMA_ACCESS_TOKEN is not configured");
  }

  const fetchImpl = deps.fetchImpl ?? fetch;

  // depth=3 captures top-level pages, their immediate frames, and one
  // more level of children — enough for most landing page mockups
  // without paying for the entire design system.
  const res = await fetchImpl(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
    headers: { "X-Figma-Token": deps.token },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    name?: string;
    thumbnailUrl?: string;
    lastModified?: string;
    document?: FigmaNode;
  };

  const colors = data.document ? collectFigmaColors(data.document) : [];

  return {
    file_key: fileKey,
    name: data.name ?? fileKey,
    thumbnail_url: data.thumbnailUrl,
    last_modified: data.lastModified,
    colors,
  };
}
