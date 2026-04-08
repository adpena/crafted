/**
 * Sanitize user-provided CSS for safe inline injection into action pages.
 *
 * Threat model: only authenticated page editors (Bearer token) can set
 * custom_css, so the primary risks are (a) a hostile editor attacking
 * their own visitors, and (b) a compromised editor session. This sanitizer
 * defends against both by stripping CSS features that can execute code,
 * exfiltrate data, or break out of the <style> tag.
 *
 * Strategy: block-list dangerous patterns + enforce a hard size cap.
 * A full CSS parser would be stricter but is overkill for this surface.
 *
 * Blocked:
 *  - </style> and <script> — prevent tag breakout
 *  - expression(...) — IE-era code execution
 *  - javascript: / vbscript: / data: schemes in url() — XSS vector
 *  - behavior: — IE binary behaviors
 *  - @import — network exfiltration + external sheet load
 *  - -moz-binding — Firefox XBL code execution
 */

/** Max size for custom CSS (16 KB — generous for per-page overrides). */
export const MAX_CUSTOM_CSS_BYTES = 16 * 1024;

export interface SanitizeResult {
  css: string;
  rejected: boolean;
  reason?: string;
}

export function sanitizeCustomCss(input: unknown): SanitizeResult {
  if (input == null || input === "") return { css: "", rejected: false };
  if (typeof input !== "string") {
    return { css: "", rejected: true, reason: "not_a_string" };
  }

  // Size cap — measured in bytes, not chars, since editors may paste UTF-8.
  const byteLength = new TextEncoder().encode(input).length;
  if (byteLength > MAX_CUSTOM_CSS_BYTES) {
    return { css: "", rejected: true, reason: "too_large" };
  }

  // Normalize: strip null bytes and CSS comments (comments can hide
  // malicious tokens from block-list scans — e.g., `ex/**/pression(...)`).
  let css = input.replace(/\u0000/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Dangerous patterns — case-insensitive.
  const dangerous: Array<[RegExp, string]> = [
    [/<\/style\s*>/i, "style_tag_breakout"],
    [/<script/i, "script_tag"],
    [/expression\s*\(/i, "css_expression"],
    [/javascript\s*:/i, "javascript_url"],
    [/vbscript\s*:/i, "vbscript_url"],
    [/behavior\s*:/i, "ie_behavior"],
    [/-moz-binding/i, "moz_binding"],
    [/@import/i, "css_import"],
    // url(data:...) — block data: scheme in url() (allows arbitrary blobs).
    // Still allow url(https://...) and relative urls for fonts/images.
    [/url\s*\(\s*['"]?\s*data\s*:/i, "data_url"],
  ];

  for (const [pattern, reason] of dangerous) {
    if (pattern.test(css)) {
      return { css: "", rejected: true, reason };
    }
  }

  return { css: css.trim(), rejected: false };
}
