import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import emdash from "emdash/astro";
import { actionPages } from "./plugin/src/index.ts";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	vite: {
		resolve: {
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
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			// Switch to sandboxed: [actionPages()] for Worker isolate sandboxing (requires Workers Paid)
			plugins: [actionPages()],
		}),
	],
	devToolbar: { enabled: false },
});
