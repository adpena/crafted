import type { APIRoute } from "astro";

// Keep EmDash's collection sitemap URLs on the portfolio's filtered sitemap.
export const GET: APIRoute = ({ url, redirect }) => redirect(new URL("/sitemap.xml", url).href, 301);
