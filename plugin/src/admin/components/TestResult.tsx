import type { CSSProperties } from "react";

export interface TestResultData {
  sent: string[];
  failed: string[];
  skipped: string[];
  timestamp?: string;
}

export interface TestResultProps {
  result: TestResultData | null;
  isLoading?: boolean;
  error?: string | null;
}

const wrapperStyle: CSSProperties = {
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "4px",
  padding: "1rem 1.25rem",
  background: "var(--page-surface, #faf9f5)",
};

const timestampStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.05em",
  color: "var(--page-secondary, #6b6b6b)",
  margin: "0 0 0.75rem 0",
};

const groupRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.375rem",
};

function badge(color: string, bg: string): CSSProperties {
  return {
    display: "inline-block",
    padding: "0.25rem 0.625rem",
    fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
    fontSize: "0.7rem",
    borderRadius: "2px",
    border: `1px solid ${color}`,
    color,
    background: bg,
  };
}

const emptyStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontStyle: "italic",
  color: "var(--page-secondary, #6b6b6b)",
  fontSize: "0.85rem",
  margin: 0,
};

export function TestResult({ result, isLoading, error }: TestResultProps) {
  if (isLoading) {
    return (
      <div style={wrapperStyle} role="status" aria-live="polite">
        <p style={emptyStyle}>Sending test notification…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...wrapperStyle, borderColor: "#dc2626" }} role="alert">
        <p style={{ ...groupHeaderStyle, color: "#dc2626" }}>Dispatch error</p>
        <p style={{ ...emptyStyle, color: "#dc2626", fontStyle: "normal" }}>{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={wrapperStyle}>
        <p style={emptyStyle}>No tests run yet. Press a test button above to dispatch a sample message.</p>
      </div>
    );
  }

  return (
    <div style={wrapperStyle} role="status" aria-live="polite">
      {result.timestamp && (
        <p style={timestampStyle}>
          Last run: <time dateTime={result.timestamp}>{new Date(result.timestamp).toLocaleString()}</time>
        </p>
      )}
      <div style={groupRowStyle}>
        <div>
          <p style={{ ...groupHeaderStyle, color: "#15803d" }}>
            <span aria-hidden>●</span> Sent ({result.sent.length})
          </p>
          <div style={badgeRowStyle}>
            {result.sent.length === 0 ? (
              <p style={emptyStyle}>None</p>
            ) : (
              result.sent.map((name) => (
                <span key={name} style={badge("#15803d", "#dcfce7")}>
                  {name}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <p style={{ ...groupHeaderStyle, color: "#dc2626" }}>
            <span aria-hidden>●</span> Failed ({result.failed.length})
          </p>
          <div style={badgeRowStyle}>
            {result.failed.length === 0 ? (
              <p style={emptyStyle}>None</p>
            ) : (
              result.failed.map((name) => (
                <span key={name} style={badge("#dc2626", "#fee2e2")}>
                  {name}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <p style={{ ...groupHeaderStyle, color: "#6b6b6b" }}>
            <span aria-hidden>●</span> Skipped ({result.skipped.length})
          </p>
          <div style={badgeRowStyle}>
            {result.skipped.length === 0 ? (
              <p style={emptyStyle}>None</p>
            ) : (
              result.skipped.map((name) => (
                <span key={name} style={badge("#6b6b6b", "#f3f4f6")}>
                  {name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestResult;
