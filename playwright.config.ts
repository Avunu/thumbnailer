import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4173);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: "tests/browser",
	// Ghostscript-WASM is an 18 MB module that has to be fetched, compiled and
	// instantiated before the first thumbnail; the default 30s is not enough on
	// a cold, single-core CI runner.
	timeout: 120_000,
	expect: { timeout: 30_000 },
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI
		? [["list"], ["json", { outputFile: "test-results/report.json" }]]
		: "list",

	use: {
		baseURL,
		launchOptions: {
			// The Nix build sandbox has no user namespaces, so Chromium's own
			// sandbox cannot start. Safe here: the only content loaded is this
			// repo's own build output, served from loopback.
			chromiumSandbox: false,
			args: ["--no-sandbox", "--disable-dev-shm-usage"],
		},
	},

	projects: [
		{
			// Plain "chromium", not a channel: the browser comes from
			// PLAYWRIGHT_BROWSERS_PATH in the Nix store, and asking for a channel
			// would send Playwright looking for a system Chrome install.
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],

	webServer: {
		command: "node tests/browser/server.mjs",
		url: `${baseURL}/health`,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
