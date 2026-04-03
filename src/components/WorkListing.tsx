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

	useEffect(() => {
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

	const visible = activeFilter
		? sections.filter((s) => s.slug === activeFilter)
		: sections;

	return (
		// TODO(astro-react-hydration): React 19 + Astro SSR produces a hydration
		// mismatch (#418) due to whitespace differences between server-rendered HTML
		// and React's client-side expectation. suppressHydrationWarning mitigates but
		// doesn't fully resolve. Track: https://github.com/withastro/astro/issues
		// Lighthouse Best Practices docked 4 points for the console error.
		// Fix: upgrade @astrojs/react when the upstream fix ships, then remove this.
		<div className="work-main" suppressHydrationWarning>
			{sections.length > 1 && (
				<nav className="work-filter" aria-label="Filter by collection">
					<span className="work-filter-label" aria-hidden="true">
						Filter
					</span>
					<div
						className="work-filter-controls"
						role="group"
						aria-label="Filter by collection"
					>
						<button
							type="button"
							className={`work-filter-btn${activeFilter === null ? " work-filter-btn--active" : ""}`}
							onClick={() => handleFilter(null)}
							aria-pressed={activeFilter === null}
						>
							All
						</button>
						{sections.map((s) => (
							<button
								key={s.slug}
								type="button"
								className={`work-filter-btn${activeFilter === s.slug ? " work-filter-btn--active" : ""}`}
								onClick={() => handleFilter(s.slug)}
								aria-pressed={activeFilter === s.slug}
							>
								{s.label}
							</button>
						))}
					</div>
				</nav>
			)}

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
	);
}
