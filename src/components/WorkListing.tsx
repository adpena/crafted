import { useState, useEffect, useCallback } from "react";

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
	fieldRefs?: {
		title?: string;
		summary?: string;
	};
}

export interface WorkSection {
	slug: string;
	label: string;
	entries: WorkEntry[];
}

interface Props {
	sections: WorkSection[];
}

const STORAGE_KEY = "work-filter";

export default function WorkListing({ sections }: Props) {
	const [activeFilter, setActiveFilter] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		try {
			const saved = sessionStorage.getItem(STORAGE_KEY);
			if (saved && sections.some((s) => s.slug === saved)) {
				setActiveFilter(saved);
			}
		} catch {}
	}, []);

	const handleFilter = useCallback((slug: string | null) => {
		setActiveFilter(slug);
		try {
			if (slug) sessionStorage.setItem(STORAGE_KEY, slug);
			else sessionStorage.removeItem(STORAGE_KEY);
		} catch {}
	}, []);

	// Use activeFilter only after mount — ensures server and client render
	// identically on first pass, then update from sessionStorage after hydration.
	const effectiveFilter = mounted ? activeFilter : null;

	const visible = effectiveFilter
		? sections.filter((s) => s.slug === effectiveFilter)
		: sections;

	return (
		<div>
			{sections.length > 1 && (
				<nav className="work-filter" aria-label="Filter by collection">
					<div
						className="work-filter-controls"
						role="group"
						aria-label="Filter by collection"
					>
						<button
							type="button"
							className={`work-filter-btn${effectiveFilter === null ? " work-filter-btn--active" : ""}`}
							onClick={() => handleFilter(null)}
							aria-pressed={effectiveFilter === null}
						>
							All
						</button>
						{sections.map((s) => (
							<button
								key={s.slug}
								type="button"
								className={`work-filter-btn${effectiveFilter === s.slug ? " work-filter-btn--active" : ""}`}
								onClick={() => handleFilter(s.slug)}
								aria-pressed={effectiveFilter === s.slug}
							>
								{s.label}
							</button>
						))}
					</div>
				</nav>
			)}

			<div className="work-main">
			{visible.length === 0 && (
				<p
					className="page-summary"
					style={{ textAlign: "center", padding: "var(--spacing-3xl) 0" }}
				>
					Work unavailable — check back shortly.
				</p>
			)}

			{visible.map((section) => (
				<section key={section.slug} className="work-section">
					<h2 className="section-label">{section.label}</h2>
					<ul className="compact-list" role="list">
						{section.entries.map((entry) => {
							const tags =
								entry.data.stack ||
								entry.data.publication ||
								entry.data.medium ||
								"";
							const year =
								entry.data.year ||
								(entry.data.date
									? String(new Date(entry.data.date).getFullYear())
									: "");

							return (
								<li
									key={`${section.slug}-${entry.id}`}
									{...(entry.editRef ? { "data-emdash-ref": entry.editRef } : {})}
								>
									<a
										href={`/work/${section.slug}/${entry.id}`}
										className="compact-item"
									>
										<span
											className="compact-title"
											{...(entry.fieldRefs?.title ? { "data-emdash-ref": entry.fieldRefs.title } : {})}
										>
											{entry.data.title}
										</span>
										<span className="compact-tags">{tags}</span>
										<span className="compact-year">{year}</span>
									</a>
									<div className="compact-reveal">
										<div>
											{entry.data.summary && (
												<p
													{...(entry.fieldRefs?.summary ? { "data-emdash-ref": entry.fieldRefs.summary } : {})}
												>
													{entry.data.summary}
												</p>
											)}
											{tags && (
												<span className="compact-tags-reveal">
													{tags}
												</span>
											)}
										</div>
									</div>
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
