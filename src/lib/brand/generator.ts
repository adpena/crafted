/**
 * Generate action-page theme variants from a BrandKit.
 *
 * Produces 4 variants:
 *  - on-brand:  uses extracted colors directly, contrast-adjusted for WCAG AA
 *  - elevated:  refined / desaturated, polished feel
 *  - contrast:  uses complementary colors for high visual impact
 *  - minimal:   monochrome, primary as accent only
 */

import type { BrandKit, BrandThemeVariant } from "./types.ts";
import { complementary, darken, desaturate, ensureContrast, isLight, lighten } from "./color-utils.ts";

const FALLBACK_FONT_SERIF = "Georgia, 'Times New Roman', serif";
const FALLBACK_FONT_MONO = "'SFMono-Regular', Consolas, monospace";
const RADIUS = "4px";

function fontStack(family: string, fallback: string): string {
	if (!family || family.length === 0) return fallback;
	const safe = family.replace(/[^A-Za-z0-9 \-]/g, "");
	if (!safe) return fallback;
	return `'${safe}', ${fallback}`;
}

function borderColor(bg: string): string {
	return isLight(bg) ? darken(bg, 0.08) : lighten(bg, 0.12);
}

function secondaryText(text: string, bg: string): string {
	return isLight(bg) ? lighten(text, 0.35) : darken(text, 0.35);
}

/** On-brand: extracted colors as-is, contrast-checked. */
function onBrand(brand: BrandKit): BrandThemeVariant {
	const bg = brand.colors.background;
	const text = ensureContrast(brand.colors.text, bg, 7); // WCAG AAA
	const accent = ensureContrast(brand.colors.accent, bg, 4.5);
	return {
		id: "on-brand",
		name: "On Brand",
		description: "Uses your exact brand colors and fonts.",
		theme: {
			"--page-bg": bg,
			"--page-text": text,
			"--page-accent": accent,
			"--page-secondary": secondaryText(text, bg),
			"--page-border": borderColor(bg),
			"--page-radius": RADIUS,
			"--page-font-serif": fontStack(brand.fonts.heading, FALLBACK_FONT_SERIF),
			"--page-font-mono": fontStack(brand.fonts.body, FALLBACK_FONT_MONO),
		},
	};
}

/** Elevated: desaturated and refined for editorial polish. */
function elevated(brand: BrandKit): BrandThemeVariant {
	const bg = "#fafaf7"; // warm off-white
	const text = "#1a1a1a";
	const accent = ensureContrast(desaturate(brand.colors.primary, 0.15), bg, 4.5);
	return {
		id: "elevated",
		name: "Elevated",
		description: "Refined editorial palette inspired by your brand.",
		theme: {
			"--page-bg": bg,
			"--page-text": text,
			"--page-accent": accent,
			"--page-secondary": "#555555",
			"--page-border": "#e5e5e0",
			"--page-radius": RADIUS,
			"--page-font-serif": fontStack(brand.fonts.heading, FALLBACK_FONT_SERIF),
			"--page-font-mono": fontStack(brand.fonts.body, FALLBACK_FONT_MONO),
		},
	};
}

/** Contrast: bold dark mode using complementary color as accent. */
function contrast(brand: BrandKit): BrandThemeVariant {
	const bg = "#0a0a0a";
	const text = "#f5f5f0";
	const accent = ensureContrast(complementary(brand.colors.primary), bg, 4.5);
	return {
		id: "contrast",
		name: "Contrast",
		description: "Bold dark mode with a complementary accent.",
		theme: {
			"--page-bg": bg,
			"--page-text": text,
			"--page-accent": accent,
			"--page-secondary": "#9a9a95",
			"--page-border": "#2a2a2a",
			"--page-radius": RADIUS,
			"--page-font-serif": fontStack(brand.fonts.heading, FALLBACK_FONT_SERIF),
			"--page-font-mono": fontStack(brand.fonts.body, FALLBACK_FONT_MONO),
		},
	};
}

/** Minimal: monochrome with primary as accent only. */
function minimal(brand: BrandKit): BrandThemeVariant {
	const bg = "#ffffff";
	const text = "#111111";
	const accent = ensureContrast(brand.colors.primary, bg, 4.5);
	return {
		id: "minimal",
		name: "Minimal",
		description: "Black and white with your primary color as accent.",
		theme: {
			"--page-bg": bg,
			"--page-text": text,
			"--page-accent": accent,
			"--page-secondary": "#666666",
			"--page-border": "#e5e5e5",
			"--page-radius": RADIUS,
			"--page-font-serif": fontStack(brand.fonts.heading, FALLBACK_FONT_SERIF),
			"--page-font-mono": fontStack(brand.fonts.body, FALLBACK_FONT_MONO),
		},
	};
}

export function generateThemeVariants(brand: BrandKit): BrandThemeVariant[] {
	return [onBrand(brand), elevated(brand), contrast(brand), minimal(brand)];
}
