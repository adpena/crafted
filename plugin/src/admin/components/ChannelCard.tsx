import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

export interface ChannelCardProps {
  id: string;
  name: string;
  icon: ReactNode;
  description?: string;
  /** Whether the channel has all required credentials filled in. */
  configured: boolean;
  /** Whether the channel is enabled (sends notifications). */
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  /** Fields rendered when the card is expanded. */
  children: ReactNode;
  /** Test handler — receives the channel id. Should return the test promise. */
  onTest: () => Promise<void> | void;
  /** Documentation URL for the adapter. */
  docsUrl: string;
  /** When true, the card starts expanded. */
  defaultExpanded?: boolean;
  /** External flag to force the card open (e.g. when a preset highlights it). */
  highlight?: boolean;
}

const cardStyle = (highlight: boolean): CSSProperties => ({
  border: `1px solid ${highlight ? "#1a1a1a" : "var(--page-border, #d4d4c8)"}`,
  borderRadius: "4px",
  padding: "1.25rem 1.5rem",
  background: "var(--page-surface, #faf9f5)",
  transition: "border-color 120ms ease, box-shadow 120ms ease",
  boxShadow: highlight ? "0 0 0 3px rgba(26,26,26,0.08)" : "none",
});

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  flexWrap: "wrap",
};

const iconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "4px",
  background: "var(--page-bg, #fff)",
  border: "1px solid var(--page-border, #d4d4c8)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.1rem",
  flexShrink: 0,
};

const titleColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  flex: 1,
  minWidth: "180px",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.15rem",
  fontWeight: 500,
  margin: 0,
  color: "var(--page-text, #1a1a1a)",
};

const descStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.85rem",
  lineHeight: 1.4,
  color: "var(--page-secondary, #6b6b6b)",
  margin: 0,
  fontStyle: "italic",
};

const statusRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.65rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const dotStyle = (configured: boolean): CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: configured ? "#22c55e" : "#9ca3af",
});

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 1rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--page-text, #1a1a1a)",
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "2px",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "var(--page-text, #1a1a1a)",
  color: "var(--page-bg, #fff)",
  borderColor: "var(--page-text, #1a1a1a)",
};

const togglePillStyle = (enabled: boolean): CSSProperties => ({
  width: "44px",
  height: "24px",
  borderRadius: "12px",
  border: "1px solid var(--page-border, #d4d4c8)",
  background: enabled ? "#1a1a1a" : "transparent",
  position: "relative",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
});

const toggleKnobStyle = (enabled: boolean): CSSProperties => ({
  position: "absolute",
  top: "1px",
  left: enabled ? "21px" : "1px",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: enabled ? "#fff" : "#9ca3af",
  transition: "left 120ms ease",
});

const docsLinkStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-text, #1a1a1a)",
  textDecoration: "underline",
};

const expandedStyle: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.25rem",
  borderTop: "1px solid var(--page-border, #d4d4c8)",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const testStatusStyle = (status: "idle" | "running" | "ok" | "error"): CSSProperties => ({
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.05em",
  color:
    status === "ok"
      ? "#15803d"
      : status === "error"
        ? "#dc2626"
        : "var(--page-secondary, #6b6b6b)",
});

export function ChannelCard({
  id,
  name,
  icon,
  description,
  configured,
  enabled,
  onToggleEnabled,
  children,
  onTest,
  docsUrl,
  defaultExpanded = false,
  highlight = false,
}: ChannelCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || highlight);
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
  const panelId = useId();

  // Open the panel when highlight flips on.
  useEffect(() => {
    if (highlight) {
      setExpanded(true);
    }
  }, [highlight]);

  async function runTest() {
    setTestStatus("running");
    try {
      await onTest();
      setTestStatus("ok");
    } catch {
      setTestStatus("error");
    }
  }

  return (
    <article id={`channel-${id}`} style={cardStyle(highlight)} aria-labelledby={`${panelId}-title`}>
      <div style={headerStyle}>
        <span aria-hidden style={iconStyle}>
          {icon}
        </span>
        <div style={titleColumnStyle}>
          <h3 id={`${panelId}-title`} style={titleStyle}>
            {name}
          </h3>
          {description && <p style={descStyle}>{description}</p>}
          <div style={statusRowStyle}>
            <span aria-hidden style={dotStyle(configured)} />
            <span
              aria-label={
                configured ? `${name} is configured` : `${name} is not configured`
              }
              style={{ color: configured ? "#15803d" : "var(--page-secondary, #6b6b6b)" }}
            >
              {configured ? "Configured" : "Not configured"}
            </span>
          </div>
        </div>
        <div style={actionsStyle}>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-pressed={enabled}
            aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
            style={togglePillStyle(enabled)}
            onClick={() => onToggleEnabled(!enabled)}
          >
            <span aria-hidden style={toggleKnobStyle(enabled)} />
          </button>
          <button
            type="button"
            style={buttonStyle}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Close" : "Configure"}
          </button>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={runTest}
            disabled={testStatus === "running" || !configured}
            aria-label={`Send test message via ${name}`}
          >
            {testStatus === "running" ? "Sending…" : "Test"}
          </button>
          <a href={docsUrl} target="_blank" rel="noreferrer noopener" style={docsLinkStyle}>
            Docs ↗
          </a>
        </div>
      </div>
      {testStatus !== "idle" && (
        <p style={{ ...testStatusStyle(testStatus), marginTop: "0.75rem", marginBottom: 0 }}>
          {testStatus === "running" && "Dispatching test…"}
          {testStatus === "ok" && "Test request completed — see result panel below."}
          {testStatus === "error" && "Test failed — see result panel below."}
        </p>
      )}
      {expanded && (
        <div id={panelId} style={expandedStyle}>
          {children}
        </div>
      )}
    </article>
  );
}

export default ChannelCard;
