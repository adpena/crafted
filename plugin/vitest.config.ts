import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only run unit tests in plugin/tests — exclude the repo-root e2e specs
		// which are Playwright tests and have a different runner.
		include: ["tests/**/*.test.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/e2e/**",
		],
	},
});
