import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { escapeXml } from "../lib/xml";

const COLLECTIONS = [
	{ slug: "dev", prefix: "dev" },
	{ slug: "design", prefix: "design" },
	{ slug: "policy", prefix: "policy" },
	{ slug: "writing", prefix: "writing" },
];

export const GET: APIRoute = async ({ site, url }) => {
	const siteUrl = site?.toString() || url.origin;
	const settings = await getSiteSettings();
	const siteTitle = settings?.title || "Studio";
	const siteDescription = settings?.tagline || "Design & Development";

	// Query all collections in parallel — same pattern as the home page
	const results = await Promise.all(
		COLLECTIONS.map(async (col) => {
			try {
				const { entries } = await getEmDashCollection(col.slug);
				return entries.map((e) => ({ ...e, _prefix: col.prefix }));
			} catch {
				return [];
			}
		}),
	);

	const allEntries = results
		.flat()
		.filter((e) => e.data.date || e.data.year)
		.sort((a, b) => {
			const da = a.data.date ? new Date(a.data.date).getTime() : parseInt(a.data.year || "0", 10) * 1e10;
			const db = b.data.date ? new Date(b.data.date).getTime() : parseInt(b.data.year || "0", 10) * 1e10;
			return db - da;
		})
		.slice(0, 20);

	const items = allEntries
		.map((entry) => {
			const pubDate = entry.data.date
				? new Date(entry.data.date).toUTCString()
				: new Date(`${entry.data.year}-01-01`).toUTCString();
			const entryUrl = escapeXml(`${siteUrl}/work/${entry._prefix}/${entry.id}`);
			const title = escapeXml(entry.data.title || "Untitled");
			const description = escapeXml(entry.data.summary || "");

			return `    <item>
      <title>${title}</title>
      <link>${entryUrl}</link>
      <guid isPermaLink="true">${entryUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
		})
		.join("\n");

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <description>${escapeXml(siteDescription)}</description>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

