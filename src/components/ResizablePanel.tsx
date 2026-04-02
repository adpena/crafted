import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";

interface ResizablePanelProps {
  left: ReactNode;
  right: ReactNode;
  initialSplit?: number;
}

const MIN_SPLIT = 20;
const MAX_SPLIT = 80;
const STEP = 5;

export default function ResizablePanel({
  left,
  right,
  initialSplit = 50,
}: ResizablePanelProps) {
  const [split, setSplit] = useState(
    Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, initialSplit)),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = (v: number) => Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, v));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setSplit(clamp(Math.round(pct)));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = split - STEP;
      else if (e.key === "ArrowRight") next = split + STEP;

      if (next !== null) {
        e.preventDefault();
        setSplit(clamp(next));
      }
    },
    [split],
  );

  // Prevent text selection during drag
  useEffect(() => {
    function preventSelect(e: Event) {
      if (dragging.current) e.preventDefault();
    }
    document.addEventListener("selectstart", preventSelect);
    return () => document.removeEventListener("selectstart", preventSelect);
  }, []);

  return (
    <div
      ref={containerRef}
      className="resizable-panel"
      style={{ "--split": `${split}%` } as React.CSSProperties}
    >
      <div className="resizable-panel__left">{left}</div>

      <div
        className="resizable-panel__divider"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={split}
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        aria-label="Resize panels"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="resizable-panel__handle" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>

      <div className="resizable-panel__right">{right}</div>

      <style>{`
        .resizable-panel {
          display: flex;
          border: 1px solid var(--color-border);
          border-radius: 3px;
          min-height: 18rem;
          overflow: hidden;
        }

        .resizable-panel__left {
          flex: 0 0 var(--split);
          overflow: auto;
          padding: var(--spacing-lg);
          font-family: var(--font-serif);
          font-size: var(--font-size-base);
          line-height: 1.7;
        }

        .resizable-panel__left :is(p) {
          margin-bottom: 1em;
        }

        .resizable-panel__right {
          flex: 1;
          overflow: auto;
          padding: var(--spacing-lg);
          background: var(--color-surface);
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          line-height: 1.6;
          color: var(--color-secondary);
        }

        .resizable-panel__divider {
          flex: 0 0 5px;
          background: var(--color-border);
          cursor: ew-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          touch-action: none;
          transition: background 150ms ease;
        }

        .resizable-panel__divider:hover,
        .resizable-panel__divider:active {
          background: var(--color-secondary);
        }

        .resizable-panel__divider:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -1px;
        }

        .resizable-panel__handle {
          display: flex;
          flex-direction: column;
          gap: 3px;
          pointer-events: none;
        }

        .resizable-panel__handle span {
          display: block;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: var(--color-bg);
          opacity: 0.8;
        }

        @media (max-width: 640px) {
          .resizable-panel {
            flex-direction: column;
          }

          .resizable-panel__left {
            flex: none;
          }

          .resizable-panel__divider {
            flex: 0 0 3px;
            cursor: ns-resize;
          }

          .resizable-panel__handle {
            flex-direction: row;
          }
        }
      `}</style>
    </div>
  );
}
