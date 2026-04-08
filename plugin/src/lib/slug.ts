/** Regex for valid action page slugs: lowercase alphanumeric + hyphens, starting with alphanumeric */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Validate a slug and return a user-friendly error message, or null if valid */
export function validateSlug(slug: unknown): string | null {
	if (!slug || typeof slug !== "string") return "Slug is required";
	if (!SLUG_RE.test(slug)) return "Slug must be lowercase letters, numbers, and hyphens";
	if (slug.length > 63) return "Slug must be 63 characters or less";
	return null;
}
