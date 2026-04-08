import { useState, type ReactNode } from "react";
import { tokens as s } from "./tokens.ts";
import { getLocale, type Locale } from "../../lib/i18n.ts";
import { ProgressBar } from "../ProgressBar.tsx";
import { useActionCount } from "../hooks/useActionCount.ts";
import { useTurnstile } from "../hooks/useTurnstile.ts";
import type { ProgressConfig } from "./progress-config.ts";

export interface FundraiseActionProps {
  amounts: number[];
  actblue_url: string;
  refcode?: string;
  suggested?: number;
  /** Enable recurring/monthly donation option */
  allow_recurring?: boolean;
  /** "redirect" navigates to ActBlue; "iframe" embeds ActBlue inline */
  embed_mode?: "redirect" | "iframe";
  progress?: ProgressConfig;
  turnstileSiteKey?: string;
  locale?: Locale;
  onComplete: (data: { type: "donation_click"; amount: number; recurring?: boolean }) => void;
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
  allow_recurring = false,
  embed_mode = "redirect",
  progress,
  turnstileSiteKey,
  locale: localeProp,
  onComplete,
  pageId,
  visitorId,
  variant,
  submitUrl = "/api/action/submit",
}: FundraiseActionProps & { submitUrl?: string }): ReactNode {
  const locale = getLocale(localeProp);
  void locale;
  const [recurring, setRecurring] = useState(false);
  const { count: liveCount } = useActionCount(
    progress?.enabled ? pageId : undefined,
    progress?.countUrl,
    progress?.refreshInterval,
    progress?.sseUrl,
  );
  const turnstile = useTurnstile(turnstileSiteKey);
  // Defensive: action_props from MCP/storage may omit `amounts` entirely.
  // Falling back to a reasonable default keeps SSR from throwing on
  // `amounts.map` and lets the page render even with partial config.
  const safeAmounts: number[] =
    Array.isArray(amounts) && amounts.length > 0 ? amounts : [10, 25, 50, 100, 250];
  const [selected, setSelected] = useState<number | null>(suggested ?? null);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const activeAmount = isCustom ? parseFloat(custom) || 0 : selected ?? 0;

  function buildUrl(amount: number, forEmbed = false): string {
    if (!actblue_url) return "#";
    try {
      const url = new URL(actblue_url);
      // Only allow HTTPS — reject javascript:, data:, vbscript:, etc.
      if (url.protocol !== "https:") return "#";
      url.searchParams.set("amount", String(amount));
      if (refcode) url.searchParams.set("refcode", refcode);
      // ActBlue recurring parameter — enables monthly donations
      if (recurring) url.searchParams.set("recurring", "1");
      if (forEmbed) url.searchParams.set("embed", "1");
      return url.toString();
    } catch {
      return "#";
    }
  }

  async function handleDonate() {
    if (!activeAmount || activeAmount <= 0) return;
    if (turnstileSiteKey && !turnstile.token) return;

    // POST to server before navigating — ensures D1 write, KV cache,
    // conversion tracking, and webhook dispatch all fire.
    try {
      await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "donation_click",
          page_id: pageId,
          visitorId,
          variant,
          turnstile_token: turnstile.token ?? undefined,
          data: { amount: activeAmount },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Non-blocking — navigate to ActBlue even if tracking fails
    }

    onComplete({ type: "donation_click", amount: activeAmount, recurring });

    if (embed_mode === "iframe") {
      setIframeSrc(buildUrl(activeAmount, true));
    } else {
      window.location.href = buildUrl(activeAmount);
    }
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "42em" }}>
      {/* Progress bar */}
      {progress?.enabled && progress.goal && progress.goal > 0 && (
        <ProgressBar
          current={liveCount}
          goal={progress.goal}
          labelKey={progress.labelKey ?? "progress_donors"}
          mode={progress.mode ?? "bar"}
          accentColor={progress.accentColor}
          deadline={progress.deadline}
          locale={locale}
        />
      )}

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
            padding: "0.375rem 0",
            minHeight: "44px",
          }}
        />
      </div>

      {/* Recurring donation toggle */}
      {allow_recurring && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "1.25rem",
            cursor: "pointer",
            minHeight: "44px",
            padding: "0.25rem 0",
          }}
        >
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            style={{
              width: "1.125rem",
              height: "1.125rem",
              accentColor: s.accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: s.serif,
              fontSize: "1rem",
              color: s.text,
              lineHeight: 1.45,
            }}
          >
            Make this a monthly donation
          </span>
        </label>
      )}

      {/* Turnstile bot protection */}
      {turnstileSiteKey && (
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
          <div ref={turnstile.ref} />
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        disabled={!activeAmount || activeAmount <= 0 || (!!turnstileSiteKey && !turnstile.token)}
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

      {/* ActBlue embedded iframe */}
      {embed_mode === "iframe" && iframeSrc && (
        <iframe
          src={iframeSrc}
          title="Complete your donation on ActBlue"
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          style={{
            width: "100%",
            minHeight: "500px",
            border: "none",
            borderRadius: s.radius,
            marginTop: "1.25rem",
          }}
        />
      )}
    </div>
  );
}
