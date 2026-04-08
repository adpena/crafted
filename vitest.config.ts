import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only run unit tests (*.test.ts) — exclude Playwright e2e specs
		// and the plugin's own test suite (which has its own vitest config).
		include: ["tests/**/*.test.ts", "plugin/tests/**/*.test.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/e2e/**",
			"**/*.spec.ts",
		],
	},
});
