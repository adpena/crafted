import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle, inputStyle, errorStyle, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { ProgressBar } from "../ProgressBar.tsx";
import { useActionCount } from "../hooks/useActionCount.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { ProgressConfig } from "./progress-config.ts";

export interface PetitionActionProps {
  target?: string;
  goal?: number;
  show_count?: boolean;
  signatureCount?: number;
  progress?: ProgressConfig;
  /** Cloudflare Turnstile site key — enables bot protection when set */
  turnstileSiteKey?: string;
  /** When true, show an optional phone field (improves VAN match rate) */
  collect_phone?: boolean;
  onComplete: (data: {
    type: "petition_sign";
    first_name: string;
    last_name: string;
    email: string;
    zip: string;
    phone?: string;
  }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  locale?: Locale;
}

interface FieldErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  zip?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PetitionAction({
  target,
  goal,
  show_count,
  signatureCount,
  progress,
  turnstileSiteKey,
  collect_phone,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: PetitionActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const progressGoal = progress?.goal ?? goal ?? 0;
  const { count: liveCount } = useActionCount(
    progress?.enabled ? pageId : undefined,
    progress?.countUrl,
    progress?.refreshInterval,
    progress?.sseUrl,
  );
  const turnstile = useTurnstile(turnstileSiteKey);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    zip: "",
    phone: "",
    comment: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
      setServerError("");
    };
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.first_name.trim()) e.first_name = t(locale, "required_field");
    if (!form.last_name.trim()) e.last_name = t(locale, "required_field");
    if (!form.email.trim()) e.email = t(locale, "required_field");
    else if (!EMAIL_RE.test(form.email)) e.email = t(locale, "invalid_email");
    if (!form.zip.trim()) e.zip = t(locale, "required_field");
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    // Block submit if Turnstile is configured but not yet verified
    if (turnstileSiteKey && !turnstile.token) {
      setServerError(t(locale, "submit_error"));
      return;
    }

    setLoading(true);
    setServerError("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "petition_sign",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            zip: form.zip.trim(),
            ...(collect_phone && form.phone.trim() ? { phone: form.phone.trim() } : {}),
            comment: form.comment.trim() || undefined,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }

      onComplete({
        type: "petition_sign",
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        zip: form.zip.trim(),
        ...(collect_phone && form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      setServerError(isTimeout ? "Request timed out. Please try again." : (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ padding: "1.5rem", maxWidth: "42em" }}
    >
      {/* Target callout */}
      {target && (
        <p
          style={{
            fontFamily: s.serif,
            fontSize: "1.15rem",
            fontWeight: 600,
            color: s.text,
            marginTop: 0,
            marginBottom: "1.25rem",
          }}
        >
          {t(locale, "petition_tell")} {target}:
        </p>
      )}

      {/* Progress bar — configurable mode, goal, colors */}
      {progress?.enabled && progressGoal > 0 && (
        <ProgressBar
          current={(liveCount || signatureCount || 0) + (progress.initialCount ?? 0)}
          goal={progressGoal}
          labelKey={progress.labelKey ?? "progress_signatures"}
          mode={progress.mode ?? "bar"}
          accentColor={progress.accentColor}
          deadline={progress.deadline}
          locale={locale}
        />
      )}

      {/* Legacy signature count (when progress bar is not enabled) */}
      {!progress?.enabled && show_count && signatureCount != null && (
        <p
          style={{
            fontFamily: s.mono,
            fontSize: "0.8rem",
            color: s.secondary,
            letterSpacing: "0.04em",
            marginTop: 0,
            marginBottom: "1.25rem",
          }}
        >
          {signatureCount.toLocaleString()} signature
          {signatureCount !== 1 ? "s" : ""}
          {goal ? ` of ${goal.toLocaleString()} goal` : ""}
        </p>
      )}

      {/* Name row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <label htmlFor="petition-first-name" style={labelStyle}>{t(locale, "petition_first_name")}</label>
          <input
            id="petition-first-name"
            type="text"
            autoComplete="given-name"
            aria-invalid={!!errors.first_name}
            aria-describedby="petition-first-name-error"
            value={form.first_name}
            onChange={set("first_name")}
            style={{
              ...inputStyle,
              borderBottomColor: errors.first_name ? s.accent : undefined,
            }}
          />
          <div id="petition-first-name-error" role="alert" aria-live="polite" style={errorStyle}>{errors.first_name ?? ""}</div>
        </div>
        <div>
          <label htmlFor="petition-last-name" style={labelStyle}>{t(locale, "petition_last_name")}</label>
          <input
            id="petition-last-name"
            type="text"
            autoComplete="family-name"
            aria-invalid={!!errors.last_name}
            aria-describedby="petition-last-name-error"
            value={form.last_name}
            onChange={set("last_name")}
            style={{
              ...inputStyle,
              borderBottomColor: errors.last_name ? s.accent : undefined,
            }}
          />
          <div id="petition-last-name-error" role="alert" aria-live="polite" style={errorStyle}>{errors.last_name ?? ""}</div>
        </div>
      </div>

      {/* Email */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="petition-email" style={labelStyle}>{t(locale, "petition_email")}</label>
        <input
          id="petition-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby="petition-email-error"
          value={form.email}
          onChange={set("email")}
          style={{
            ...inputStyle,
            borderBottomColor: errors.email ? s.accent : undefined,
          }}
        />
        <div id="petition-email-error" role="alert" aria-live="polite" style={errorStyle}>{errors.email ?? ""}</div>
      </div>

      {/* Zip */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="petition-zip" style={labelStyle}>{t(locale, "petition_zip")}</label>
        <input
          id="petition-zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-invalid={!!errors.zip}
          aria-describedby="petition-zip-error"
          value={form.zip}
          onChange={set("zip")}
          style={{
            ...inputStyle,
            borderBottomColor: errors.zip ? s.accent : undefined,
            maxWidth: "10rem",
          }}
        />
        <div id="petition-zip-error" role="alert" aria-live="polite" style={errorStyle}>{errors.zip ?? ""}</div>
      </div>

      {/* Phone (optional, improves VAN match rate) */}
      {collect_phone && (
        <div style={{ marginBottom: "0.5rem" }}>
          <label htmlFor="petition-phone" style={labelStyle}>
            Phone (optional)
          </label>
          <input
            id="petition-phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
            style={{
              ...inputStyle,
              maxWidth: "14rem",
            }}
          />
        </div>
      )}

      {/* Comment */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label htmlFor="petition-comment" style={labelStyle}>
          {t(locale, "petition_comment")}
        </label>
        <textarea
          id="petition-comment"
          value={form.comment}
          onChange={set("comment")}
          maxLength={1000}
          rows={3}
          style={{
            ...inputStyle,
            resize: "vertical" as const,
            minHeight: "60px",
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Turnstile bot protection (only renders if site key configured) */}
      {turnstileSiteKey && (
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            fontFamily: s.mono,
            fontSize: "0.78rem",
            color: s.accent,
            marginBottom: "1rem",
          }}
        >
          {serverError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        style={{
          ...submitButtonStyle,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? t(locale, "petition_signing") : t(locale, "petition_submit")}
      </button>
    </form>
  );
}
