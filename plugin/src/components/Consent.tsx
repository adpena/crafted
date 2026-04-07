import type { CSSProperties } from "react";
import { t, getLocale, type Locale } from "../lib/i18n.ts";

export type ConsentProps = {
  locale?: Locale;
  privacy_url?: string;
  required?: boolean;
};

const containerStyle: CSSProperties = {
  marginTop: "1rem",
  color: "var(--page-secondary)",
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.72rem",
  lineHeight: 1.5,
};

const linkStyle: CSSProperties = {
  color: "var(--page-secondary)",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const checkboxStyle: CSSProperties = {
  marginRight: "0.5rem",
  verticalAlign: "middle",
};

export function Consent({ locale: localeProp, privacy_url, required }: ConsentProps) {
  const locale = getLocale(localeProp);
  const collectionText = t(locale, "consent_data_collection");
  const policyText = t(locale, "consent_privacy_policy");

  const policyLink = privacy_url ? (
    <a href={privacy_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
      {policyText}
    </a>
  ) : (
    <span>{policyText}</span>
  );

  if (required) {
    return (
      <div style={containerStyle}>
        <label style={{ display: "flex", alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            name="consent"
            required
            style={checkboxStyle}
          />
          <span>
            {collectionText} {policyLink}.
          </span>
        </label>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <p style={{ margin: 0 }}>
        {collectionText} {policyLink}.
      </p>
    </div>
  );
}
