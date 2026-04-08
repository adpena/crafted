import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle, inputStyle, errorStyle as errStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";
import { ProgressBar } from "../ProgressBar.tsx";
import { useActionCount } from "../hooks/useActionCount.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { ProgressConfig } from "./progress-config.ts";

export interface SignupActionProps {
  list_name?: string;
  cta_text?: string;
  progress?: ProgressConfig;
  turnstileSiteKey?: string;
  onComplete: (data: {
    type: "signup";
    email: string;
    first_name?: string;
  }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  locale?: Locale;
}

/** Shared tokens */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupAction({
  list_name,
  cta_text,
  progress,
  turnstileSiteKey,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: SignupActionProps): ReactNode {
  const isMobile = useIsMobile();
  const locale = getLocale(localeProp);
  const { count: liveCount } = useActionCount(
    progress?.enabled ? pageId : undefined,
    progress?.countUrl,
    progress?.refreshInterval,
    progress?.sseUrl,
  );
  const turnstile = useTurnstile(turnstileSiteKey);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const ctaLabel = cta_text || "Sign up";

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = t(locale, "required_field");
    else if (!EMAIL_RE.test(email)) e.email = t(locale, "invalid_email");
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "signup",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: {
            email: email.trim(),
            first_name: firstName.trim() || undefined,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "signup",
        email: email.trim(),
        first_name: firstName.trim() || undefined,
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
      {/* Progress bar */}
      {progress?.enabled && progress.goal && progress.goal > 0 && (
        <ProgressBar
          current={liveCount}
          goal={progress.goal}
          labelKey={progress.labelKey ?? "progress_signups"}
          mode={progress.mode ?? "bar"}
          accentColor={progress.accentColor}
          deadline={progress.deadline}
          locale={locale}
        />
      )}

      {list_name && (
        <p style={{ fontFamily: s.mono, fontSize: "0.72rem", color: s.secondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
          Joining: {list_name}
        </p>
      )}
      {/* Responsive: inline 3-col on desktop, stacked on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1.5fr auto",
          gap: isMobile ? "0.75rem" : "1rem",
          alignItems: "end",
          marginBottom: "0.5rem",
        }}
      >
        {/* Optional first name */}
        <div>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            autoComplete="given-name"
            placeholder="Optional"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors({});
              setServerError("");
            }}
            style={{
              ...inputStyle,
              borderBottomColor: errors.email ? s.accent : undefined,
            }}
          />
        </div>

        {/* Desktop submit (inline) */}
        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: "44px",
            padding: "0.625rem 1.5rem",
            fontFamily: s.serif,
            fontSize: "1rem",
            fontWeight: 700,
            letterSpacing: "0.01em",
            color: s.bg,
            background: s.accent,
            border: "none",
            borderRadius: s.radius,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "opacity 150ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Sending..." : ctaLabel}
        </button>
      </div>

      {/* Error row — matches input grid layout */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.5fr auto", gap: isMobile ? "0" : "1rem" }}>
        {!isMobile && <div />}
        <div role="alert" aria-live="polite" style={errStyle}>{errors.email ?? ""}</div>
        <div />
      </div>

      {/* Turnstile bot protection */}
      {turnstileSiteKey && (
        <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <p
          style={{
            fontFamily: s.mono,
            fontSize: "0.78rem",
            color: s.accent,
            marginTop: "0.25rem",
          }}
        >
          {serverError}
        </p>
      )}

      {/*
        Mobile stacked fallback: the 3-column grid collapses naturally
        because grid items have min-width: 0. For narrower viewports the
        inline button still works, but we also add a full-width CTA that
        is visually hidden on wider screens via a simple max-width media
        query emulated with container logic. Since we're in Shadow DOM
        without external CSS, we use a style element trick — but the spec
        says inline only. Instead, the grid will wrap acceptably at small
        sizes since `auto` column shrinks and text wraps.
      */}
    </form>
  );
}
