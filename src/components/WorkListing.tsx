import { useEffect, useState } from "react";
import { WORK_FILTERS, parseWorkFilter, workFilterHref, type WorkFilter } from "../lib/portfolio-content";

export interface WorkEntry {
  id: string;
  slug: string;
  editRef?: string;
  data: {
    title: string;
    summary?: string;
    stack?: string;
    publication?: string;
    medium?: string;
    year?: string | number;
    date?: string;
  };
  fieldRefs?: { title?: string; summary?: string };
}
export interface WorkSection { slug: string; label: string; entries: WorkEntry[] }

export default function WorkListing({ sections, initialFilter = "all" }: {
  sections: WorkSection[]; initialFilter?: WorkFilter;
}) {
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  useEffect(() => {
    const restore = () => setActiveFilter(parseWorkFilter(new URLSearchParams(location.search).get("focus")));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const filter = WORK_FILTERS.find((f) => f.value === activeFilter)!;
  const visible = sections.filter((s) => (filter.collections as readonly string[]).includes(s.slug));
  return (
    <div className="work-index" data-filter={activeFilter}>
      <nav className="work-filter" aria-label="Filter work">
        <div className="work-filter-controls">
          {WORK_FILTERS.map(({ value, label }) => (
            <a key={value} href={workFilterHref(value)}
              className={`work-filter-btn${activeFilter === value ? " work-filter-btn--active" : ""}`}
              aria-current={activeFilter === value ? "true" : undefined}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                const href = workFilterHref(value);
                if (location.pathname + location.search + location.hash !== href) history.pushState(null, "", href);
                setActiveFilter(value);
              }}>{label}</a>
          ))}
        </div>
      </nav>
      <p className="visually-hidden" role="status">
        {filter.label}: {visible.reduce((n, s) => n + s.entries.length, 0)} projects
      </p>
      <div className="work-main">
        {visible.length === 0 && <p className="page-summary">Work is temporarily unavailable. <a href="/contact">Get in touch.</a></p>}
        {visible.map((section) => (
          <section key={section.slug} className="work-section" data-collection={section.slug}>
            <h3 className="section-label">{section.label}</h3>
            <ul className="compact-list" role="list">
              {section.entries.map((entry) => {
                const tags = entry.data.stack || entry.data.publication || entry.data.medium || "";
                const year = entry.data.year || (entry.data.date ? String(new Date(entry.data.date).getUTCFullYear()) : "");
                return (
                  <li key={`${section.slug}-${entry.id}`} {...(entry.editRef ? { "data-emdash-ref": entry.editRef } : {})}>
                    <a href={`/work/${section.slug}/${entry.id}`} className="compact-item">
                      <span className="compact-title" {...(entry.fieldRefs?.title ? { "data-emdash-ref": entry.fieldRefs.title } : {})}>{entry.data.title}</span>
                      <span className="compact-year">{year}</span>
                    </a>
                    {entry.data.summary && <p className="work-summary" {...(entry.fieldRefs?.summary ? { "data-emdash-ref": entry.fieldRefs.summary } : {})}>{entry.data.summary}</p>}
                    {tags && <p className="work-tags">{tags}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
