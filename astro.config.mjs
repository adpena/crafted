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
	// Apply and verify core migrations explicitly before releasing new code.
	migrations: { runtime: "check", dev: "auto" },
	// Action Pages uses React admin components and the native plugin format.
	plugins: [actionPages()],
});

export default defineConfig({
	output: "server",
	redirects: {
		"/api/_plugin/action-pages/web-component.js": "/api/action/web-component.js",
	},
	adapter: cloudflare({ persistState: process.env.PORTFOLIO_TEST_STATE ? { path: process.env.PORTFOLIO_TEST_STATE } : true }),
	vite: {
		optimizeDeps: { include: ["react", "react-dom/client", "@adpena/notifications"] },
		// EmDash now prebundles its own runtime and internal middleware.
		ssr: { optimizeDeps: { include: ["@adpena/notifications"] } },
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
