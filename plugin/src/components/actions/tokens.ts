/**
 * Shared style tokens for action components.
 * All values reference CSS custom properties from the theme system
 * with sensible fallbacks for standalone usage.
 */
export const tokens = {
	mono: "var(--page-font-mono, 'SFMono-Regular', Consolas, monospace)",
	serif: "var(--page-font-serif, Georgia, serif)",
	accent: "var(--page-accent, #c62828)",
	bg: "var(--page-bg, #fff)",
	text: "var(--page-text, #1a1a1a)",
	secondary: "var(--page-secondary, #555)",
	border: "var(--page-border, #ddd)",
	radius: "var(--page-radius, 4px)",
} as const;
