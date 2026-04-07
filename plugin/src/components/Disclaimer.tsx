import type { CSSProperties } from "react";

export type DisclaimerProps = {
  committee_name: string;
  treasurer_name?: string;
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

export function Disclaimer({ committee_name, treasurer_name }: DisclaimerProps) {
  // FEC compliance: don't render a broken "Paid for by" with no name
  if (!committee_name?.trim()) return null;

  return (
    <footer style={containerStyle}>
      <p>Paid for by {committee_name}</p>
      {treasurer_name?.trim() && (
        <p>{treasurer_name}, Treasurer</p>
      )}
    </footer>
  );
}
