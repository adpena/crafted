const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOT = /"/g;
const APOS = /'/g;

/** Escape special XML characters for safe embedding in XML documents. */
export function escapeXml(str: string): string {
	return str
		.replace(AMP, "&amp;")
		.replace(LT, "&lt;")
		.replace(GT, "&gt;")
		.replace(QUOT, "&quot;")
		.replace(APOS, "&apos;");
}
