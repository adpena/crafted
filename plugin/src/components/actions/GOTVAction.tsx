import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";

export interface GOTVActionProps {
  pledge_text?: string;
  election_date?: string;
  onComplete: (data: { type: "gotv_pledge"; first_name: string; zip: string }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  locale?: Locale;
}

/** Shared tokens */
export function GOTVAction({
  pledge_text,
  election_date,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: GOTVActionProps): ReactNode {
  const [firstName, setFirstName] = useState("");
  const [zip, setZip] = useState("");
  const [pledged, setPledged] = useState(false);
  const [errors, setErrors] = useState<{
    first_name?: string;
    zip?: string;
    pledge?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const resolvedPledge =
    pledge_text ??
    `I pledge to vote${election_date ? ` on ${election_date}` : ""}`;

  function validate() {
    const e: typeof errors = {};
    if (!firstName.trim()) e.first_name = t(locale, "required_field");
    if (!zip.trim()) e.zip = "Zip code is required";
    if (!pledged) e.pledge = "Please check the pledge";
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
          type: "gotv_pledge",
          page_id: pageId,
          visitorId,
          variant,
          data: {
            first_name: firstName.trim(),
            zip: zip.trim(),
          },
        }),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "gotv_pledge",
        first_name: firstName.trim(),
        zip: zip.trim(),
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
      {/* Compact two-column row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setErrors((p) => ({ ...p, first_name: undefined }));
            }}
            style={{
              ...inputStyle,
              borderBottomColor: errors.first_name ? s.accent : undefined,
            }}
          />
          <div style={errStyle}>{errors.first_name ?? ""}</div>
        </div>
        <div>
          <label style={labelStyle}>Zip code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => {
              setZip(e.target.value);
              setErrors((p) => ({ ...p, zip: undefined }));
            }}
            style={{
              ...inputStyle,
              borderBottomColor: errors.zip ? s.accent : undefined,
            }}
          />
          <div style={errStyle}>{errors.zip ?? ""}</div>
        </div>
      </div>

      {/* Pledge checkbox */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          marginBottom: "1.5rem",
          cursor: "pointer",
          minHeight: "44px",
          padding: "0.25rem 0",
        }}
      >
        <input
          type="checkbox"
          checked={pledged}
          onChange={(e) => {
            setPledged(e.target.checked);
            setErrors((p) => ({ ...p, pledge: undefined }));
          }}
          style={{
            width: "1.125rem",
            height: "1.125rem",
            marginTop: "0.15rem",
            accentColor: s.accent,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: s.serif,
            fontSize: "1rem",
            color: s.text,
            lineHeight: 1.45,
          }}
        >
          {resolvedPledge}
        </span>
      </label>
      {errors.pledge && (
        <div style={{ ...errStyle, marginTop: "-1rem", marginBottom: "1rem" }}>
          {errors.pledge}
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <p
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
          width: "100%",
          minHeight: "52px",
          padding: "0.875rem 1.5rem",
          fontFamily: s.serif,
          fontSize: "1.15rem",
          fontWeight: 700,
          letterSpacing: "0.01em",
          color: s.bg,
          background: s.accent,
          border: "none",
          borderRadius: s.radius,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 150ms ease",
        }}
      >
        {loading ? t(locale, "gotv_pledging") : "Take the pledge"}
      </button>
    </form>
  );
}
