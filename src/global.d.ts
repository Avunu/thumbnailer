// Global ambient type declarations
// This file has no imports/exports, so TypeScript automatically includes it globally

// Extend the global Window interface
declare global {
	interface Window {
		thumbnailGen: import('./types').ThumbnailerInterface;
	}
}

// Required export to make this a proper module file when using declare global
export {};
