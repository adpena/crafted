import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { labelStyle as label, errorStyle as err, submitButtonStyle } from "./form-styles.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";

export interface EventRsvpActionProps {
  event_name: string;
  event_date: string; // ISO string
  event_location: string;
  event_description?: string;
  capacity?: number;
  allow_guests?: boolean;
  /** Download an .ics calendar file on successful submit */
  offer_calendar?: boolean;
  /**
   * External event platform IDs. When set, RSVPs sync to those platforms
   * via the post-submit integrations pipeline. Multiple can be set at once.
   */
  event_ids?: {
    mobilize?: string;
    eventbrite?: string;
    facebook?: string;
  };
  /**
   * External event URLs — shown as "also on Eventbrite / Facebook" links
   * so users on other platforms can find the event where they prefer.
   */
  event_urls?: {
    eventbrite?: string;
    facebook?: string;
    mobilize?: string;
  };
  turnstileSiteKey?: string;
  onComplete: (data: {
    type: "event_rsvp";
    first_name: string;
    last_name: string;
    email: string;
    guest_count?: number;
    notes?: string;
  }) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
  submitUrl?: string;
  locale?: Locale;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Event RSVP action — collects attendee info, optional guest count + notes.
 * Generates an .ics calendar file after successful submission.
 */
export function EventRsvpAction({
  event_name,
  event_date,
  event_location,
  event_description,
  allow_guests = false,
  offer_calendar = true,
  event_ids,
  event_urls,
  turnstileSiteKey,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
  locale: localeProp,
}: EventRsvpActionProps): ReactNode {
  const locale = getLocale(localeProp);
  const turnstile = useTurnstile(turnstileSiteKey);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [completed, setCompleted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors: Record<string, string> = {};
    if (!firstName.trim()) fieldErrors.first_name = t(locale, "required_field");
    if (!lastName.trim()) fieldErrors.last_name = t(locale, "required_field");
    if (!email.trim()) fieldErrors.email = t(locale, "required_field");
    else if (!EMAIL_RE.test(email)) fieldErrors.email = t(locale, "invalid_email");
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
          type: "event_rsvp",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          event_ids,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            guest_count: allow_guests ? guestCount : undefined,
            notes: notes.trim() || undefined,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`Server error (${res.status})`);

      setCompleted(true);
      onComplete({
        type: "event_rsvp",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        guest_count: allow_guests ? guestCount : undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      setServerError(isTimeout ? "Request timed out. Please try again." : (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  function downloadIcs() {
    const dt = new Date(event_date);
    const startUtc = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endUtc = new Date(dt.getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const uid = `${pageId}-${Date.now()}@crafted`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Crafted Action Pages//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${startUtc}`,
      `DTSTART:${startUtc}`,
      `DTEND:${endUtc}`,
      `SUMMARY:${icsEscape(event_name)}`,
      `LOCATION:${icsEscape(event_location)}`,
      event_description ? `DESCRIPTION:${icsEscape(event_description)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // iOS Safari ignores a.download and opens blob URLs inline.
    // Use window.open for iOS so the native Calendar import dialog fires.
    const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) {
      window.open(url, "_blank");
      // Don't revoke immediately — iOS needs the URL alive long enough to load
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `${event_name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (completed) {
    return (
      <div style={{ padding: "1.5rem", maxWidth: "42em", textAlign: "center" }}>
        <h2 style={{ fontFamily: s.serif, fontSize: "1.75rem", color: s.text, margin: "0 0 0.75rem" }}>
          You're in!
        </h2>
        <p style={{ fontFamily: s.serif, fontSize: "1.05rem", color: s.secondary, lineHeight: 1.5, marginBottom: "1.5rem" }}>
          We've got your RSVP for <strong>{event_name}</strong>. See you there.
        </p>
        {offer_calendar && (
          <button
            type="button"
            onClick={downloadIcs}
            style={{
              padding: "0.75rem 1.5rem",
              fontFamily: s.serif,
              fontSize: "1rem",
              fontWeight: 600,
              color: s.text,
              background: "transparent",
              border: `1.5px solid ${s.border}`,
              borderRadius: s.radius,
              cursor: "pointer",
            }}
          >
            Add to calendar
          </button>
        )}
      </div>
    );
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
      {/* Event card */}
      <div
        style={{
          padding: "1.25rem",
          marginBottom: "1.5rem",
          border: `1px solid ${s.border}`,
          borderRadius: s.radius,
        }}
      >
        <p style={{ ...label, marginBottom: "0.5rem" }}>Event details</p>
        <div style={{ fontFamily: s.serif, fontSize: "1.15rem", color: s.text, fontWeight: 600, marginBottom: "0.5rem" }}>
          {event_name}
        </div>
        <div style={{ fontFamily: s.serif, fontSize: "0.95rem", color: s.secondary, lineHeight: 1.5 }}>
          {new Date(event_date).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
        <div style={{ fontFamily: s.serif, fontSize: "0.95rem", color: s.secondary, lineHeight: 1.5 }}>
          {event_location}
        </div>
        {event_description && (
          <p style={{ fontFamily: s.serif, fontSize: "0.95rem", color: s.text, lineHeight: 1.6, marginTop: "0.75rem", marginBottom: 0 }}>
            {event_description}
          </p>
        )}

        {/* Cross-platform links — show "also on" chips for Eventbrite / FB / Mobilize */}
        {event_urls && (event_urls.eventbrite || event_urls.facebook || event_urls.mobilize) && (
          <div style={{ marginTop: "0.875rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {event_urls.eventbrite && (
              <a href={event_urls.eventbrite} target="_blank" rel="noopener noreferrer" style={crossLink(s)}>
                Eventbrite
              </a>
            )}
            {event_urls.facebook && (
              <a href={event_urls.facebook} target="_blank" rel="noopener noreferrer" style={crossLink(s)}>
                Facebook
              </a>
            )}
            {event_urls.mobilize && (
              <a href={event_urls.mobilize} target="_blank" rel="noopener noreferrer" style={crossLink(s)}>
                Mobilize
              </a>
            )}
          </div>
        )}
      </div>

      {/* Name row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.5rem" }}>
        <div>
          <label htmlFor="rsvp-first" style={label}>{t(locale, "petition_first_name")}</label>
          <input
            id="rsvp-first"
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
          <label htmlFor="rsvp-last" style={label}>{t(locale, "petition_last_name")}</label>
          <input
            id="rsvp-last"
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
        <label htmlFor="rsvp-email" style={label}>{t(locale, "petition_email")}</label>
        <input
          id="rsvp-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
          style={{ ...input, borderBottomColor: errors.email ? s.accent : undefined }}
        />
        <div role="alert" aria-live="polite" style={err}>{errors.email ?? ""}</div>
      </div>

      {/* Guests */}
      {allow_guests && (
        <div style={{ marginBottom: "0.5rem" }}>
          <label htmlFor="rsvp-guests" style={label}>Number of guests</label>
          <input
            id="rsvp-guests"
            type="number"
            min={0}
            max={10}
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 0)}
            style={{ ...input, maxWidth: "8rem" }}
          />
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label htmlFor="rsvp-notes" style={label}>Notes (optional)</label>
        <textarea
          id="rsvp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Accessibility needs, dietary restrictions, etc."
          style={{
            ...input,
            resize: "vertical",
            minHeight: "60px",
            lineHeight: 1.5,
          }}
        />
      </div>

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
        {loading ? "Submitting…" : "RSVP"}
      </button>
    </form>
  );
}

function icsEscape(s: string): string {
  // Strip CR first (RFC 5545 line terminator) to prevent ICS header injection,
  // then escape backslash, semicolon, comma, and newline per spec.
  return s
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function crossLink(s: typeof import("./tokens.ts").tokens): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "0.35rem 0.75rem",
    fontFamily: s.mono,
    fontSize: "0.7rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: s.text,
    background: "transparent",
    border: `1px solid ${s.border}`,
    borderRadius: s.radius,
    textDecoration: "none",
    transition: "border-color 150ms ease",
  };
}
