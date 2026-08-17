#!/usr/bin/env node
// WordPress integration tests.
//
// Boots real WordPress on WASM PHP — no Docker, no database, no wp-env — with
// the *released zip* extracted and mounted as the plugin, then drives it over
// HTTP. This is the only tier that exercises the artifact users install: a
// broken zip layout, a missing vendor/autoload.php, or an enqueue that fires on
// the wrong page all surface here and nowhere else.
//
// Unlike every other check, this one needs the network: @wp-playground/cli
// downloads WordPress and php.wasm on first run and caches them. That is why it
// runs under `nix develop` in CI rather than as a sandboxed `nix build`.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runCLI } from "@wp-playground/cli";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const zipPath = process.env.THUMBNAILER_ZIP ?? join(repoRoot, "result", "thumbnailer.zip");
const PORT = Number(process.env.PLAYGROUND_PORT ?? 9400);

// Read the expected version rather than hard-coding it. package.json is the
// source of truth that flake.nix stamps into the plugin at build time, and
// Release Please rewrites it — a literal here fails on the one PR that most
// needs to pass, the release PR itself. Asserting against it also makes this a
// stronger check: it proves the build-time stamping actually happened.
const expectedVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;

// ── Assertions ──────────────────────────────────────────────────────────────
let failures = 0;
let passes = 0;

function check(name, condition, detail = "") {
	if (condition) {
		passes += 1;
		console.log(`  ok   ${name}`);
	} else {
		failures += 1;
		console.error(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
	}
}

// WP_DEBUG_DISPLAY is on, so anything PHP complains about lands in the markup.
// The original plugin called filemtime() on an absent dist/ for every single
// post view; that produced exactly this kind of output.
const PHP_DIAGNOSTICS = /(Warning|Notice|Deprecated|Fatal error|Parse error):/u;

function checkNoPhpDiagnostics(label, html) {
	const match = PHP_DIAGNOSTICS.exec(html);
	check(`${label}: no PHP warnings or notices`, match === null, match ? match[0] : "");
}

// ── Plugin under test ───────────────────────────────────────────────────────
if (!existsSync(zipPath)) {
	console.error(
		`No plugin zip at ${zipPath}.\nBuild one first:  nix build .#zip\n` +
			"Or point THUMBNAILER_ZIP at an existing archive.",
	);
	process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "thumbnailer-playground-"));
console.log(`Extracting ${zipPath}`);
execFileSync("unzip", ["-q", zipPath, "-d", workDir], { stdio: "inherit" });

// The zip must contain a single top-level thumbnailer/ directory — that is what
// WordPress's "Upload Plugin" unpacks into wp-content/plugins/.
const pluginDir = join(workDir, "thumbnailer");
check("zip contains a top-level thumbnailer/ directory", existsSync(pluginDir));
check("zip ships the plugin bootstrap", existsSync(join(pluginDir, "thumbnailer.php")));
check("zip ships the composer autoloader", existsSync(join(pluginDir, "vendor", "autoload.php")));
check("zip ships the built library", existsSync(join(pluginDir, "dist", "thumbnailer.js")));
check("zip ships the worker", existsSync(join(pluginDir, "dist", "worker.js")));
check("zip ships the Ghostscript WASM blob", existsSync(join(pluginDir, "dist", "gs.wasm")));
check("zip ships the plugin class", existsSync(join(pluginDir, "src", "php", "Plugin.php")));

const setupPhp = `<?php
require_once '/wordpress/wp-load.php';

$enabled = wp_insert_post([
    'post_title'   => 'Thumbnailer Enabled',
    'post_name'    => 'thumbnailer-enabled',
    'post_type'    => 'page',
    'post_status'  => 'publish',
    'post_content' => 'This page should load the library.',
]);

wp_insert_post([
    'post_title'   => 'Thumbnailer Disabled',
    'post_name'    => 'thumbnailer-disabled',
    'post_type'    => 'page',
    'post_status'  => 'publish',
    'post_content' => 'This page should not load the library.',
]);

// Only the first page is opted in. Referring to it by ID is the point: this is
// the value an administrator types into Settings > Thumbnailer.
update_option('thumbnailer_options', ['post_ids' => (string) $enabled]);
`;

console.log(`Booting WordPress on port ${PORT}...`);

const server = await runCLI({
	command: "server",
	port: PORT,
	quiet: true,
	skipBrowser: true,
	mount: [{ hostPath: pluginDir, vfsPath: "/wordpress/wp-content/plugins/thumbnailer" }],
	blueprint: {
		landingPage: "/",
		steps: [
			{
				step: "defineWpConfigConsts",
				consts: { WP_DEBUG: true, WP_DEBUG_DISPLAY: true, WP_DEBUG_LOG: false },
			},
			{ step: "activatePlugin", pluginPath: "thumbnailer/thumbnailer.php" },
			{ step: "runPHP", code: setupPhp },
		],
	},
});

try {
	const base = server.serverUrl.replace(/\/$/u, "");
	const get = async (path) => {
		const response = await fetch(`${base}${path}`);
		return { status: response.status, html: await response.text() };
	};

	// Reaching this point at all means the plugin activated: activatePlugin
	// fails the blueprint if the bootstrap fatals, which is what a zip missing
	// vendor/autoload.php would do.
	check("plugin activates without fataling", true);

	console.log("\nConfigured page:");
	const enabled = await get("/?pagename=thumbnailer-enabled");
	check("returns 200", enabled.status === 200, `got ${enabled.status}`);

	// Pull the whole tag out and assert against it, rather than matching
	// attributes in a fixed order: WordPress emits them as id, src, type.
	const tag = /<script\b[^>]*thumbnailer\/dist\/thumbnailer\.js[^>]*>/u.exec(enabled.html)?.[0];
	check("enqueues the library", tag !== undefined);
	check(
		"enqueues it as a script module",
		tag !== undefined && /type=["']module["']/u.test(tag),
		"the bundle is ESM and spawns a module worker; a classic script tag would fail outright",
	);
	check(
		`cache-busts on the plugin version (${expectedVersion})`,
		tag !== undefined && tag.includes(`thumbnailer.js?ver=${expectedVersion}`),
		`expected ?ver=${expectedVersion} — a filemtime() cache-buster would show a timestamp, or 1 under Nix.\n       got: ${tag ?? "(no tag)"}`,
	);
	checkNoPhpDiagnostics("configured page", enabled.html);

	console.log("\nUnconfigured page:");
	const disabled = await get("/?pagename=thumbnailer-disabled");
	check("returns 200", disabled.status === 200, `got ${disabled.status}`);
	check(
		"does not enqueue the library",
		!disabled.html.includes("dist/thumbnailer.js"),
		"the library loaded on a page that was never opted in",
	);
	checkNoPhpDiagnostics("unconfigured page", disabled.html);

	console.log("\nHome / archive:");
	const home = await get("/");
	check("returns 200", home.status === 200, `got ${home.status}`);
	check("does not enqueue the library", !home.html.includes("dist/thumbnailer.js"));
	// The original enqueue ran filemtime() before checking the post list, so a
	// missing dist/ warned on every single or page view regardless of opt-in.
	checkNoPhpDiagnostics("home", home.html);

	console.log("\nAdmin settings page:");
	const settings = await get("/wp-admin/options-general.php?page=thumbnailer");
	// Logged out, so a redirect to the login screen is the correct outcome; what
	// matters is that registering the page did not fatal.
	check(
		"is registered and does not fatal",
		settings.status === 200 || settings.status === 302,
		`got ${settings.status}`,
	);
	checkNoPhpDiagnostics("admin", settings.html);

	console.log("\nStatic assets:");
	const worker = await get("/wp-content/plugins/thumbnailer/dist/worker.js");
	check("worker.js is served", worker.status === 200, `got ${worker.status}`);
} finally {
	await server[Symbol.asyncDispose]();
	rmSync(workDir, { recursive: true, force: true });
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures > 0 ? 1 : 0);
