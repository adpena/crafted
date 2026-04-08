import { useState, useEffect } from "react";
import { useSSECount } from "./useSSECount.ts";

/**
 * Fetches the current submission count for an action page slug.
 *
 * Priority:
 * 1. SSE (if sseUrl provided) — real-time push from server
 * 2. Polling (if refreshInterval set) — periodic fetch
 * 3. Single fetch on mount — default behavior
 */
export function useActionCount(
  slug: string | undefined,
  countUrl = "/api/action/count",
  refreshInterval?: number,
  sseUrl?: string,
): { count: number; raised: number; loading: boolean; live: boolean } {
  const [count, setCount] = useState(0);
  const [raised, setRaised] = useState(0);
  const [loading, setLoading] = useState(!!slug);

  // Build SSE URL from slug if sseUrl template is provided
  const resolvedSseUrl = sseUrl && slug
    ? `${sseUrl}${sseUrl.includes("?") ? "&" : "?"}slug=${encodeURIComponent(slug)}`
    : undefined;

  const { count: sseCount, raised: sseRaised, connected } = useSSECount(
    slug ? resolvedSseUrl : undefined,
    0,
  );

  // If SSE is connected, use its count/raised and clear loading state
  useEffect(() => {
    if (connected) {
      setLoading(false);
      setCount(sseCount);
      setRaised(sseRaised);
    }
  }, [sseCount, sseRaised, connected]);

  // Fetch/poll fallback when SSE is not in use
  useEffect(() => {
    if (!slug || connected) return;

    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch(`${countUrl}?slug=${encodeURIComponent(slug!)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setCount(json.count ?? 0);
          setRaised(json.raised ?? 0);
        }
      } catch {
        // Silently fail — progress bar just shows 0
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCount();

    if (refreshInterval && refreshInterval > 0) {
      const id = setInterval(fetchCount, refreshInterval);
      return () => { cancelled = true; clearInterval(id); };
    }

    return () => { cancelled = true; };
  }, [slug, countUrl, refreshInterval, connected]);

  return { count, raised, loading, live: connected };
}
