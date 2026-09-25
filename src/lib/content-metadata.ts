/** CMS values are untyped at this boundary; omit malformed dates from XML output. */
export function contentDate(value: unknown): Date | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : undefined;
}

export function publicationDate(data: Record<string, unknown>): Date | undefined {
	const date = contentDate(data.date);
	if (date) return date;
	const year = String(data.year ?? "");
	// Project years may be ranges such as "2024–present"; use the start year.
	const match = /^(\d{4})(?:\s*[–—-]\s*(?:\d{4}|present))?$/.exec(year);
	return match ? contentDate(`${match[1]}-01-01T00:00:00Z`) : undefined;
}

export function contentText(value: unknown, fallback = ""): string {
	return typeof value === "string" && value ? value : fallback;
}
