import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { escapeXml } from "../lib/xml";

const COLLECTIONS = [
	{ slug: "dev", prefix: "work/dev" },
	{ slug: "design", prefix: "work/design" },
	{ slug: "policy", prefix: "work/policy" },
	{ slug: "writing", prefix: "work/writing" },
];

const STATIC_PAGES = [
	{ path: "/", priority: "1.0" },
	{ path: "/articles", priority: "0.8" },
	{ path: "/action-pages", priority: "0.8" },
	{ path: "/about", priority: "0.8" },
	{ path: "/contact", priority: "0.8" },
];

export const GET: APIRoute = async ({ url }) => {
	const siteUrl = (url.origin).replace(/\/$/, "");

	const results = await Promise.all(
		COLLECTIONS.map(async (col) => {
			try {
				const { entries } = await getEmDashCollection(col.slug);
				return entries.map((e) => ({
					loc: `${siteUrl}/${col.prefix}/${e.id}`,
					lastmod: e.data.updatedAt || e.data.date || null,
				}));
			} catch {
				return [];
			}
		}),
	);

	const dynamicUrls = results.flat();

	const urls = [
		...STATIC_PAGES.map((p) => `  <url>
    <loc>${escapeXml(siteUrl + p.path)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
		...dynamicUrls.map((u) => {
			const lastmod = u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : "";
			return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
		}),
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
