/**
 * Helper function to preload WASM files
 * This helps ensure the WASM files are available when needed
 */
export async function preloadWasm(path: string): Promise<ArrayBuffer> {
	console.log(`Preloading WASM from: ${path}`);
	try {
		const response = await fetch(path);
		if (!response.ok) {
			throw new Error(`Failed to fetch WASM file: ${response.status} ${response.statusText}`);
		}
		return await response.arrayBuffer();
	} catch (error) {
		console.error(`Error preloading WASM: ${error}`);
		throw error;
	}
}
