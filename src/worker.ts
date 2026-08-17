import { initializeGhostscript, renderPageAsImage } from "./ghostscript";
import type { ThumbnailResult, WorkerRequest, WorkerResponse, UTIFModule } from "./types";
import { isPostScriptType, isTiffType } from "./mime";
import { calculateAspectRatio } from "./geometry";
import { extractResolution, type ResolutionMetadata } from "./metadata";
// Untyped JS library. `third-party/utif` is not committed — it is symlinked in
// from the `utif` flake input by both the Nix derivation's postPatch and the
// dev shell's shellHook, so `nix build` and `nix develop` resolve the same
// pinned source. See flake.nix.
// @ts-expect-error - no type declarations ship with UTIF.js
import UTIFImport from "../third-party/utif/UTIF.js";
import ExifReader from "exifreader";

const UTIF = UTIFImport as unknown as UTIFModule;

// Kick off WASM initialisation as soon as the worker loads, rather than at the
// first request, and announce `ready` only once it has finished.
//
// Note on lint config: `unicorn/require-post-message-target-origin` is disabled
// repo-wide because of this file. Inside a DedicatedWorkerGlobalScope,
// self.postMessage() is the worker-to-page channel and takes (message,
// transfer) — the targetOrigin argument belongs to window.postMessage. Taking
// the rule's advice would pass an origin string where a transfer list is
// expected and break every reply.
initializeGhostscript()
	.then(() => {
		self.postMessage({ type: "ready", id: "worker" });
	})
	.catch((error: unknown) => {
		console.error("Failed to initialize ghostscript:", error);
		const message = error instanceof Error ? error.message : String(error);
		self.postMessage({
			type: "error",
			id: "worker",
			error: `Failed to initialize worker: ${message}`,
		});
	});

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const { type, id, payload } = event.data;
	const response: WorkerResponse = { type: "error", id, error: "Unknown error" };

	try {
		switch (type) {
			case "createThumbnail": {
				if (!payload) throw new Error("No payload provided");

				// Convert File to Uint8Array if needed (this happens in the worker, off main thread)
				// Note: File objects passed via postMessage retain their arrayBuffer method
				// but lose their prototype, so we check for the method instead of instanceof
				let fileData: Uint8Array;
				if (payload.file instanceof Uint8Array) {
					fileData = payload.file;
				} else if (payload.file && typeof payload.file.arrayBuffer === "function") {
					fileData = new Uint8Array(await payload.file.arrayBuffer());
				} else {
					throw new Error("Invalid file data: expected File or Uint8Array");
				}

				response.type = "result";
				response.payload = await createThumbnail(fileData, payload.mimeType, payload.maxWidth);
				break;
			}

			default:
				throw new Error(`Unknown request type: ${type}`);
		}
	} catch (error) {
		response.type = "error";
		response.error = error instanceof Error ? error.message : String(error);
		console.error("Worker error:", response.error);
	}

	self.postMessage(response);
};

async function extractMetadata(data: Uint8Array, mimeType: string): Promise<ResolutionMetadata> {
	// PostScript/PDF carry no EXIF; Ghostscript's render DPI is supplied instead.
	if (isPostScriptType(mimeType)) {
		return {};
	}

	try {
		// No `domParser` is passed: DOMParser does not exist in a Web Worker, and
		// ExifReader skips XMP when it cannot parse XML. (This used to pass an
		// `excludeTags: {xmp: true}` option, which ExifReader has no such option
		// for — it was silently ignored, and the excess property broke the
		// ArrayBuffer overload so the call never typechecked.)
		const tags = await ExifReader.load(data.buffer as ArrayBuffer, { async: true });
		return extractResolution(tags);
	} catch (error) {
		console.warn(`Failed to extract metadata for ${mimeType}:`, error);
		return {};
	}
}

async function convertTiffToJpeg(data: Uint8Array): Promise<{
	jpegData: Uint8Array;
	metadata: ResolutionMetadata;
}> {
	try {
		// Decode TIFF file
		const ifds = UTIF.decode(data.buffer as ArrayBuffer);
		if (!ifds || ifds.length === 0) {
			throw new Error("Failed to decode TIFF: No image data found");
		}

		// Extract resolution metadata
		const metadata = await extractMetadata(data, "image/tiff");

		// Try to decode the image and catch any errors
		try {
			UTIF.decodeImage(data.buffer as ArrayBuffer, ifds[0]);
		} catch (err) {
			console.error("Error decoding TIFF image:", err);
			throw new Error("Failed to decode TIFF image data", { cause: err });
		}

		// Check if image data was actually decoded
		if (!ifds[0].data) {
			throw new Error("No pixel data found in TIFF");
		}

		// Convert to RGBA
		const rgba = UTIF.toRGBA8(ifds[0]);
		if (!rgba || rgba.length === 0) {
			throw new Error("Failed to convert TIFF to RGBA format");
		}

		// Create canvas and draw RGBA data
		const width = ifds[0].width as number;
		const height = ifds[0].height as number;

		if (!width || !height || width <= 0 || height <= 0) {
			throw new Error(`Invalid TIFF dimensions: ${width}x${height}`);
		}

		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Could not create canvas context for TIFF conversion");
		}

		// Put image data
		const imageData = new ImageData(
			new Uint8ClampedArray(rgba.buffer as ArrayBuffer),
			width,
			height,
		);
		ctx.putImageData(imageData, 0, 0);

		// Convert to JPEG blob
		const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
		const jpegData = new Uint8Array(await blob.arrayBuffer());

		return { jpegData, metadata };
	} catch (error) {
		console.error("TIFF conversion error:", error);
		throw new Error(
			`Failed to convert TIFF: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

async function createImageFromData(data: Uint8Array, mimeType: string): Promise<ImageBitmap> {
	const blob = new Blob([data as BlobPart], { type: mimeType });
	return await createImageBitmap(blob);
}

async function createThumbnail(
	data: Uint8Array,
	mimeType: string,
	maxWidth: number,
): Promise<ThumbnailResult> {
	let sourceBitmap: ImageBitmap;
	let metadata: ResolutionMetadata = {};

	// Convert TIFF/PostScript to JPEG if needed
	if (isPostScriptType(mimeType)) {
		// PostScript/PDF don't have EXIF metadata, and GhostScript output is raw JPEG
		const jpegData = await renderPageAsImage(data);
		sourceBitmap = await createImageFromData(jpegData, "image/jpeg");
		// GhostScript renders at 150 DPI by default
		metadata = { xResolution: 150, yResolution: 150, resolutionUnit: "inch" };
	} else if (isTiffType(mimeType)) {
		const { jpegData, metadata: tiffMetadata } = await convertTiffToJpeg(data);
		sourceBitmap = await createImageFromData(jpegData, "image/jpeg");
		metadata = tiffMetadata;
	} else {
		sourceBitmap = await createImageFromData(data, mimeType);
		metadata = await extractMetadata(data, mimeType);
	}

	// Calculate dimensions based on target width only
	const { width, height } = calculateAspectRatio(sourceBitmap.width, sourceBitmap.height, maxWidth);

	// Create destination canvas and resize
	const destCanvas = new OffscreenCanvas(width, height);
	const ctx = destCanvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get 2D canvas context");
	}
	ctx.drawImage(sourceBitmap, 0, 0, width, height);

	// Convert to JPEG blob
	const blob = await destCanvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
	const buffer = await blob.arrayBuffer();

	return {
		image: new Uint8Array(buffer),
		mimeType: "image/jpeg",
		sourceWidth: sourceBitmap.width,
		sourceHeight: sourceBitmap.height,
		width,
		height,
		...metadata, // Include resolution metadata in the result
	};
}
