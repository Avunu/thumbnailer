// Ambient declaration for @rollup/plugin-wasm imports.
//
// Deliberately its own file with no imports or exports: `declare module "*.wasm"`
// is an ambient module declaration, and inside a file that is itself a module it
// would be parsed as a module *augmentation* and rejected.
declare module "*.wasm" {
	const src: string;
	export default src;
}
