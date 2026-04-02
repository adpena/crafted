import { useState, useRef, useEffect, type ReactNode, useId } from "react";

interface Tab {
  label: string;
  content: ReactNode;
}

interface TabbedContentProps {
  tabs: Tab[];
}

export default function TabbedContent({ tabs }: TabbedContentProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  function switchTab(index: number) {
    if (index === activeIndex || transitioning) return;
    setTransitioning(true);

    // Fade out current panel
    if (panelRef.current) {
      panelRef.current.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(6px)" },
        ],
        { duration: 150, easing: "ease-in", fill: "forwards" },
      ).onfinish = () => {
        setActiveIndex(index);
        setDisplayIndex(index);

        // Fade in new panel
        requestAnimationFrame(() => {
          if (panelRef.current) {
            panelRef.current.animate(
              [
                { opacity: 0, transform: "translateY(-6px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
            ).onfinish = () => {
              setTransitioning(false);
            };
          }
        });
      };
    } else {
      setActiveIndex(index);
      setDisplayIndex(index);
      setTransitioning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    let newIndex: number | null = null;

    if (e.key === "ArrowRight") {
      newIndex = (activeIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabs.length - 1;
    }

    if (newIndex !== null) {
      e.preventDefault();
      switchTab(newIndex);
      tabRefs.current[newIndex]?.focus();
    }
  }

  // Ensure refs array matches tabs length
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  return (
    <div className="tabbed-content">
      <div
        className="tabbed-content__tablist"
        role="tablist"
        aria-label="Project sections"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, i) => (
          <button
            key={i}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={activeIndex === i}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={activeIndex === i ? 0 : -1}
            className={`tabbed-content__tab${activeIndex === i ? " tabbed-content__tab--active" : ""}`}
            onClick={() => switchTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        ref={panelRef}
        role="tabpanel"
        id={`${baseId}-panel-${displayIndex}`}
        aria-labelledby={`${baseId}-tab-${displayIndex}`}
        className="tabbed-content__panel"
        tabIndex={0}
      >
        {tabs[displayIndex]?.content}
      </div>

      <style>{`
        .tabbed-content {
          margin-bottom: var(--spacing-2xl);
        }

        .tabbed-content__tablist {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: 0;
        }

        .tabbed-content__tab {
          font-family: var(--font-mono);
          font-size: var(--font-size-sm);
          color: var(--color-secondary);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 0.6rem 1.25rem;
          cursor: pointer;
          transition: color 150ms ease, border-color 150ms ease;
          position: relative;
          margin-bottom: -1px;
        }

        .tabbed-content__tab:hover {
          color: var(--color-text);
        }

        .tabbed-content__tab:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -2px;
        }

        .tabbed-content__tab--active {
          color: var(--color-text);
          border-bottom-color: var(--color-text);
        }

        .tabbed-content__panel {
          background: var(--color-surface);
          padding: var(--spacing-xl) var(--spacing-lg);
          border-radius: 0 0 3px 3px;
          min-height: 12rem;
          font-family: var(--font-serif);
          font-size: var(--font-size-base);
          line-height: 1.7;
        }

        .tabbed-content__panel:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: -2px;
        }

        .tabbed-content__panel :is(p) {
          margin-bottom: 1em;
        }

        .tabbed-content__panel :is(h3) {
          font-family: var(--font-serif);
          font-weight: 700;
          font-size: var(--font-size-lg);
          margin-bottom: 0.5em;
          margin-top: 1.5em;
        }

        .tabbed-content__panel :is(h3):first-child {
          margin-top: 0;
        }

        @media (max-width: 640px) {
          .tabbed-content__tab {
            padding: 0.5rem 0.75rem;
            font-size: var(--font-size-xs);
          }

          .tabbed-content__panel {
            padding: var(--spacing-md);
          }
        }
      `}</style>
    </div>
  );
}
