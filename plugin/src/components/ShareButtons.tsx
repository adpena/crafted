import { useState } from "react";
import { t, getLocale, type Locale } from "../lib/i18n.ts";

export interface ShareButtonsProps {
  /** The URL to share (defaults to current page) */
  url?: string;
  /** Pre-filled share text */
  text?: string;
  /** Which platforms to show */
  platforms?: ("twitter" | "facebook" | "email" | "copy")[];
  /** Locale for i18n */
  locale?: Locale;
}

const PLATFORM_DEFAULTS: ShareButtonsProps["platforms"] = ["twitter", "facebook", "email", "copy"];

/**
 * Post-action social sharing buttons.
 * Renders a horizontal row of share buttons for the configured platforms.
 * Shown after a visitor completes an action (petition, GOTV, etc.).
 */
export function ShareButtons({
  url,
  text = "",
  platforms = PLATFORM_DEFAULTS,
  locale: localeProp,
}: ShareButtonsProps) {
  const locale = getLocale(localeProp);
  const [copied, setCopied] = useState(false);
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  const buttonBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.5rem 1rem",
    fontFamily: "var(--page-font-mono)",
    fontSize: "0.75rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--page-text)",
    background: "transparent",
    border: "1.5px solid var(--page-border)",
    borderRadius: "var(--page-radius, 3px)",
    cursor: "pointer",
    transition: "all 150ms ease",
    textDecoration: "none",
    minHeight: "40px",
  };

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "0.5rem",
      justifyContent: "center",
      marginTop: "1.25rem",
      marginBottom: "1rem",
    }}>
      <p style={{
        width: "100%",
        textAlign: "center",
        fontFamily: "var(--page-font-serif)",
        fontSize: "1rem",
        color: "var(--page-secondary)",
        margin: "0 0 0.5rem",
      }}>
        {t(locale, "share_prompt")}
      </p>

      {platforms!.includes("twitter") && (
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonBase}
        >
          <TwitterIcon />
          {t(locale, "share_twitter")}
        </a>
      )}

      {platforms!.includes("facebook") && (
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonBase}
        >
          <FacebookIcon />
          {t(locale, "share_facebook")}
        </a>
      )}

      {platforms!.includes("email") && (
        <a
          href={`mailto:?subject=${encodedText}&body=${encodedUrl}`}
          style={buttonBase}
        >
          <EmailIcon />
          {t(locale, "share_email")}
        </a>
      )}

      {platforms!.includes("copy") && (
        <button
          type="button"
          onClick={handleCopy}
          style={{
            ...buttonBase,
            color: copied ? "var(--page-accent)" : "var(--page-text)",
            borderColor: copied ? "var(--page-accent)" : "var(--page-border)",
          }}
        >
          <CopyIcon />
          {copied ? t(locale, "share_copied") : t(locale, "share_copy_link")}
        </button>
      )}
    </div>
  );
}

// Minimal inline SVG icons (no external dependencies)
function TwitterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
