/**
 * Server-side validator for hero-blocks template payloads.
 *
 * Mirrors plugin/src/components/templates/HeroBlocks.tsx → validateHeroBlocks.
 * Kept here as a separate file so the MCP API route can validate inbound
 * create_page payloads without importing plugin code (which lives in a
 * separate TypeScript project and has a React dependency).
 *
 * Security stance
 * ---------------
 * - Trust is weak: the MCP admin token grants write access but payloads
 *   still come over the wire. This validator is the last line of defense
 *   before data hits D1.
 * - URL fields (image blocks) are checked against a strict https allowlist.
 * - `rich_text` blocks are stored as-is but their HTML is *not* rendered
 *   through dangerouslySetInnerHTML on public pages unless the page
 *   operator opts in. The plugin HeroBlocks render path does
 *   dangerouslySetInnerHTML on rich_text — so any input here must be
 *   pre-trusted. We enforce a max length but not a sanitizer; the admin
 *   editor is expected to supply the sanitizer.
 * - Block count is hard-capped at MAX_HERO_BLOCKS.
 */

export const MAX_HERO_BLOCKS = 64;
export const MAX_TEXT_BYTES = 32 * 1024;   // per text field
export const MAX_RICH_TEXT_BYTES = 64 * 1024;
export const MAX_SPACER_REM = 8;

export type HeroBlockType =
  | "headline"
  | "subhead"
  | "body"
  | "image"
  | "pull_quote"
  | "divider"
  | "spacer"
  | "rich_text";

export interface HeroBlockOutput {
  id: string;
  type: HeroBlockType;
  // Union of all possible fields; per-type presence is enforced by validator.
  text?: string;
  url?: string;
  alt?: string;
  credit?: string;
  attribution?: string;
  height?: number;
  html?: string;
}

export interface ValidationResult {
  blocks: HeroBlockOutput[];
  rejected: Array<{ index: number; reason: string }>;
}

/**
 * Validate a blocks array. Never throws. Returns the cleaned blocks and
 * a list of rejected entries (index + reason) so the caller can surface
 * actionable errors to the editor.
 */
export function validateHeroBlocksServer(raw: unknown): ValidationResult {
  const out: HeroBlockOutput[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  if (!Array.isArray(raw)) {
    return { blocks: out, rejected: [{ index: -1, reason: "blocks must be an array" }] };
  }

  for (const [i, item] of raw.entries()) {
    if (out.length >= MAX_HERO_BLOCKS) {
      rejected.push({ index: i, reason: `exceeds MAX_HERO_BLOCKS (${MAX_HERO_BLOCKS})` });
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      rejected.push({ index: i, reason: "not an object" });
      continue;
    }
    const b = item as Record<string, unknown>;
    const type = b.type as HeroBlockType;
    const id = typeof b.id === "string" && b.id.length > 0 && b.id.length <= 64
      ? b.id
      : `b${i}`;

    const byteLen = (s: string) => new TextEncoder().encode(s).length;

    switch (type) {
      case "headline":
      case "subhead":
      case "body": {
        const text = typeof b.text === "string" ? b.text : "";
        if (!text.trim()) {
          rejected.push({ index: i, reason: `${type}: text required` });
          break;
        }
        if (byteLen(text) > MAX_TEXT_BYTES) {
          rejected.push({ index: i, reason: `${type}: text exceeds ${MAX_TEXT_BYTES} bytes` });
          break;
        }
        out.push({ id, type, text });
        break;
      }
      case "image": {
        const url = typeof b.url === "string" ? b.url : "";
        if (!url) {
          rejected.push({ index: i, reason: "image: url required" });
          break;
        }
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") {
            rejected.push({ index: i, reason: "image: url must be https" });
            break;
          }
          out.push({
            id,
            type: "image",
            url: parsed.href,
            alt: typeof b.alt === "string" ? b.alt.slice(0, 500) : undefined,
            credit: typeof b.credit === "string" ? b.credit.slice(0, 200) : undefined,
          });
        } catch {
          rejected.push({ index: i, reason: "image: invalid url" });
        }
        break;
      }
      case "pull_quote": {
        const text = typeof b.text === "string" ? b.text : "";
        if (!text.trim()) {
          rejected.push({ index: i, reason: "pull_quote: text required" });
          break;
        }
        if (byteLen(text) > MAX_TEXT_BYTES) {
          rejected.push({ index: i, reason: `pull_quote: text exceeds ${MAX_TEXT_BYTES} bytes` });
          break;
        }
        out.push({
          id,
          type: "pull_quote",
          text,
          attribution: typeof b.attribution === "string" ? b.attribution.slice(0, 200) : undefined,
        });
        break;
      }
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "spacer": {
        let height = typeof b.height === "number" && Number.isFinite(b.height) ? b.height : 1;
        if (height < 0) height = 0;
        if (height > MAX_SPACER_REM) height = MAX_SPACER_REM;
        out.push({ id, type: "spacer", height });
        break;
      }
      case "rich_text": {
        const html = typeof b.html === "string" ? b.html : "";
        if (!html.trim()) {
          rejected.push({ index: i, reason: "rich_text: html required" });
          break;
        }
        if (byteLen(html) > MAX_RICH_TEXT_BYTES) {
          rejected.push({ index: i, reason: `rich_text: html exceeds ${MAX_RICH_TEXT_BYTES} bytes` });
          break;
        }
        out.push({ id, type: "rich_text", html });
        break;
      }
      default:
        rejected.push({ index: i, reason: `unknown type: ${String(type)}` });
        continue;
    }
  }

  return { blocks: out, rejected };
}
