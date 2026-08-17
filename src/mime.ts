// MIME sniffing for the two formats that need decoding before they can reach a
// canvas: PostScript/PDF (via Ghostscript-WASM) and TIFF (via UTIF). Everything
// else goes straight to `createImageBitmap`.
//
// Kept in its own module — free of the WASM init and `self.onmessage` side
// effects in worker.ts — so it can be imported by tests and by the library
// without spawning a worker.

const POSTSCRIPT_TYPES: ReadonlySet<string> = new Set([
	"application/postscript",
	"application/ps",
	"application/x-eps",
	"application/x-postscript",
	"application/x-postscript-not-eps",
	"application/x-ps",
	"application/pdf",
	"image/eps",
	"image/x-eps",
	"text/postscript",
]);

const TIFF_TYPES: ReadonlySet<string> = new Set([
	"application/tif",
	"application/tiff",
	"application/x-tif",
	"application/x-tiff",
	"image/tif",
	"image/tiff",
	"image/tiff-fx",
	"image/x-tif",
	"image/x-tiff",
]);

/** Normalizes a MIME type for lookup: lowercased, without any `; charset=…`. */
function normalize(mimeType: string): string {
	return mimeType.split(";")[0]!.trim().toLowerCase();
}

export function isPostScriptType(mimeType: string): boolean {
	return POSTSCRIPT_TYPES.has(normalize(mimeType));
}

export function isTiffType(mimeType: string): boolean {
	return TIFF_TYPES.has(normalize(mimeType));
}
