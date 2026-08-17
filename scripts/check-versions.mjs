#!/usr/bin/env node
// Asserts that every place the version is written agrees.
//
// package.json is the source of truth: release-please bumps it natively and
// propagates the rest via `extra-files`, and flake.nix reads it to name the
// derivations and to re-stamp the shipped copies at build time. This script is
// the gate that catches a propagation target being added, renamed, or missed —
// which is exactly how this repo ended up shipping 1.0.3 in three files while
// readme.txt and the plugin header disagreed about everything else.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (file) => readFileSync(join(root, file), "utf8");

/** @type {(file: string, pattern: RegExp, label: string) => {label: string, file: string, version: string}} */
function extract(file, pattern, label) {
	const match = pattern.exec(read(file));
	if (!match?.[1]) {
		throw new Error(`${label}: no version found in ${file} (pattern ${pattern})`);
	}
	return { label, file, version: match[1] };
}

const sources = [
	extract("package.json", /"version":\s*"([^"]+)"/u, "package.json version"),
	extract("composer.json", /"version":\s*"([^"]+)"/u, "composer.json version"),
	extract("thumbnailer.php", /^\s*\*\s*Version:\s*(\S+)\s*$/mu, "plugin header Version"),
	extract(
		"thumbnailer.php",
		/define\(\s*'THUMBNAILER_VERSION'\s*,\s*'([^']+)'\s*\)/u,
		"THUMBNAILER_VERSION",
	),
	extract("readme.txt", /^Stable tag:\s*(\S+)\s*$/mu, "readme.txt Stable tag"),
];

const expected = sources[0].version;
const mismatched = sources.filter((s) => s.version !== expected);

if (mismatched.length > 0) {
	console.error(`Version mismatch. Expected ${expected} (from package.json):\n`);
	for (const s of sources) {
		const mark = s.version === expected ? "ok  " : "FAIL";
		console.error(`  ${mark}  ${s.version.padEnd(12)} ${s.label} (${s.file})`);
	}
	console.error("\nRun the release-please PR, or fix the outlier by hand.");
	process.exit(1);
}

console.log(`All ${sources.length} version references agree: ${expected}`);
