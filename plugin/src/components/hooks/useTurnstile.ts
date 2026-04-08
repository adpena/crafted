import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget hook.
 *
 * Usage:
 *   const { ref, token, ready, reset } = useTurnstile(siteKey);
 *   <div ref={ref} />  // Place in your form
 *   // On submit, send token as "turnstile_token" in the payload
 *
 * - Lazy-loads the Turnstile script on first use (single global load)
 * - Returns the token once verification completes
 * - Provides a `reset()` function to refresh the widget after submission
 */

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptLoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function useTurnstile(siteKey: string | undefined): {
  ref: React.RefObject<HTMLDivElement | null>;
  token: string | null;
  ready: boolean;
  error: boolean;
  reset: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!siteKey || !ref.current) return;

    let cancelled = false;
    setError(false);

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        try {
          widgetIdRef.current = window.turnstile.render(ref.current, {
            sitekey: siteKey,
            callback: (t: string) => {
              if (!cancelled) {
                setToken(t);
                setReady(true);
              }
            },
            "expired-callback": () => {
              if (!cancelled) setToken(null);
            },
            "error-callback": () => {
              if (!cancelled) setError(true);
            },
          });
        } catch {
          if (!cancelled) setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      }
    };
  }, [siteKey]);

  function reset() {
    setToken(null);
    setReady(false);
    if (widgetIdRef.current && typeof window !== "undefined" && window.turnstile) {
      try { window.turnstile.reset(widgetIdRef.current); } catch { /* ignore */ }
    }
  }

  return { ref, token, ready, error, reset };
}
