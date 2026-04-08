import { useState, useEffect, useRef } from "react";

/**
 * Live count updates via Server-Sent Events.
 * Falls back to polling if SSE is unavailable or fails.
 *
 * Uses EventSource with automatic reconnection (built-in browser behavior).
 */
export function useSSECount(
  sseUrl: string | undefined,
  fallbackCount = 0,
): { count: number; connected: boolean } {
  const [count, setCount] = useState(fallbackCount);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sseUrl || typeof EventSource === "undefined") return;

    const es = new EventSource(sseUrl);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects — no manual retry needed
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [sseUrl]);

  return { count, connected };
}
