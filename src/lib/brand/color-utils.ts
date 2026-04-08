/**
 * Color utility functions for brand extraction and template generation.
 * No external dependencies — pure math on hex/RGB/HSL color spaces.
 * Ported from enjoice/packages/plugin/src/brand/color-utils.ts
 */

export interface RGB { r: number; g: number; b: number; }
export interface HSL { h: number; s: number; l: number; }

function normalizeHex(hex: string): string {
	let h = hex.replace(/^#/, "");
	if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
	return h;
}

export function hexToRgb(hex: string): RGB {
	const h = normalizeHex(hex);
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16),
	};
}

export function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return "#" + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
	const rn = r / 255, gn = g / 255, bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const d = max - min;
	const l = (max + min) / 2;
	if (d === 0) return { h: 0, s: 0, l };
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	switch (max) {
		case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
		case gn: h = ((bn - rn) / d + 2) / 6; break;
		default: h = ((rn - gn) / d + 4) / 6; break;
	}
	return { h: h * 360, s, l };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
	const hNorm = ((h % 360) + 360) % 360;
	if (s === 0) {
		const v = Math.round(l * 255);
		return { r: v, g: v, b: v };
	}
	const hue2rgb = (p: number, q: number, t: number): number => {
		let tn = t;
		if (tn < 0) tn += 1;
		if (tn > 1) tn -= 1;
		if (tn < 1 / 6) return p + (q - p) * 6 * tn;
		if (tn < 1 / 2) return q;
		if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hFrac = hNorm / 360;
	return {
		r: Math.round(hue2rgb(p, q, hFrac + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, hFrac) * 255),
		b: Math.round(hue2rgb(p, q, hFrac - 1 / 3) * 255),
	};
}

export function hexToHsl(hex: string): HSL {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHsl(r, g, b);
}

export function hslToHex(h: number, s: number, l: number): string {
	const { r, g, b } = hslToRgb(h, s, l);
	return rgbToHex(r, g, b);
}

/** WCAG 2.x relative luminance (0-1). */
export function luminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const linearize = (v: number): number => {
		const srgb = v / 255;
		return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two colors (1-21). */
export function contrastRatio(hex1: string, hex2: string): number {
	const l1 = luminance(hex1);
	const l2 = luminance(hex2);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function complementary(hex: string): string {
	const hsl = hexToHsl(hex);
	return hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l);
}

export function desaturate(hex: string, amount: number): string {
	const hsl = hexToHsl(hex);
	return hslToHex(hsl.h, Math.max(0, hsl.s - amount), hsl.l);
}

export function lighten(hex: string, amount: number): string {
	const hsl = hexToHsl(hex);
	return hslToHex(hsl.h, hsl.s, Math.min(1, hsl.l + amount));
}

export function darken(hex: string, amount: number): string {
	const hsl = hexToHsl(hex);
	return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount));
}

export function isLight(hex: string): boolean {
	return luminance(hex) > 0.5;
}

/**
 * Iteratively adjust foreground color until WCAG contrast ratio meets minimum.
 * Uses 2% lightness steps. Falls back to black or white if no in-between works.
 */
export function ensureContrast(fg: string, bg: string, minRatio = 4.5): string {
	if (contrastRatio(fg, bg) >= minRatio) return fg;
	const bgIsLight = isLight(bg);
	let adjusted = fg;
	for (let i = 0; i < 50; i++) {
		adjusted = bgIsLight ? darken(adjusted, 0.02) : lighten(adjusted, 0.02);
		if (contrastRatio(adjusted, bg) >= minRatio) return adjusted;
	}
	return bgIsLight ? "#000000" : "#ffffff";
}

function colorDistance(a: RGB, b: RGB): number {
	return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Returns the top N most frequent, distinct colors from a list.
 * Merges visually similar colors using RGB Euclidean distance.
 */
export function dominantColors(colorList: string[], count: number, minDistance = 30): string[] {
	const freq = new Map<string, number>();
	for (const raw of colorList) {
		const hex = "#" + normalizeHex(raw).toLowerCase();
		freq.set(hex, (freq.get(hex) ?? 0) + 1);
	}
	const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
	const result: string[] = [];
	const selectedRgb: RGB[] = [];
	for (const [hex] of sorted) {
		if (result.length >= count) break;
		const rgb = hexToRgb(hex);
		const tooClose = selectedRgb.some((s) => colorDistance(s, rgb) < minDistance);
		if (!tooClose) {
			result.push(hex);
			selectedRgb.push(rgb);
		}
	}
	return result;
}
