import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
	plugins: [
		wasm(),
		topLevelAwait()
	],
	build: {
		target: 'esnext',
	},
	optimizeDeps: {
		esbuildOptions: {
			target: "esnext",
		} as any,
		exclude: ["wasm-vips", "vips-es6", '@privyid/ghostscript'],
	},
	worker: {
		format: 'es'
	}
});