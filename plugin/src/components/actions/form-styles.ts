import type { CSSProperties } from "react";
import { tokens as s } from "./tokens.ts";

export const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: s.mono,
  fontSize: "0.72rem",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: s.secondary,
  marginBottom: "0.25rem",
};

export const inputStyle: CSSProperties = {
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
  transition: "border-color 150ms ease",
  boxSizing: "border-box" as const,
};

export const errorStyle: CSSProperties = {
  fontFamily: s.mono,
  fontSize: "0.7rem",
  color: s.accent,
  marginTop: "0.25rem",
  minHeight: "1rem",
};

export const submitButtonStyle: CSSProperties = {
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
  cursor: "pointer",
  transition: "opacity 150ms ease",
};
