/**
 * Astro bridge route serving the Web Component loader script.
 *
 * EmDash's raw API responses disallow active JavaScript. This site route
 * serves the loader; the corresponding plugin route redirects here.
 *
 * URL: /api/action/web-component.js
 */

import type { APIRoute } from "astro";
import { WEB_COMPONENT_SCRIPT } from "../../../../plugin/src/routes/web-component.ts";

export const GET: APIRoute = async () => {
	return new Response(WEB_COMPONENT_SCRIPT, {
		status: 200,
		headers: {
			"Content-Type": "application/javascript; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"X-Content-Type-Options": "nosniff",
		},
	});
};
