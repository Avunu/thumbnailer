import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import wasm from "@rollup/plugin-wasm";
import copy from "rollup-plugin-copy";
import { resolve as resolvePath } from "node:path";

const wasmSource = resolvePath(
	import.meta.dirname,
	"node_modules/@privyid/ghostscript/dist/gs.wasm",
);

// The demo bundle writes into demo/ — inside the source tree — so building it
// unconditionally made every `npm run build` dirty the working tree and broke
// any `git diff --exit-code` gate. It is opt-in via `npm run build:demo`.
const includeDemo = process.env.BUILD_DEMO === "1";

const library = {
	input: "src/thumbnailer.ts",
	output: [
		{
			file: "dist/thumbnailer.js",
			format: "es",
			sourcemap: true,
			exports: "named",
		},
		{
			file: "dist/thumbnailer.umd.js",
			format: "umd",
			name: "Thumbnailer",
			sourcemap: true,
			exports: "named",
		},
	],
	// Nothing is external: both bundles inline their dependencies, which is why
	// @privyid/ghostscript and exifreader are devDependencies rather than
	// runtime ones. (This used to mark @privyid/ghostscript external even though
	// the library entry never imports it — a no-op that would have silently
	// emitted an unresolvable bare import the moment it did.)
	plugins: [
		typescript(),
		resolve({
			browser: true,
			extensions: [".js", ".ts", ".tsx", ".wasm"],
		}),
		commonjs(),
		wasm({ targetEnv: "auto" }),
	],
};

const worker = {
	input: "src/worker.ts",
	output: {
		file: "dist/worker.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript(),
		resolve({ browser: true, extensions: [".js", ".ts", ".tsx", ".wasm"] }),
		commonjs(),
		wasm({ targetEnv: "auto" }),
		copy({ targets: [{ src: wasmSource, dest: "dist" }] }),
	],
};

const demo = {
	input: "demo/demo.ts",
	output: {
		file: "demo/demo.js",
		format: "iife",
		sourcemap: true,
	},
	plugins: [
		typescript({
			tsconfig: "demo/tsconfig.json",
			compilerOptions: { declaration: false, declarationMap: false },
		}),
		resolve({ browser: true, extensions: [".ts", ".js"] }),
		commonjs(),
	],
};

export default includeDemo ? [demo] : [library, worker];
