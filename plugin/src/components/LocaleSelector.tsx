import type { CSSProperties } from "react";
import type { Locale } from "../lib/i18n.ts";

export type LocaleSelectorProps = {
  locale: Locale;
  onChange: (locale: Locale) => void;
};

const containerStyle: CSSProperties = {
  position: "absolute",
  top: "0.75rem",
  right: "0.75rem",
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.72rem",
  lineHeight: 1,
  color: "var(--page-secondary)",
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
};

const activeStyle: CSSProperties = {
  fontWeight: 700,
  color: "var(--page-text)",
  cursor: "default",
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: "inherit",
  fontSize: "inherit",
};

const inactiveStyle: CSSProperties = {
  fontWeight: 400,
  color: "var(--page-secondary)",
  cursor: "pointer",
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: "inherit",
  fontSize: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

export function LocaleSelector({ locale, onChange }: LocaleSelectorProps) {
  return (
    <div style={containerStyle}>
      <button
        type="button"
        style={locale === "en" ? activeStyle : inactiveStyle}
        onClick={() => onChange("en")}
        aria-label="Switch to English"
        aria-current={locale === "en" ? "true" : undefined}
      >
        English
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        style={locale === "es" ? activeStyle : inactiveStyle}
        onClick={() => onChange("es")}
        aria-label="Cambiar a español"
        aria-current={locale === "es" ? "true" : undefined}
      >
        Español
      </button>
    </div>
  );
}
