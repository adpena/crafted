import { useId, useState, type CSSProperties } from "react";
import { Field, inputStyle } from "./Field.tsx";

export interface SecretInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  placeholder?: string;
  /** When true, the value is treated as already-set and rendered masked until edited. */
  isSet?: boolean;
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: "0.5rem",
};

const inputWrapperStyle: CSSProperties = {
  flex: 1,
  position: "relative",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 0.875rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--page-text, #1a1a1a)",
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "2px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const indicatorStyle = (isSet: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.65rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: isSet ? "#15803d" : "var(--page-secondary, #6b6b6b)",
});

const dotStyle = (isSet: boolean): CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: isSet ? "#22c55e" : "#9ca3af",
  display: "inline-block",
});

export function SecretInput({
  label,
  value,
  onChange,
  helper,
  placeholder,
  isSet,
}: SecretInputProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasValue = value.length > 0 || Boolean(isSet);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <Field
      label={label}
      htmlFor={id}
      helper={helper}
      rightLabel={
        <span style={indicatorStyle(hasValue)} aria-label={hasValue ? "Configured" : "Not configured"}>
          <span aria-hidden style={dotStyle(hasValue)} />
          {hasValue ? "Set" : "Empty"}
        </span>
      }
    >
      <div style={rowStyle}>
        <div style={inputWrapperStyle}>
          <input
            id={id}
            type={reveal ? "text" : "password"}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            style={inputStyle()}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => setReveal((prev) => !prev)}
          aria-pressed={reveal}
          aria-label={reveal ? "Hide secret" : "Show secret"}
        >
          {reveal ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={copy}
          disabled={!value}
          aria-label="Copy secret to clipboard"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Field>
  );
}

export default SecretInput;
