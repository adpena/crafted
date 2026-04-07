import { useState, type ReactNode } from "react";
import { tokens as s } from "./tokens.ts";

export interface FundraiseActionProps {
  amounts: number[];
  actblue_url: string;
  refcode?: string;
  suggested?: number;
  onComplete: (data: { type: "donation_click"; amount: number }) => void;
  pageId?: string;
  visitorId?: string;
  variant?: string;
}

/** Shared inline-style fragments. */
export function FundraiseAction({
  amounts,
  actblue_url,
  refcode,
  suggested,
  onComplete,
}: FundraiseActionProps): ReactNode {
  // Defensive: action_props from MCP/storage may omit `amounts` entirely.
  // Falling back to a reasonable default keeps SSR from throwing on
  // `amounts.map` and lets the page render even with partial config.
  const safeAmounts: number[] =
    Array.isArray(amounts) && amounts.length > 0 ? amounts : [10, 25, 50, 100, 250];
  const [selected, setSelected] = useState<number | null>(suggested ?? null);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const activeAmount = isCustom ? parseFloat(custom) || 0 : selected ?? 0;

  function buildUrl(amount: number): string {
    if (!actblue_url) return "#";
    try {
      const url = new URL(actblue_url);
      url.searchParams.set("amount", String(amount));
      if (refcode) url.searchParams.set("refcode", refcode);
      return url.toString();
    } catch {
      return "#";
    }
  }

  function handleDonate() {
    if (!activeAmount || activeAmount <= 0) return;
    onComplete({ type: "donation_click", amount: activeAmount });
    window.location.href = buildUrl(activeAmount);
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "42em" }}>
      {/* Amount button grid */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.625rem",
          marginBottom: "1.25rem",
        }}
      >
        {safeAmounts.map((amt) => {
          const active = !isCustom && selected === amt;
          return (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setSelected(amt);
                setIsCustom(false);
                setCustom("");
              }}
              style={{
                flex: "1 1 calc(33.333% - 0.5rem)",
                minWidth: "5.5rem",
                minHeight: "44px",
                padding: "0.75rem 1rem",
                fontFamily: s.mono,
                fontSize: "1.05rem",
                fontWeight: 600,
                lineHeight: 1.3,
                color: active ? s.bg : s.text,
                background: active ? s.accent : "transparent",
                border: `1.5px solid ${active ? s.accent : s.border}`,
                borderRadius: s.radius,
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
            >
              ${amt}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.75rem",
          borderBottom: `1.5px solid ${isCustom ? s.accent : s.border}`,
          paddingBottom: "0.5rem",
          transition: "border-color 150ms ease",
        }}
      >
        <span
          style={{
            fontFamily: s.mono,
            fontSize: "1.1rem",
            color: s.secondary,
            userSelect: "none",
          }}
        >
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Other amount"
          value={custom}
          onFocus={() => {
            setIsCustom(true);
            setSelected(null);
          }}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            setCustom(v);
            setIsCustom(true);
            setSelected(null);
          }}
          style={{
            flex: 1,
            fontFamily: s.mono,
            fontSize: "1.1rem",
            color: s.text,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "0.375rem 0",
            minHeight: "44px",
          }}
        />
      </div>

      {/* CTA */}
      <button
        type="button"
        disabled={!activeAmount || activeAmount <= 0}
        onClick={handleDonate}
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
          cursor: activeAmount > 0 ? "pointer" : "not-allowed",
          opacity: activeAmount > 0 ? 1 : 0.5,
          transition: "opacity 150ms ease",
        }}
      >
        {activeAmount > 0 ? `Donate $${activeAmount}` : "Select an amount"}
      </button>
    </div>
  );
}
