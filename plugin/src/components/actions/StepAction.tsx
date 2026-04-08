import { useState, type ReactNode, type FormEvent, type ChangeEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle as label, errorStyle as err, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";

export type StepFieldType = "text" | "email" | "zip" | "tel" | "textarea" | "select" | "radio" | "checkbox";

export interface StepField {
  type: StepFieldType;
  /** Field key — stored in data on submit. Must be in the server allowlist. */
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** For select/radio */
  options?: Array<{ value: string; label: string }>;
  /** Max length for text/textarea */
  maxLength?: number;
  autoComplete?: string;
}

export interface StepDefinition {
  id: string;
  /** Optional heading shown above the fields */
  heading?: string;
  /** Optional markdown-ish body — newlines preserved */
  body?: string;
  fields?: StepField[];
  /**
   * Conditional next-step logic.
   * If set, the form evaluates each rule in order and goes to the first matching step.
   * If none match, goes to the next step in the sequence.
   * `when` is a shallow equality check against the accumulated form values.
   */
  next_if?: Array<{ when: Record<string, string | boolean>; goto: string }>;
}

export interface StepActionProps {
  steps: StepDefinition[];
  /** CTA on the final step */
  submit_label?: string;
  turnstileSiteKey?: string;
  onComplete: (data: { type: "step_form"; values: Record<string, unknown> }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  locale?: Locale;
}

/**
 * Generic multi-step branching form action.
 *
 * Configured entirely via action_props.steps — no code changes needed to
 * add new forms. Supports:
 *  - Text, email, zip, tel, textarea, select, radio, checkbox fields
 *  - Per-step conditional branching (next_if with `when`/`goto`)
 *  - Required field validation per step
 *  - Accessible (labels, aria-invalid, role="alert")
 *  - Mobile-first layout (single column, large tap targets)
 */
export function StepAction({
  steps,
  submit_label = "Submit",
  turnstileSiteKey,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: StepActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const turnstile = useTurnstile(turnstileSiteKey);

  const [currentStepId, setCurrentStepId] = useState(steps[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  if (!steps || steps.length === 0) {
    return <p style={{ color: s.accent, padding: "1.5rem" }}>No steps configured.</p>;
  }

  const currentIdx = steps.findIndex((s) => s.id === currentStepId);
  const currentStep = steps[currentIdx] ?? steps[0]!;
  const isFinalStep = currentIdx === steps.length - 1 || resolveNextStepId(currentStep, values, steps) === null;

  function setValue(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function validateStep(step: StepDefinition): Record<string, string> {
    const e: Record<string, string> = {};
    if (!step.fields) return e;
    for (const f of step.fields) {
      const v = values[f.name];
      if (f.required && (v === undefined || v === "" || v === null || v === false)) {
        e[f.name] = t(locale, "required_field");
        continue;
      }
      if (f.type === "email" && typeof v === "string" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        e[f.name] = t(locale, "invalid_email");
      }
      if (f.type === "zip" && typeof v === "string" && v && !/^\d{5}(-\d{4})?$/.test(v)) {
        e[f.name] = "Enter a valid 5-digit zip";
      }
    }
    return e;
  }

  function handleNext(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validateStep(currentStep);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    const nextId = resolveNextStepId(currentStep, values, steps);
    if (nextId) {
      setHistory((h) => [...h, currentStepId]);
      setCurrentStepId(nextId);
      setErrors({});
      return;
    }

    // No next step — this is the final step
    void handleFinalSubmit();
  }

  function handleBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setCurrentStepId(prev);
    setErrors({});
  }

  async function handleFinalSubmit() {
    const fieldErrors = validateStep(currentStep);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    if (turnstileSiteKey && !turnstile.token) {
      setServerError(t(locale, "submit_error"));
      return;
    }

    setLoading(true);
    setServerError("");

    // Derive canonical fields from values for the server allowlist
    const data: Record<string, unknown> = {};
    for (const key of ["first_name", "last_name", "email", "zip", "comment", "notes"]) {
      if (values[key] !== undefined) data[key] = values[key];
    }

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "step_form",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({ type: "step_form", values });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      setServerError(isTimeout ? "Request timed out. Please try again." : (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%",
    fontFamily: s.serif,
    fontSize: "1.05rem",
    color: s.text,
    background: "transparent",
    border: "none",
    borderBottom: `1.5px solid ${s.border}`,
    padding: "0.5rem 0",
    minHeight: "44px",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleNext} noValidate style={{ padding: "1.5rem", maxWidth: "42em" }}>
      {/* Progress indicator */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.5rem",
        }}
        aria-label={`Step ${currentIdx + 1} of ${steps.length}`}
      >
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              background: i <= currentIdx ? s.accent : s.border,
              borderRadius: "2px",
              transition: "background 200ms ease",
            }}
          />
        ))}
      </div>

      {currentStep.heading && (
        <h2
          style={{
            fontFamily: s.serif,
            fontSize: "1.5rem",
            fontWeight: 600,
            color: s.text,
            margin: "0 0 0.75rem",
            lineHeight: 1.25,
          }}
        >
          {currentStep.heading}
        </h2>
      )}

      {currentStep.body && (
        <p
          style={{
            fontFamily: s.serif,
            fontSize: "1rem",
            color: s.secondary,
            lineHeight: 1.6,
            marginTop: 0,
            marginBottom: "1.5rem",
            whiteSpace: "pre-line",
          }}
        >
          {currentStep.body}
        </p>
      )}

      {currentStep.fields?.map((f) => renderField(f, values, errors, setValue, label, input, err))}

      {isFinalStep && turnstileSiteKey && (
        <div style={{ marginTop: "1rem", marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {serverError && (
        <p role="alert" aria-live="polite" style={{ ...err, marginTop: "1rem", marginBottom: "0.5rem" }}>
          {serverError}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.75rem" }}>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleBack}
            style={{
              minHeight: "52px",
              padding: "0.875rem 1.5rem",
              fontFamily: s.serif,
              fontSize: "1rem",
              color: s.text,
              background: "transparent",
              border: `1.5px solid ${s.border}`,
              borderRadius: s.radius,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...submitButtonStyle,
            flex: 1,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Submitting…" : (isFinalStep ? submit_label : "Continue")}
        </button>
      </div>
    </form>
  );
}

function renderField(
  f: StepField,
  values: Record<string, unknown>,
  errors: Record<string, string>,
  setValue: (name: string, value: unknown) => void,
  label: React.CSSProperties,
  input: React.CSSProperties,
  err: React.CSSProperties,
): ReactNode {
  const id = `step-field-${f.name}`;
  const value = values[f.name];
  const invalid = !!errors[f.name];

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      setValue(f.name, t.checked);
    } else {
      setValue(f.name, t.value);
    }
  };

  if (f.type === "textarea") {
    return (
      <div key={f.name} style={{ marginBottom: "1rem" }}>
        <label htmlFor={id} style={label}>{f.label}</label>
        <textarea
          id={id}
          value={String(value ?? "")}
          onChange={handleChange}
          maxLength={f.maxLength ?? 1000}
          rows={4}
          placeholder={f.placeholder}
          aria-invalid={invalid}
          style={{
            ...input,
            border: `1px solid ${invalid ? "var(--page-accent, #c00)" : "var(--page-border, #ddd)"}`,
            borderRadius: "var(--page-radius, 4px)",
            padding: "0.75rem",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors[f.name] ?? ""}</div>
      </div>
    );
  }

  if (f.type === "select") {
    return (
      <div key={f.name} style={{ marginBottom: "1rem" }}>
        <label htmlFor={id} style={label}>{f.label}</label>
        <select
          id={id}
          value={String(value ?? "")}
          onChange={handleChange}
          aria-invalid={invalid}
          style={{ ...input, cursor: "pointer" }}
        >
          <option value="">{f.placeholder ?? "Select…"}</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div role="alert" aria-live="polite" style={err}>{errors[f.name] ?? ""}</div>
      </div>
    );
  }

  if (f.type === "radio") {
    return (
      <fieldset key={f.name} style={{ marginBottom: "1rem", border: "none", padding: 0, margin: "0 0 1rem" }}>
        <legend style={label}>{f.label}</legend>
        {f.options?.map((o) => (
          <label key={o.value} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0", cursor: "pointer", minHeight: "44px" }}>
            <input
              type="radio"
              name={f.name}
              value={o.value}
              checked={value === o.value}
              onChange={handleChange}
              style={{ width: "1.125rem", height: "1.125rem", accentColor: "var(--page-accent, #c00)" }}
            />
            <span style={{ fontFamily: "var(--page-font-serif)", fontSize: "1rem" }}>{o.label}</span>
          </label>
        ))}
        <div role="alert" aria-live="polite" style={err}>{errors[f.name] ?? ""}</div>
      </fieldset>
    );
  }

  if (f.type === "checkbox") {
    return (
      <label key={f.name} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", marginBottom: "1rem", cursor: "pointer", minHeight: "44px", padding: "0.25rem 0" }}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={handleChange}
          aria-invalid={invalid}
          style={{ width: "1.125rem", height: "1.125rem", marginTop: "0.15rem", accentColor: "var(--page-accent, #c00)", flexShrink: 0 }}
        />
        <span style={{ fontFamily: "var(--page-font-serif)", fontSize: "1rem", lineHeight: 1.45 }}>{f.label}</span>
      </label>
    );
  }

  // text, email, zip, tel
  const htmlType = f.type === "zip" ? "text" : f.type;
  return (
    <div key={f.name} style={{ marginBottom: "1rem" }}>
      <label htmlFor={id} style={label}>{f.label}</label>
      <input
        id={id}
        type={htmlType}
        inputMode={f.type === "zip" ? "numeric" : undefined}
        autoComplete={f.autoComplete}
        placeholder={f.placeholder}
        value={String(value ?? "")}
        onChange={handleChange}
        maxLength={f.maxLength ?? 254}
        aria-invalid={invalid}
        style={{ ...input, borderBottomColor: invalid ? "var(--page-accent, #c00)" : undefined }}
      />
      <div role="alert" aria-live="polite" style={err}>{errors[f.name] ?? ""}</div>
    </div>
  );
}

/** Evaluate `next_if` rules to decide which step comes next. */
function resolveNextStepId(
  step: StepDefinition,
  values: Record<string, unknown>,
  all: StepDefinition[],
): string | null {
  if (step.next_if) {
    for (const rule of step.next_if) {
      const matches = Object.entries(rule.when).every(([k, v]) => values[k] === v);
      if (matches) {
        const target = all.find((s) => s.id === rule.goto);
        if (target) return target.id;
      }
    }
  }
  const idx = all.findIndex((s) => s.id === step.id);
  if (idx < 0 || idx >= all.length - 1) return null;
  return all[idx + 1]!.id;
}

