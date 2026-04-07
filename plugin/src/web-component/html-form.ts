/**
 * generateHtmlForm — framework-free HTML fallback for action pages.
 *
 * Produces a standalone HTML <form> that POSTs to the plugin submit endpoint.
 * Works without JavaScript (native form submission), and optionally emits
 * `hx-*` attributes so HTMX users get progressive enhancement for free.
 *
 * The output is a complete fragment (style + form). It can be:
 *   - injected into a Django/Rails template
 *   - dropped into a static HTML page
 *   - returned from a server route
 *   - used by an HTMX `hx-get` partial
 */

import { resolveTheme, type Theme } from "../components/themes/index.ts";

export type ActionType = "petition" | "fundraise" | "gotv" | "signup";

export type GenerateHtmlFormOptions = {
  /** Action page slug — must match a slug stored in the plugin. */
  slug: string;
  /** Action type — picks the field set. */
  action: ActionType;
  /** Origin where the plugin is mounted, e.g. "https://adpena.com". */
  domain: string;
  /** Optional campaign slug to scope the submission. */
  campaign?: string;
  /** Theme key ("warm" | "bold" | "clean") or a custom theme object. */
  theme?: string | Record<string, string>;
  /** Submit button label. Defaults vary per action type. */
  submitLabel?: string;
  /** When true, also emit `hx-post` / `hx-target` / `hx-swap` attributes. */
  htmx?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Field schemas                                                      */
/* ------------------------------------------------------------------ */

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "textarea" | "checkbox";
  required: boolean;
  autocomplete?: string;
  placeholder?: string;
};

const FIELDS: Record<ActionType, FieldDef[]> = {
  petition: [
    { name: "first_name", label: "First name", type: "text", required: true, autocomplete: "given-name" },
    { name: "last_name", label: "Last name", type: "text", required: true, autocomplete: "family-name" },
    { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
    { name: "zip", label: "ZIP", type: "text", required: true, autocomplete: "postal-code" },
    { name: "comment", label: "Comment (optional)", type: "textarea", required: false },
  ],
  fundraise: [
    { name: "amount", label: "Amount (USD)", type: "number", required: true, placeholder: "25" },
    { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
  ],
  gotv: [
    { name: "first_name", label: "First name", type: "text", required: true, autocomplete: "given-name" },
    { name: "zip", label: "ZIP", type: "text", required: true, autocomplete: "postal-code" },
    { name: "pledge", label: "I pledge to vote.", type: "checkbox", required: true },
  ],
  signup: [
    { name: "first_name", label: "First name (optional)", type: "text", required: false, autocomplete: "given-name" },
    { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
  ],
};

const TYPE_FOR_ACTION: Record<ActionType, string> = {
  petition: "petition_sign",
  fundraise: "donation_click",
  gotv: "gotv_pledge",
  signup: "signup",
};

const DEFAULT_LABEL: Record<ActionType, string> = {
  petition: "Sign the petition",
  fundraise: "Chip in",
  gotv: "Pledge to vote",
  signup: "Sign up",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function themeToCss(theme: Theme): string {
  return Object.entries(theme)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");
}

function buildSubmitUrl(domain: string): string {
  const trimmed = domain.replace(/\/+$/, "");
  return `${trimmed}/api/_plugin/crafted-action-pages/submit`;
}

/* ------------------------------------------------------------------ */
/*  Renderer                                                           */
/* ------------------------------------------------------------------ */

export function generateHtmlForm(opts: GenerateHtmlFormOptions): string {
  const fields = FIELDS[opts.action];
  if (!fields) {
    throw new Error(`generateHtmlForm: unknown action type "${opts.action}"`);
  }

  const theme = resolveTheme(opts.theme);
  const submitUrl = buildSubmitUrl(opts.domain);
  const submissionType = TYPE_FOR_ACTION[opts.action];
  const label = opts.submitLabel ?? DEFAULT_LABEL[opts.action];
  const formId = `crafted-form-${escapeAttr(opts.slug)}`;

  const hxAttrs = opts.htmx
    ? ` hx-post="${escapeAttr(submitUrl)}" hx-target="#${formId}" hx-swap="outerHTML" hx-encoding="application/x-www-form-urlencoded"`
    : "";

  const fieldHtml = fields.map((field) => renderField(field)).join("\n      ");

  const styleVars = themeToCss(theme);

  return `<style>
  #${formId} {
    ${styleVars}
    max-width: 480px;
    margin: 0 auto;
    padding: 1.5rem;
    background: var(--page-bg);
    color: var(--page-text);
    font-family: var(--page-font-serif);
    border: 1px solid var(--page-border);
    border-radius: var(--page-radius);
  }
  #${formId} label {
    display: block;
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: var(--page-secondary);
  }
  #${formId} input[type="text"],
  #${formId} input[type="email"],
  #${formId} input[type="tel"],
  #${formId} input[type="number"],
  #${formId} textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font: inherit;
    color: var(--page-text);
    background: var(--page-bg);
    border: 1px solid var(--page-border);
    border-radius: var(--page-radius);
    box-sizing: border-box;
  }
  #${formId} input[type="checkbox"] {
    margin-right: 0.5rem;
  }
  #${formId} button {
    margin-top: 1rem;
    width: 100%;
    padding: 0.75rem 1rem;
    font: inherit;
    color: var(--page-bg);
    background: var(--page-accent);
    border: 0;
    border-radius: var(--page-radius);
    cursor: pointer;
  }
  #${formId} button:hover { opacity: 0.9; }
</style>
<form id="${formId}" method="post" action="${escapeAttr(submitUrl)}"${hxAttrs}>
      <input type="hidden" name="page_id" value="${escapeAttr(opts.slug)}">
      ${opts.campaign ? `<input type="hidden" name="campaign_id" value="${escapeAttr(opts.campaign)}">\n      ` : ""}<input type="hidden" name="type" value="${escapeAttr(submissionType)}">
      ${fieldHtml}
      <button type="submit">${escapeHtml(label)}</button>
    </form>`;
}

function renderField(field: FieldDef): string {
  const required = field.required ? " required" : "";
  const ac = field.autocomplete ? ` autocomplete="${escapeAttr(field.autocomplete)}"` : "";
  const ph = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : "";
  const id = `crafted-field-${field.name}`;

  if (field.type === "textarea") {
    return `<label for="${id}">${escapeHtml(field.label)}</label>
      <textarea id="${id}" name="${escapeAttr(field.name)}"${required}${ph} rows="3"></textarea>`;
  }

  if (field.type === "checkbox") {
    return `<label for="${id}"><input id="${id}" type="checkbox" name="${escapeAttr(field.name)}" value="1"${required}> ${escapeHtml(field.label)}</label>`;
  }

  return `<label for="${id}">${escapeHtml(field.label)}</label>
      <input id="${id}" type="${field.type}" name="${escapeAttr(field.name)}"${required}${ac}${ph}>`;
}
