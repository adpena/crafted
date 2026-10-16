import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Keep table semantics and make off-screen columns discoverable on touch and keyboard. */
export default function ScrollableTable({ label, children }: { label: string; children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [edges, setEdges] = useState({ overflow: true, start: true, end: false });
  const [ready, setReady] = useState(false);

  function measure() {
    const el = region.current;
    if (!el) return;
    setEdges({ overflow: el.scrollWidth > el.clientWidth + 1, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }

  useEffect(() => {
    setReady(true);
    const observer = new ResizeObserver(measure);
    observer.observe(region.current!);
    const table = region.current!.querySelector("table");
    if (table) observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, []);

  function scroll(direction: number) {
    const el = region.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * .75, behavior: "instant" });
    measure();
  }

  return <div className="table-explorer">
    {edges.overflow && <div className="table-scroll-tools">
      <p id={hintId} className="source-note">{ready ? "More columns: swipe the table, or focus it and use the arrow keys." : "More columns: scroll the table horizontally."}</p>
      {ready && <div className="table-scroll-buttons">
        <button type="button" className="demo-button demo-button-secondary" disabled={edges.start} aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)}>← Left</button>
        <button type="button" className="demo-button demo-button-secondary" disabled={edges.end} aria-label={`Scroll ${label} right`} onClick={() => scroll(1)}>Right →</button>
      </div>}
    </div>}
    <div ref={region} className="artifact-table-wrap" role="region" aria-label={label} aria-describedby={edges.overflow ? hintId : undefined} tabIndex={edges.overflow ? 0 : undefined} onScroll={measure} onKeyDown={(event) => {
      if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); scroll(event.key === "ArrowLeft" ? -1 : 1);
      }
    }}>{children}</div>
  </div>;
}
