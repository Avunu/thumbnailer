import { expect, test, type Page } from "@playwright/test";

/**
 * The only tier that exercises the real machinery: Ghostscript compiled to
 * WebAssembly, UTIF, a live Web Worker and OffscreenCanvas, all driving the
 * bundle that actually ships. Everything below runs against dist/, not src/.
 */

interface SerializedResult {
	mimeType: string;
	sourceWidth: number;
	sourceHeight: number;
	width: number;
	height: number;
	xResolution?: number;
	yResolution?: number;
	resolutionUnit?: string;
	magic: number[];
	byteLength: number;
}

async function ready(page: Page): Promise<void> {
	await page.goto("/");
	await page.waitForFunction(() => window.thumbnailGen !== undefined);
	// createThumbnail awaits the worker's `ready` internally, but waiting here
	// keeps a WASM-init failure from being reported as a thumbnail failure.
	await page.waitForFunction(() => window.thumbnailGen.isInitialized(), undefined, {
		timeout: 90_000,
	});
}

function thumbnail(
	page: Page,
	fixture: string,
	mimeType: string,
	maxWidth: number,
): Promise<SerializedResult> {
	return page.evaluate(
		async (args) => {
			const response = await fetch(args.fixture);
			const bytes = new Uint8Array(await response.arrayBuffer());

			const result = await window.thumbnailGen.createThumbnail({
				file: bytes,
				filename: args.fixture,
				mimeType: args.mimeType,
				maxWidth: args.maxWidth,
			});

			// Uint8Array does not survive structured cloning back through
			// evaluate() in a useful shape, so send just what is asserted on.
			return {
				mimeType: result.mimeType,
				sourceWidth: result.sourceWidth,
				sourceHeight: result.sourceHeight,
				width: result.width,
				height: result.height,
				xResolution: result.xResolution,
				yResolution: result.yResolution,
				resolutionUnit: result.resolutionUnit,
				magic: Array.from(result.image.slice(0, 3)),
				byteLength: result.image.byteLength,
			};
		},
		{ fixture, mimeType, maxWidth },
	);
}

/** Every result is a JPEG, whatever went in. */
function expectJpeg(result: SerializedResult): void {
	expect(result.mimeType).toBe("image/jpeg");
	// SOI marker + the start of the APP0 segment.
	expect(result.magic).toEqual([0xff, 0xd8, 0xff]);
	expect(result.byteLength).toBeGreaterThan(100);
}

test.describe("browser support", () => {
	test("reports OffscreenCanvas support and exposes the API", async ({ page }) => {
		await ready(page);

		expect(await page.evaluate(() => window.thumbnailGen.isSupported())).toBe(true);
	});

	test("resolves the worker from import.meta.url under a module script", async ({ page }) => {
		// The page loads the bundle exactly as wp_enqueue_script_module() does:
		// a single <script type="module">, where document.currentScript is null.
		// If the import.meta.url fallback were wrong the worker would never
		// start, so reaching isInitialized() at all is the assertion.
		await ready(page);

		expect(await page.evaluate(() => document.currentScript)).toBeNull();
		expect(await page.evaluate(() => window.thumbnailGen.isInitialized())).toBe(true);
	});
});

test.describe("PDF via Ghostscript-WASM", () => {
	test("renders a page and scales it to the requested width", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(
			page,
			"/tests/browser/fixtures/sample.pdf",
			"application/pdf",
			120,
		);

		expectJpeg(result);
		// The fixture's MediaBox is 288x144 pt, and Ghostscript renders at 150
		// DPI: 288 * 150/72 = 600 exactly, with no rounding to reason about.
		expect(result.sourceWidth).toBe(600);
		expect(result.sourceHeight).toBe(300);
		expect(result.width).toBe(120);
		expect(result.height).toBe(60);
	});

	test("reports Ghostscript's render resolution", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(
			page,
			"/tests/browser/fixtures/sample.pdf",
			"application/pdf",
			120,
		);

		// PDFs carry no EXIF, so the library substitutes the DPI it rendered at.
		expect(result.xResolution).toBe(150);
		expect(result.yResolution).toBe(150);
		expect(result.resolutionUnit).toBe("inch");
	});

	test("accepts a PDF whose MIME type carries a charset parameter", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(
			page,
			"/tests/browser/fixtures/sample.pdf",
			"application/pdf; charset=binary",
			60,
		);

		// Were the parameter not stripped, this would fall through to
		// createImageBitmap and reject rather than reaching Ghostscript.
		expect(result.sourceWidth).toBe(600);
		expect(result.width).toBe(60);
	});
});

test.describe("TIFF via UTIF", () => {
	test("decodes and scales", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(page, "/tests/browser/fixtures/sample.tiff", "image/tiff", 20);

		expectJpeg(result);
		expect(result.sourceWidth).toBe(40);
		expect(result.sourceHeight).toBe(20);
		expect(result.width).toBe(20);
		expect(result.height).toBe(10);
	});

	test("round-trips the EXIF resolution tags", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(page, "/tests/browser/fixtures/sample.tiff", "image/tiff", 20);

		// The fixture is tagged 300 DPI in inches (ResolutionUnit 2).
		expect(result.xResolution).toBe(300);
		expect(result.yResolution).toBe(300);
		expect(result.resolutionUnit).toBe("inch");
	});
});

test.describe("plain images", () => {
	test("passes a PNG straight to createImageBitmap", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(page, "/tests/browser/fixtures/sample.png", "image/png", 16);

		expectJpeg(result);
		expect(result.sourceWidth).toBe(32);
		expect(result.sourceHeight).toBe(16);
		expect(result.width).toBe(16);
		expect(result.height).toBe(8);
	});

	test("scales up when the target exceeds the source", async ({ page }) => {
		await ready(page);
		const result = await thumbnail(page, "/tests/browser/fixtures/sample.png", "image/png", 64);

		expect(result.width).toBe(64);
		expect(result.height).toBe(32);
	});
});

test.describe("failure modes", () => {
	test("rejects rather than hanging on undecodable data", async ({ page }) => {
		await ready(page);

		const error = await page.evaluate(async () => {
			try {
				await window.thumbnailGen.createThumbnail({
					file: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
					filename: "broken.tiff",
					mimeType: "image/tiff",
					maxWidth: 50,
				});
				return null;
			} catch (err) {
				return err instanceof Error ? err.message : String(err);
			}
		});

		expect(error).not.toBeNull();
		expect(error).toMatch(/TIFF/iu);
	});

	test("survives a failed request and still serves the next one", async ({ page }) => {
		// A rejected request must be removed from the pending map, or the worker
		// is wedged for every caller afterwards.
		await ready(page);

		await page.evaluate(async () => {
			try {
				await window.thumbnailGen.createThumbnail({
					file: new Uint8Array([0, 0, 0, 0]),
					filename: "broken.tiff",
					mimeType: "image/tiff",
					maxWidth: 10,
				});
			} catch {
				/* expected */
			}
		});

		const result = await thumbnail(page, "/tests/browser/fixtures/sample.png", "image/png", 16);
		expect(result.width).toBe(16);
	});
});

test.describe("concurrency", () => {
	test("keeps three in-flight requests distinct", async ({ page }) => {
		await ready(page);

		const widths = await page.evaluate(async () => {
			const load = async (path: string) => new Uint8Array(await (await fetch(path)).arrayBuffer());

			const [pdf, tiff, png] = await Promise.all([
				load("/tests/browser/fixtures/sample.pdf"),
				load("/tests/browser/fixtures/sample.tiff"),
				load("/tests/browser/fixtures/sample.png"),
			]);

			const results = await Promise.all([
				window.thumbnailGen.createThumbnail({
					file: pdf,
					filename: "a.pdf",
					mimeType: "application/pdf",
					maxWidth: 30,
				}),
				window.thumbnailGen.createThumbnail({
					file: tiff,
					filename: "b.tiff",
					mimeType: "image/tiff",
					maxWidth: 40,
				}),
				window.thumbnailGen.createThumbnail({
					file: png,
					filename: "c.png",
					mimeType: "image/png",
					maxWidth: 50,
				}),
			]);

			return results.map((r) => r.width);
		});

		// Each promise must receive its own reply, not the first one to arrive.
		expect(widths).toEqual([30, 40, 50]);
	});
});
