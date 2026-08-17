/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { FakeWorker } from "./fake-worker";

// A separate file from the supported case on purpose: the module installs a
// non-configurable `window.thumbnailGen` on import, so one window cannot host
// both setups. Vitest isolates environments per file.
vi.stubGlobal("Worker", FakeWorker);
vi.stubGlobal("OffscreenCanvas", undefined);

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

const { thumbnailer } = await import("../../src/thumbnailer");

describe("Thumbnailer without OffscreenCanvas", () => {
	it("reports no support", () => {
		expect(thumbnailer.isSupported()).toBe(false);
	});

	it("never spawns a worker", () => {
		// Instantiating the worker would download and compile the 18 MB
		// Ghostscript WASM blob on a browser that cannot use the result.
		expect(FakeWorker.instances).toHaveLength(0);
	});

	it("reports the reason once, on the console", () => {
		expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("OffscreenCanvas"));
	});

	it("rejects createThumbnail rather than hanging", async () => {
		await expect(
			thumbnailer.createThumbnail({
				file: new Uint8Array([1]),
				filename: "a.pdf",
				mimeType: "application/pdf",
				maxWidth: 100,
			}),
		).rejects.toThrow("OffscreenCanvas is not supported");
	});

	it("rejects load() rather than hanging", async () => {
		await expect(thumbnailer.load()).rejects.toThrow("OffscreenCanvas is not supported");
	});

	it("produces no unhandled rejection at import time", async () => {
		// The constructor builds an already-rejected readyPromise. A page that
		// only calls isSupported() never awaits it, so without a terminal handler
		// every unsupported browser logged an unhandled-rejection error too.
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
		process.off("unhandledRejection", unhandled);

		expect(unhandled).not.toHaveBeenCalled();
	});
});
