import type { CSSProperties } from "react";
import { t, getLocale, type Locale } from "../lib/i18n.ts";

export type DisclaimerProps = {
  committee_name: string;
  treasurer_name?: string;
  locale?: Locale;
};

const containerStyle: CSSProperties = {
  marginTop: "2rem",
  paddingTop: "1rem",
  borderTop: "1px solid var(--page-border)",
  color: "var(--page-secondary)",
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.75rem",
  lineHeight: 1.5,
  textAlign: "center",
};

export function Disclaimer({ committee_name, treasurer_name, locale: localeProp }: DisclaimerProps) {
  // FEC compliance: don't render a broken "Paid for by" with no name
  if (!committee_name?.trim()) return null;

  const locale = getLocale(localeProp);

  return (
    <footer style={containerStyle}>
      <p>{t(locale, "paid_for_by")} {committee_name}</p>
      {treasurer_name?.trim() && (
        <p>{treasurer_name}, {t(locale, "treasurer")}</p>
      )}
    </footer>
  );
}
