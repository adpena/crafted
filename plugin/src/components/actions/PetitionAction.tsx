import { useState, type ReactNode, type FormEvent } from "react";
import { tokens as s } from "./tokens.ts";
import { t, getLocale, type Locale } from "../../lib/i18n.ts";

export interface PetitionActionProps {
  target?: string;
  goal?: number;
  show_count?: boolean;
  signatureCount?: number;
  onComplete: (data: {
    type: "petition_sign";
    first_name: string;
    last_name: string;
    email: string;
    zip: string;
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

/** Shared tokens */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldLabel(text: string): React.CSSProperties {
  return {
    display: "block",
    fontFamily: s.mono,
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: s.secondary,
    marginBottom: "0.25rem",
  };
}

function fieldInput(): React.CSSProperties {
  return {
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
}

function errorText(): React.CSSProperties {
  return {
    fontFamily: s.mono,
    fontSize: "0.7rem",
    color: s.accent,
    marginTop: "0.25rem",
    minHeight: "1rem",
  };
}

export function PetitionAction({
  target,
  goal,
  show_count,
  signatureCount,
  onComplete,
  page_id: pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
}: PetitionActionProps): ReactNode {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    zip: "",
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
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.last_name.trim()) e.last_name = "Last name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(form.email)) e.email = "Enter a valid email";
    if (!form.zip.trim()) e.zip = "Zip code is required";
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
          type: "petition_sign",
          page_id: pageId,
          visitorId,
          variant,
          data: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            zip: form.zip.trim(),
            comment: form.comment.trim() || undefined,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }

      onComplete({
        type: "petition_sign",
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        zip: form.zip.trim(),
      });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Something went wrong",
      );
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
          Tell {target}:
        </p>
      )}

      {/* Signature count */}
      {show_count && signatureCount != null && (
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
          <label style={fieldLabel("First name")}>First name</label>
          <input
            type="text"
            autoComplete="given-name"
            value={form.first_name}
            onChange={set("first_name")}
            style={{
              ...fieldInput(),
              borderBottomColor: errors.first_name ? s.accent : undefined,
            }}
          />
          <div style={errorText()}>{errors.first_name ?? ""}</div>
        </div>
        <div>
          <label style={fieldLabel("Last name")}>Last name</label>
          <input
            type="text"
            autoComplete="family-name"
            value={form.last_name}
            onChange={set("last_name")}
            style={{
              ...fieldInput(),
              borderBottomColor: errors.last_name ? s.accent : undefined,
            }}
          />
          <div style={errorText()}>{errors.last_name ?? ""}</div>
        </div>
      </div>

      {/* Email */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label style={fieldLabel("Email")}>Email</label>
        <input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          style={{
            ...fieldInput(),
            borderBottomColor: errors.email ? s.accent : undefined,
          }}
        />
        <div style={errorText()}>{errors.email ?? ""}</div>
      </div>

      {/* Zip */}
      <div style={{ marginBottom: "0.5rem" }}>
        <label style={fieldLabel("Zip")}>Zip code</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          value={form.zip}
          onChange={set("zip")}
          style={{
            ...fieldInput(),
            borderBottomColor: errors.zip ? s.accent : undefined,
            maxWidth: "10rem",
          }}
        />
        <div style={errorText()}>{errors.zip ?? ""}</div>
      </div>

      {/* Comment */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={fieldLabel("Comment (optional)")}>
          Comment (optional)
        </label>
        <textarea
          value={form.comment}
          onChange={set("comment")}
          maxLength={1000}
          rows={3}
          style={{
            ...fieldInput(),
            resize: "vertical" as const,
            minHeight: "60px",
            lineHeight: 1.5,
          }}
        />
      </div>

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
        {loading ? "Signing..." : "Add your name"}
      </button>
    </form>
  );
}
