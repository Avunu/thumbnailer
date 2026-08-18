import { expect, test, type Page } from "@playwright/test";

/**
 * Covers the UMD bundle, loaded the way a UMD consumer loads it: a classic
 * <script>, not a module.
 *
 * This is a materially different code path from thumbnail.spec.ts, and it had
 * no coverage until the Rolldown migration. It was broken in two independent
 * ways, neither of which the ESM tests could ever have caught:
 *
 *   - `import.meta.url` has no meaning outside a module. Rollup polyfilled it
 *     for UMD output; Rolldown does not, and emitted `{}.url`, so the bundle
 *     computed `new URL("./worker.js", undefined)` and threw.
 *   - The worker URL came from `scriptUrl.replace("thumbnailer.js", ...)`,
 *     which is a no-op on "thumbnailer.umd.js" — that filename does not contain
 *     the substring. The bundle therefore passed its own URL to new Worker()
 *     and tried to run the library as its own worker.
 */

async function ready(page: Page): Promise<void> {
	await page.goto("/umd");
	await page.waitForFunction(() => window.thumbnailGen !== undefined);
	await page.waitForFunction(() => window.thumbnailGen.isInitialized(), undefined, {
		timeout: 90_000,
	});
}

test.describe("UMD bundle", () => {
	test("exposes the global and initializes", async ({ page }) => {
		await ready(page);

		expect(await page.evaluate(() => window.thumbnailGen.isSupported())).toBe(true);
		// The UMD wrapper also assigns the configured global name.
		expect(
			await page.evaluate(() => typeof (window as never as { Thumbnailer: unknown }).Thumbnailer),
		).not.toBe("undefined");
	});

	test("resolves the worker as a sibling despite the .umd. filename", async ({ page }) => {
		const workerRequests: string[] = [];
		page.on("request", (request) => {
			if (request.url().endsWith(".js")) {
				workerRequests.push(new URL(request.url()).pathname);
			}
		});

		await ready(page);

		// The decisive assertion: worker.js must have been fetched. If the URL
		// derivation regressed, the browser would request thumbnailer.umd.js a
		// second time and the worker would never signal ready.
		expect(workerRequests).toContain("/dist/worker.js");
	});

	test("generates a thumbnail end to end", async ({ page }) => {
		await ready(page);

		const result = await page.evaluate(async () => {
			const bytes = new Uint8Array(
				await (await fetch("/tests/browser/fixtures/sample.png")).arrayBuffer(),
			);
			const thumbnail = await window.thumbnailGen.createThumbnail({
				file: bytes,
				filename: "sample.png",
				mimeType: "image/png",
				maxWidth: 16,
			});
			return {
				width: thumbnail.width,
				height: thumbnail.height,
				mimeType: thumbnail.mimeType,
				magic: Array.from(thumbnail.image.slice(0, 3)),
			};
		});

		expect(result).toEqual({
			width: 16,
			height: 8,
			mimeType: "image/jpeg",
			magic: [0xff, 0xd8, 0xff],
		});
	});

	test("renders a PDF through Ghostscript-WASM", async ({ page }) => {
		// Proves the worker the UMD build spawned is the real one, not the
		// library re-entering itself.
		await ready(page);

		const result = await page.evaluate(async () => {
			const bytes = new Uint8Array(
				await (await fetch("/tests/browser/fixtures/sample.pdf")).arrayBuffer(),
			);
			const thumbnail = await window.thumbnailGen.createThumbnail({
				file: bytes,
				filename: "sample.pdf",
				mimeType: "application/pdf",
				maxWidth: 120,
			});
			return { sourceWidth: thumbnail.sourceWidth, width: thumbnail.width };
		});

		expect(result).toEqual({ sourceWidth: 600, width: 120 });
	});
});
