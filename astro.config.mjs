import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import emdash from "emdash/astro";
import { actionPages } from "./plugin/src/index.ts";

const cms = emdash({
	database: d1({ binding: "DB", session: "auto" }),
	storage: r2({ binding: "MEDIA" }),
	// Switch to sandboxed: [actionPages()] for Worker isolate sandboxing (requires Workers Paid)
	plugins: [actionPages()],
});

// EmDash 0.1.0 unconditionally injects a sitemap even when the site supplies one.
// Keep our sitemap's static pages and work URLs without registering the route twice.
const setupCms = cms.hooks["astro:config:setup"];
cms.hooks["astro:config:setup"] = (options) => setupCms?.({
	...options,
	injectRoute(route) {
		if (route.pattern !== "/sitemap.xml") options.injectRoute(route);
	},
});

export default defineConfig({
	output: "server",
	adapter: cloudflare({ persistState: process.env.PORTFOLIO_TEST_STATE ? { path: process.env.PORTFOLIO_TEST_STATE } : true }),
	vite: {
		optimizeDeps: { include: ["react", "react-dom/client", "@adpena/notifications"] },
		resolve: {
			dedupe: ["react", "react-dom"],
			alias: {
				"@adpena/action-pages/sandbox": fileURLToPath(new URL("./plugin/src/sandbox-entry.ts", import.meta.url)),
				"@adpena/action-pages/admin": fileURLToPath(new URL("./plugin/src/admin/index.tsx", import.meta.url)),
				"@adpena/action-pages": fileURLToPath(new URL("./plugin/src/index.ts", import.meta.url)),
			},
		},
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		cms,
	],
	devToolbar: { enabled: false },
});
