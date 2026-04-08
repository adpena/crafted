import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle as label, errorStyle as err, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { Representative } from "../../lib/reps-types.ts";

export interface LetterActionProps {
  /** Subject line for the letter */
  subject: string;
  /** Editable default letter body — may include merge fields like {{rep_name}} */
  letter_template: string;
  /** Restrict to specific representative level (default: both chambers) */
  rep_level?: "senate" | "house" | "both";
  /** Optional talking points displayed alongside the letter */
  talking_points?: string[];
  turnstileSiteKey?: string;
  onComplete: (data: {
    type: "letter_sent";
    first_name: string;
    last_name: string;
    email: string;
    zip: string;
    letter_subject: string;
    letter_body: string;
    rep_names: string[];
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
 * Letter-to-Congress action component.
 *
 * Flow:
 *  1. User enters name + email + zip
 *  2. On zip change, we fetch representatives from /api/action/reps
 *  3. Letter template is merged with rep names
 *  4. User edits the letter
 *  5. Submit POSTs to /api/action/submit with type="letter_sent"
 *
 * This is the killer feature that puts Crafted at parity with Action Network's
 * Letter Campaign tool and 5-Calls.
 */
export function LetterAction({
  subject,
  letter_template,
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
}: LetterActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const turnstile = useTurnstile(turnstileSiteKey);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [reps, setReps] = useState<Representative[]>([]);
  const [repsLoading, setRepsLoading] = useState(false);
  const [letterBody, setLetterBody] = useState(letter_template);
  const [letterSubject, setLetterSubject] = useState(subject);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  // When zip changes and is valid, fetch reps and merge into letter
  useEffect(() => {
    if (!ZIP_RE.test(zip)) {
      setReps([]);
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
          if (rep_level === "senate") return /senator|senate/i.test(r.office);
          if (rep_level === "house") return /representative|house/i.test(r.office);
          return true;
        });
        setReps(filtered);

        // Merge rep names into letter template
        if (filtered.length > 0) {
          const repNames = filtered.map((r) => r.name).join(", ");
          const firstRep = filtered[0]?.name ?? "";
          const merged = letter_template
            .replace(/\{\{rep_names\}\}/g, repNames)
            .replace(/\{\{rep_name\}\}/g, firstRep);
          setLetterBody(merged);
        }
      })
      .catch(() => { if (!cancelled) setReps([]); })
      .finally(() => { if (!cancelled) setRepsLoading(false); });

    return () => { cancelled = true; };
  }, [zip, letter_template, rep_level, repsUrl]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.first_name = t(locale, "required_field");
    if (!lastName.trim()) e.last_name = t(locale, "required_field");
    if (!email.trim()) e.email = t(locale, "required_field");
    else if (!EMAIL_RE.test(email)) e.email = t(locale, "invalid_email");
    if (!zip.trim()) e.zip = t(locale, "required_field");
    else if (!ZIP_RE.test(zip)) e.zip = "Enter a valid 5-digit zip";
    if (!letterBody.trim()) e.letter = "Letter cannot be empty";
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

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "letter_sent",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            zip: zip.trim(),
            letter_subject: letterSubject.trim(),
            letter_body: letterBody.trim(),
            rep_names: reps.map((r) => r.name).join(", "),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      onComplete({
        type: "letter_sent",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        zip: zip.trim(),
        letter_subject: letterSubject.trim(),
        letter_body: letterBody.trim(),
        rep_names: reps.map((r) => r.name),
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
    borderRadius: 0,
    padding: "0.5rem 0",
    minHeight: "44px",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ padding: "1.5rem", maxWidth: "42em" }}>
      {/* Talking points */}
      {talking_points && talking_points.length > 0 && (
        <aside
          style={{
            padding: "1rem 1.25rem",
            background: "transparent",
            border: `1px solid ${s.border}`,
            borderRadius: s.radius,
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ ...label, marginBottom: "0.75rem" }}>Key talking points</p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: s.text, fontSize: "0.95rem", lineHeight: 1.6 }}>
            {talking_points.map((point, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>{point}</li>
            ))}
          </ul>
        </aside>
      )}

      {/* Name row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.5rem" }}>
        <div>
          <label htmlFor="letter-first-name" style={label}>{t(locale, "petition_first_name")}</label>
          <input
            id="letter-first-name"
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
          <label htmlFor="letter-last-name" style={label}>{t(locale, "petition_last_name")}</label>
          <input
            id="letter-last-name"
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

      {/* Email */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="letter-email" style={label}>{t(locale, "petition_email")}</label>
        <input
          id="letter-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
          style={{ ...input, borderBottomColor: errors.email ? s.accent : undefined }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors.email ?? ""}</div>
      </div>

      {/* Zip */}
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="letter-zip" style={label}>{t(locale, "petition_zip")}</label>
        <input
          id="letter-zip"
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

      {/* Representatives preview */}
      {repsLoading && (
        <p style={{ fontFamily: s.mono, fontSize: "0.8rem", color: s.secondary, marginBottom: "1rem" }}>
          Looking up your representatives…
        </p>
      )}
      {reps.length > 0 && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: "transparent",
            border: `1px solid ${s.border}`,
            borderRadius: s.radius,
          }}
        >
          <p style={{ ...label, marginBottom: "0.75rem" }}>Your letter will be sent to</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {reps.map((r, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.375rem 0" }}>
                {r.photoUrl && (
                  <img
                    src={r.photoUrl}
                    alt=""
                    width={32}
                    height={32}
                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <div style={{ fontFamily: s.serif, fontSize: "0.95rem", color: s.text, lineHeight: 1.3 }}>
                  <strong>{r.name}</strong>
                  {r.party && <span style={{ color: s.secondary, marginLeft: "0.35rem" }}>({r.party[0]})</span>}
                  <div style={{ fontSize: "0.78rem", color: s.secondary, fontFamily: s.mono }}>{r.office}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Letter subject */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="letter-subject" style={label}>Subject</label>
        <input
          id="letter-subject"
          type="text"
          value={letterSubject}
          onChange={(e) => setLetterSubject(e.target.value)}
          maxLength={200}
          style={input}
        />
      </div>

      {/* Letter body */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label htmlFor="letter-body" style={label}>Your message</label>
        <textarea
          id="letter-body"
          value={letterBody}
          onChange={(e) => { setLetterBody(e.target.value); setErrors((p) => ({ ...p, letter: "" })); }}
          rows={10}
          maxLength={5000}
          aria-invalid={!!errors.letter}
          style={{
            ...input,
            minHeight: "240px",
            resize: "vertical",
            lineHeight: 1.6,
            fontSize: "1rem",
            padding: "0.75rem",
            border: `1px solid ${s.border}`,
            borderRadius: s.radius,
          }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors.letter ?? ""}</div>
        <p style={{ fontFamily: s.mono, fontSize: "0.7rem", color: s.secondary, marginTop: "0.25rem" }}>
          {letterBody.length} / 5000 characters
        </p>
      </div>

      {/* Turnstile */}
      {turnstileSiteKey && (
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <p role="alert" aria-live="polite" style={{ fontFamily: s.mono, fontSize: "0.78rem", color: s.accent, marginBottom: "1rem" }}>
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
        {loading ? "Sending…" : "Send letter"}
      </button>
    </form>
  );
}
