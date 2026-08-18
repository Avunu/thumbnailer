import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "rolldown";

/**
 * Rolldown replaced a Rollup pipeline of five plugins: @rollup/plugin-typescript,
 * -node-resolve, -commonjs and -wasm, plus rollup-plugin-copy. TypeScript
 * transformation, node resolution and CommonJS interop are all built in, so the
 * file copy below is the only thing still needing a plugin.
 *
 * Rolldown transpiles TypeScript without typechecking it. That is not a loss of
 * coverage: `npm run build` runs `tsc -p tsconfig.build.json` first to emit the
 * published declarations, and that pass typechecks src/ and fails the build on
 * an error. `npm run check` covers everything else.
 */

const ghostscriptWasm = resolve(
	import.meta.dirname,
	"node_modules/@privyid/ghostscript/dist/gs.wasm",
);

/**
 * @privyid/ghostscript fetches gs.wasm at run time rather than importing it, so
 * no bundler can discover it — it has to be placed next to worker.js by hand.
 * This is also why there is no wasm plugin: nothing in src/ imports a .wasm
 * module.
 */
function copyGhostscriptWasm(destination: string): Plugin {
	return {
		name: "copy-gs-wasm",
		writeBundle() {
			mkdirSync(dirname(destination), { recursive: true });
			copyFileSync(ghostscriptWasm, destination);
		},
	};
}

/**
 * `import.meta.url` has no meaning outside an ES module, and thumbnailer.ts
 * relies on it to locate worker.js. Rollup polyfilled it in UMD and IIFE output;
 * Rolldown deliberately does not, and emits `{}.url` instead — so the UMD bundle
 * built `new URL("./worker.js", undefined)`, which throws.
 *
 * The shim is defined per-output rather than globally because `transform.define`
 * is build-level: applying it to the ESM bundle too would replace a construct
 * that is perfectly valid there. Hence the library is built as two configs.
 */
const IMPORT_META_URL = "__thumbnailer_import_meta_url__";
const importMetaUrlShim =
	`var ${IMPORT_META_URL} = (typeof document !== "undefined" && document.currentScript ` +
	`&& document.currentScript.src) || (typeof document !== "undefined" ? document.baseURI : "");`;

// The demo bundle writes into demo/ — inside the source tree — so building it
// unconditionally made every `npm run build` dirty the working tree and broke
// any `git diff --exit-code` gate. It is opt-in via `npm run build:demo`.
const includeDemo = process.env.BUILD_DEMO === "1";

const libraryEsm = {
	input: "src/thumbnailer.ts",
	platform: "browser" as const,
	output: {
		file: "dist/thumbnailer.js",
		format: "esm" as const,
		sourcemap: true,
		exports: "named" as const,
	},
};

const libraryUmd = {
	input: "src/thumbnailer.ts",
	platform: "browser" as const,
	transform: { define: { "import.meta.url": IMPORT_META_URL } },
	output: {
		file: "dist/thumbnailer.umd.js",
		format: "umd" as const,
		name: "Thumbnailer",
		sourcemap: true,
		exports: "named" as const,
		intro: importMetaUrlShim,
	},
};

const worker = {
	input: "src/worker.ts",
	platform: "browser" as const,
	plugins: [copyGhostscriptWasm(resolve(import.meta.dirname, "dist/gs.wasm"))],
	output: { file: "dist/worker.js", format: "esm" as const, sourcemap: true },
};

const demo = {
	input: "demo/demo.ts",
	platform: "browser" as const,
	output: { file: "demo/demo.js", format: "iife" as const, sourcemap: true },
};

export default defineConfig(includeDemo ? [demo] : [libraryEsm, libraryUmd, worker]);
