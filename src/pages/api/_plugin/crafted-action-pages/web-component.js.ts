/**
 * Astro bridge route serving the Web Component loader script.
 *
 * The plugin route handler at plugin/src/routes/web-component.ts isn't
 * mounted directly by Astro — emdash routes are sandboxed. This bridge
 * imports the SCRIPT constant and serves it as a public JavaScript asset.
 *
 * URL: /api/_plugin/crafted-action-pages/web-component.js
 */

import type { APIRoute } from "astro";
import { WEB_COMPONENT_SCRIPT } from "../../../../../plugin/src/routes/web-component.ts";

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
