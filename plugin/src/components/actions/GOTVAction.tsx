import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle, inputStyle, errorStyle as errStyle, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { ProgressBar } from "../ProgressBar.tsx";
import { useActionCount } from "../hooks/useActionCount.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { ProgressConfig } from "./progress-config.ts";

export interface GOTVActionProps {
  pledge_text?: string;
  election_date?: string;
  progress?: ProgressConfig;
  turnstileSiteKey?: string;
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
  progress,
  turnstileSiteKey,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: GOTVActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const { count: liveCount } = useActionCount(
    progress?.enabled ? pageId : undefined,
    progress?.countUrl,
    progress?.refreshInterval,
    progress?.sseUrl,
  );
  const turnstile = useTurnstile(turnstileSiteKey);
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
    if (!zip.trim()) e.zip = t(locale, "required_field");
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
          type: "gotv_pledge",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: {
            first_name: firstName.trim(),
            zip: zip.trim(),
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "gotv_pledge",
        first_name: firstName.trim(),
        zip: zip.trim(),
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
          labelKey={progress.labelKey ?? "progress_pledges"}
          mode={progress.mode ?? "bar"}
          accentColor={progress.accentColor}
          deadline={progress.deadline}
          locale={locale}
        />
      )}

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
        <div role="alert" aria-live="polite" style={{ ...errStyle, marginTop: "-1rem", marginBottom: "1rem" }}>
          {errors.pledge}
        </div>
      )}

      {/* Turnstile bot protection */}
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
        {loading ? t(locale, "gotv_pledging") : t(locale, "gotv_submit")}
      </button>
    </form>
  );
}
