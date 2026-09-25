import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Run site and plugin unit tests; Playwright specs have a separate runner.
		include: ["tests/**/*.test.ts", "plugin/tests/**/*.test.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/e2e/**",
			"**/*.spec.ts",
		],
	},
});
