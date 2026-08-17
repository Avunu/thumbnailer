import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/unit/**/*.test.ts"],
		// Node by default; the files that need a DOM opt in with a
		// `@vitest-environment jsdom` docblock. Each file gets its own
		// environment, which matters for the thumbnailer tests: the module
		// installs a non-configurable `window.thumbnailGen` on import, so two
		// different global setups cannot share one window.
		environment: "node",
	},
});
