/**
 * Brand extraction types — adapted from enjoice for action-pages.
 *
 * A BrandKit represents the visual identity extracted from a candidate's
 * or organization's website. It maps cleanly onto an action page Theme.
 */

export interface BrandKit {
	source_url: string;
	name: string;
	logo_url: string | null;
	favicon_url: string | null;
	colors: {
		primary: string;
		secondary: string;
		accent: string;
		background: string;
		text: string;
	};
	fonts: {
		heading: string;
		body: string;
	};
	meta: {
		description: string;
	};
	extracted_at: string;
}

/**
 * Action page theme variant generated from a BrandKit.
 * Maps directly to the --page-* CSS variable shape used by action pages.
 */
export interface BrandThemeVariant {
	id: "on-brand" | "elevated" | "contrast" | "minimal";
	name: string;
	description: string;
	theme: {
		"--page-bg": string;
		"--page-text": string;
		"--page-accent": string;
		"--page-secondary": string;
		"--page-border": string;
		"--page-radius": string;
		"--page-font-serif": string;
		"--page-font-mono": string;
	};
}
