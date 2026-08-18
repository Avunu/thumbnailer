/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FakeWorker, thumbnailResult } from "./fake-worker";
import type { ThumbnailResult } from "../../src/types";

// Both globals must exist before the module is imported: it constructs its
// singleton at import time and probes OffscreenCanvas in the constructor.
vi.stubGlobal("OffscreenCanvas", class {});
vi.stubGlobal("Worker", FakeWorker);

const { thumbnailer } = await import("../../src/thumbnailer");

const options = { file: new Uint8Array([1]), filename: "a.pdf", mimeType: "application/pdf" };

describe("Thumbnailer in a capable browser", () => {
	beforeAll(async () => {
		await vi.waitFor(() => {
			expect(thumbnailer.isInitialized()).toBe(true);
		});
	});

	it("reports support", () => {
		expect(thumbnailer.isSupported()).toBe(true);
	});

	it("spawns exactly one worker", () => {
		// The constructor used to call load() twice. It is memoised, so only one
		// Worker is ever created — but a regression here means every page pays
		// for a second Ghostscript-WASM instantiation.
		expect(FakeWorker.instances).toHaveLength(1);
	});

	it("spawns the worker as an ES module", () => {
		// worker.js is emitted with `format: "es"` and uses static imports, so a
		// classic worker fails outright.
		expect(FakeWorker.latest.options).toEqual({ type: "module" });
	});

	it("resolves the worker URL from import.meta.url in a module context", () => {
		// wp_enqueue_script_module() emits <script type="module">, where
		// document.currentScript is null. The library must fall through to
		// import.meta.url rather than deriving the path from a script element.
		expect(document.currentScript).toBeNull();

		// The URL is resolved as a sibling of the module, so it is absolute and
		// ends in worker.js. It used to be asserted loosely as `worker.(js|ts)`
		// against an http:// origin, because Vite recognised the literal
		// `new URL("./worker.js", import.meta.url)` pattern and rewrote it to
		// point at the source tree. Threading the currentScript fallback through
		// the same expression stopped it matching that pattern, so what arrives
		// here now is the real resolution and can be asserted exactly.
		const url = String(FakeWorker.latest.url);
		expect(url).toMatch(/^[a-z][a-z0-9+.-]*:/iu);
		expect(url).toMatch(/\/worker\.js$/u);
	});

	it("exposes itself on window.thumbnailGen", () => {
		expect(window.thumbnailGen).toBe(thumbnailer);
	});

	it("correlates concurrent requests by id", async () => {
		const worker = FakeWorker.latest;
		const before = worker.sent.length;

		const first = thumbnailer.createThumbnail({ ...options, maxWidth: 100 });
		const second = thumbnailer.createThumbnail({ ...options, maxWidth: 200 });

		await vi.waitFor(() => {
			expect(worker.sent.length).toBe(before + 2);
		});

		const [firstMessage, secondMessage] = worker.sent.slice(before);

		// Distinct ids, or the pending-request map collapses the two.
		expect(firstMessage.id).not.toBe(secondMessage.id);

		// Reply out of order: a worker is under no obligation to finish a 100px
		// thumbnail before a 200px one.
		worker.reply(secondMessage.id, thumbnailResult(200));
		worker.reply(firstMessage.id, thumbnailResult(100));

		expect((await first).width).toBe(100);
		expect((await second).width).toBe(200);
	});

	it("rejects when the worker reports an error", async () => {
		const worker = FakeWorker.latest;
		const before = worker.sent.length;

		const pending = thumbnailer.createThumbnail({ ...options, maxWidth: 50 });

		await vi.waitFor(() => {
			expect(worker.sent.length).toBe(before + 1);
		});

		worker.fail(worker.sent[before].id, "Failed to decode TIFF");

		await expect(pending).rejects.toThrow("Failed to decode TIFF");
	});

	it("stops tracking a request once it settles", async () => {
		const worker = FakeWorker.latest;
		const before = worker.sent.length;

		const pending = thumbnailer.createThumbnail({ ...options, maxWidth: 64 });
		await vi.waitFor(() => {
			expect(worker.sent.length).toBe(before + 1);
		});

		const { id } = worker.sent[before];
		worker.reply(id, thumbnailResult(64));
		const result: ThumbnailResult = await pending;
		expect(result.width).toBe(64);

		// A duplicate reply for a settled id must not throw. Workers can and do
		// post twice on retry paths.
		expect(() => {
			worker.reply(id, thumbnailResult(999));
		}).not.toThrow();
	});
});
