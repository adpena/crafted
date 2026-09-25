import { isPublicPortfolioSlug } from "../lib/portfolio-content";
import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { contentDate } from "../lib/content-metadata";
import { escapeXml } from "../lib/xml";

const COLLECTIONS = [
	{ slug: "dev", prefix: "work/dev" },
	{ slug: "design", prefix: "work/design" },
	{ slug: "policy", prefix: "work/policy" },
	{ slug: "writing", prefix: "work/writing" },
];

const STATIC_PAGES = [
	{ path: "/", priority: "1.0" },
	{ path: "/work", priority: "0.8" },
	{ path: "/action-pages", priority: "0.8" },
	{ path: "/about", priority: "0.8" },
	{ path: "/contact", priority: "0.8" },
	{ path: "/resume/software", priority: "0.7" },
	{ path: "/resume/research", priority: "0.7" },
	{ path: "/demo/molt", priority: "0.6" },
	{ path: "/demo/notifications", priority: "0.6" },
	{ path: "/demo/inflation", priority: "0.6" },
	{ path: "/demo/respect-map", priority: "0.6" },
];

export const GET: APIRoute = async ({ url }) => {
	const siteUrl = (url.origin).replace(/\/$/, "");

	const results = await Promise.all(
		COLLECTIONS.map(async (col) => {
			try {
				const { entries } = await getEmDashCollection(col.slug);
				return entries.filter((e) => isPublicPortfolioSlug(e.id)).map((e) => ({
					loc: `${siteUrl}/${col.prefix}/${e.id}`,
					lastmod: contentDate(e.data.updatedAt) ?? contentDate(e.data.date),
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
			const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod.toISOString()}</lastmod>` : "";
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
