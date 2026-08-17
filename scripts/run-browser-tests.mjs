#!/usr/bin/env node
// Runs the Playwright suite, but refuses to pass if it collected nothing.
//
// The failure this guards against is specific and nasty: when two copies of
// @playwright/test are resolvable — npm's, from package-lock.json, and the Nix
// one the runner comes from — every test.afterEach() throws "did not expect
// ... to be called here" at *load* time. The reporters swallow it, and the run
// exits 0 having collected zero tests. A green check that ran nothing looks
// exactly like a green check that passed.
//
// flake.nix removes npm's copy and symlinks Nix's in its place, so this should
// never trip. It is here because the day it does trip, silence is the one
// outcome that costs real time.

import { spawnSync } from "node:child_process";

// Bumping this when tests are added is the point: it turns "the suite shrank"
// into a failure rather than a thing nobody notices.
const MINIMUM_TESTS = 12;

function playwright(args) {
	return spawnSync("playwright", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const listed = playwright(["test", "--list", "--reporter=json"]);
if (listed.status !== 0) {
	process.stderr.write(listed.stdout ?? "");
	process.stderr.write(listed.stderr ?? "");
	console.error("\nCould not enumerate the Playwright suite (see above).");
	process.exit(1);
}

let count = 0;
try {
	const report = JSON.parse(listed.stdout);
	const walk = (suite) => {
		count += suite.specs?.length ?? 0;
		for (const child of suite.suites ?? []) {
			walk(child);
		}
	};
	for (const suite of report.suites ?? []) {
		walk(suite);
	}
} catch (error) {
	console.error(`Could not parse the Playwright listing: ${error.message}`);
	process.exit(1);
}

if (count < MINIMUM_TESTS) {
	console.error(
		`Playwright collected ${count} tests, expected at least ${MINIMUM_TESTS}.\n` +
			"Either tests were removed without lowering MINIMUM_TESTS in this script, " +
			"or the suite failed to load (see the note at the top of this file).",
	);
	process.exit(1);
}

console.log(`Playwright collected ${count} tests; running them.`);

const run = spawnSync("playwright", ["test"], { stdio: "inherit" });
process.exit(run.status ?? 1);
