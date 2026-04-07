import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useIsMobile } from "../hooks/useIsMobile.ts";

export interface SignupActionProps {
  list_name?: string;
  cta_text?: string;
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
  onComplete,
  page_id: pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
}: SignupActionProps): ReactNode {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const ctaLabel = cta_text || "Sign up";

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(email)) e.email = "Enter a valid email";
    return e;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setServerError("");

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "signup",
          page_id: pageId,
          visitorId,
          variant,
          data: {
            email: email.trim(),
            first_name: firstName.trim() || undefined,
          },
        }),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "signup",
        email: email.trim(),
        first_name: firstName.trim() || undefined,
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: s.mono,
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: s.secondary,
    marginBottom: "0.25rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: s.serif,
    fontSize: "1.05rem",
    color: s.text,
    background: "transparent",
    border: "none",
    borderBottom: `1.5px solid ${s.border}`,
    borderRadius: 0,
    padding: "0.5rem 0",
    minHeight: "44px",
    outline: "none",
    transition: "border-color 150ms ease",
    boxSizing: "border-box" as const,
  };

  const errStyle: React.CSSProperties = {
    fontFamily: s.mono,
    fontSize: "0.7rem",
    color: s.accent,
    marginTop: "0.25rem",
    minHeight: "1rem",
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{ padding: "1.5rem", maxWidth: "42em" }}
    >
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

      {/* Error row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "1rem" }}>
        <div />
        <div style={errStyle}>{errors.email ?? ""}</div>
        <div />
      </div>

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
