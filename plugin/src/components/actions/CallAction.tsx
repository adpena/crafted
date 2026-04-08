import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle as label, errorStyle as err, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { Representative } from "../../lib/reps-types.ts";

export interface CallActionProps {
  /** What to tell the rep's staff */
  script: string;
  /** Who this call is targeting */
  target?: string;
  /** Filter reps by chamber */
  rep_level?: "senate" | "house" | "both";
  /** Bullet talking points displayed alongside the script */
  talking_points?: string[];
  turnstileSiteKey?: string;
  onComplete: (data: {
    type: "call_made";
    first_name: string;
    last_name: string;
    email: string;
    zip: string;
    rep_names: string[];
    calls_completed: number;
  }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  repsUrl?: string;
  locale?: Locale;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

/**
 * Click-to-call action — looks up your representatives by zip code and lets you
 * tap to dial each one with a script and talking points on screen.
 *
 * This is the 5-Calls equivalent: fast, mobile-first, no sign-in.
 * On submit we record a `call_made` event with how many reps the user dialed.
 */
export function CallAction({
  script,
  target,
  rep_level = "both",
  talking_points,
  turnstileSiteKey,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  repsUrl = "/api/action/reps",
  locale: localeProp,
}: CallActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const turnstile = useTurnstile(turnstileSiteKey);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [reps, setReps] = useState<Representative[]>([]);
  const [repsLoading, setRepsLoading] = useState(false);
  const [completedCalls, setCompletedCalls] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  // When zip changes and is valid, fetch reps
  useEffect(() => {
    if (!ZIP_RE.test(zip)) {
      setReps([]);
      setCompletedCalls(new Set());
      return;
    }

    let cancelled = false;
    setRepsLoading(true);

    fetch(`${repsUrl}?zip=${encodeURIComponent(zip)}`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => r.json() as Promise<{ representatives: Representative[] }>)
      .then((data) => {
        if (cancelled) return;
        const filtered = (data.representatives ?? []).filter((r) => {
          if (!r.phones || r.phones.length === 0) return false;
          if (rep_level === "senate") return /senator|senate/i.test(r.office);
          if (rep_level === "house") return /representative|house/i.test(r.office);
          return true;
        });
        setReps(filtered);
      })
      .catch(() => { if (!cancelled) setReps([]); })
      .finally(() => { if (!cancelled) setRepsLoading(false); });

    return () => { cancelled = true; };
  }, [zip, rep_level, repsUrl]);

  function markCalled(repName: string) {
    setCompletedCalls((prev) => {
      const next = new Set(prev);
      next.add(repName);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const fieldErrors: Record<string, string> = {};
    if (!firstName.trim()) fieldErrors.first_name = t(locale, "required_field");
    if (!lastName.trim()) fieldErrors.last_name = t(locale, "required_field");
    if (!email.trim()) fieldErrors.email = t(locale, "required_field");
    else if (!EMAIL_RE.test(email)) fieldErrors.email = t(locale, "invalid_email");
    if (!zip.trim()) fieldErrors.zip = t(locale, "required_field");
    else if (!ZIP_RE.test(zip)) fieldErrors.zip = "Enter a valid 5-digit zip";
    if (completedCalls.size === 0) fieldErrors.calls = "Please make at least one call before submitting";

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

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "call_made",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            zip: zip.trim(),
            rep_names: Array.from(completedCalls).join(", "),
            calls_completed: completedCalls.size,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "call_made",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        zip: zip.trim(),
        rep_names: Array.from(completedCalls),
        calls_completed: completedCalls.size,
      });
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
    <form onSubmit={handleSubmit} noValidate style={{ padding: "1.5rem", maxWidth: "42em" }}>
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
          Call {target}
        </p>
      )}

      {/* Script */}
      <div
        style={{
          padding: "1.25rem",
          marginBottom: "1.5rem",
          border: `1px solid ${s.border}`,
          borderRadius: s.radius,
        }}
      >
        <p style={{ ...label, marginBottom: "0.75rem" }}>Your script</p>
        <p style={{ fontFamily: s.serif, fontSize: "1rem", color: s.text, lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>
          {script}
        </p>
      </div>

      {talking_points && talking_points.length > 0 && (
        <aside style={{ padding: "1rem 1.25rem", border: `1px solid ${s.border}`, borderRadius: s.radius, marginBottom: "1.5rem" }}>
          <p style={{ ...label, marginBottom: "0.75rem" }}>Key talking points</p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: s.text, fontSize: "0.95rem", lineHeight: 1.6 }}>
            {talking_points.map((point, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>{point}</li>
            ))}
          </ul>
        </aside>
      )}

      {/* Identity fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.5rem" }}>
        <div>
          <label htmlFor="call-first" style={label}>{t(locale, "petition_first_name")}</label>
          <input
            id="call-first"
            type="text"
            autoComplete="given-name"
            aria-invalid={!!errors.first_name}
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, first_name: "" })); }}
            style={{ ...input, borderBottomColor: errors.first_name ? s.accent : undefined }}
          />
          <div role="alert" aria-live="polite" style={err}>{errors.first_name ?? ""}</div>
        </div>
        <div>
          <label htmlFor="call-last" style={label}>{t(locale, "petition_last_name")}</label>
          <input
            id="call-last"
            type="text"
            autoComplete="family-name"
            aria-invalid={!!errors.last_name}
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, last_name: "" })); }}
            style={{ ...input, borderBottomColor: errors.last_name ? s.accent : undefined }}
          />
          <div role="alert" aria-live="polite" style={err}>{errors.last_name ?? ""}</div>
        </div>
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="call-email" style={label}>{t(locale, "petition_email")}</label>
        <input
          id="call-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
          style={{ ...input, borderBottomColor: errors.email ? s.accent : undefined }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors.email ?? ""}</div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="call-zip" style={label}>{t(locale, "petition_zip")}</label>
        <input
          id="call-zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          aria-invalid={!!errors.zip}
          value={zip}
          onChange={(e) => { setZip(e.target.value); setErrors((p) => ({ ...p, zip: "" })); }}
          style={{ ...input, borderBottomColor: errors.zip ? s.accent : undefined, maxWidth: "12rem" }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors.zip ?? ""}</div>
      </div>

      {/* Reps with call buttons */}
      {repsLoading && (
        <p style={{ fontFamily: s.mono, fontSize: "0.8rem", color: s.secondary, marginBottom: "1rem" }}>
          Looking up your representatives…
        </p>
      )}
      {reps.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ ...label, marginBottom: "0.75rem" }}>Your representatives — tap to call</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {reps.map((r, i) => {
              const phone = r.phones[0]!;
              const called = completedCalls.has(r.name);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    border: `1.5px solid ${called ? s.accent : s.border}`,
                    borderRadius: s.radius,
                    transition: "border-color 150ms ease",
                  }}
                >
                  {r.photoUrl && (
                    <img
                      src={r.photoUrl}
                      alt=""
                      width={44}
                      height={44}
                      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: s.serif, fontSize: "1rem", color: s.text, fontWeight: 600, lineHeight: 1.2 }}>
                      {r.name}
                      {r.party && <span style={{ color: s.secondary, marginLeft: "0.35rem", fontWeight: 400 }}>({r.party[0]})</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: s.secondary, fontFamily: s.mono, marginTop: "0.1rem" }}>{r.office}</div>
                    <div style={{ fontSize: "0.78rem", color: s.text, fontFamily: s.mono, marginTop: "0.2rem" }}>{phone}</div>
                  </div>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    onClick={() => markCalled(r.name)}
                    style={{
                      padding: "0.625rem 1rem",
                      fontFamily: s.serif,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: called ? s.text : s.bg,
                      background: called ? "transparent" : s.accent,
                      border: `1.5px solid ${s.accent}`,
                      borderRadius: s.radius,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      minHeight: "44px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {called ? "✓ Called" : "Call"}
                  </a>
                </div>
              );
            })}
          </div>
          {errors.calls && (
            <div role="alert" aria-live="polite" style={{ ...err, marginTop: "0.5rem" }}>{errors.calls}</div>
          )}
        </div>
      )}

      {turnstileSiteKey && (
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {serverError && (
        <p role="alert" aria-live="polite" style={{ fontFamily: s.mono, fontSize: "0.78rem", color: s.accent, marginBottom: "1rem" }}>
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          ...submitButtonStyle,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Recording…" : `Record my ${completedCalls.size} call${completedCalls.size !== 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
