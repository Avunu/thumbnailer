/**
 * A hand-driven stand-in for the Web Worker the library spawns.
 *
 * Replies are not automatic (beyond the initial `ready`): a test calls
 * `reply()` explicitly, which is what makes it possible to answer two
 * in-flight requests out of order and prove the id correlation works.
 */
export class FakeWorker {
	static instances: FakeWorker[] = [];

	static reset(): void {
		FakeWorker.instances = [];
	}

	static get latest(): FakeWorker {
		const worker = FakeWorker.instances.at(-1);
		if (!worker) {
			throw new Error("no FakeWorker has been constructed");
		}
		return worker;
	}

	onmessage: ((event: { data: unknown }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	readonly sent: { id: string; type: string }[] = [];

	constructor(
		readonly url: string | URL,
		readonly options?: { type?: string },
	) {
		FakeWorker.instances.push(this);
		// The real worker posts `ready` once Ghostscript has initialised. A
		// microtask, not a synchronous call: onmessage is assigned by the caller
		// only after `new Worker(...)` returns.
		queueMicrotask(() => {
			this.emit({ type: "ready", id: "worker" });
		});
	}

	postMessage(message: { id: string; type: string }): void {
		this.sent.push(message);
	}

	terminate(): void {}

	emit(data: unknown): void {
		this.onmessage?.({ data });
	}

	reply(id: string, payload: unknown): void {
		this.emit({ type: "result", id, payload });
	}

	fail(id: string, error: string): void {
		this.emit({ type: "error", id, error });
	}
}

export function thumbnailResult(width: number): Record<string, unknown> {
	return {
		image: new Uint8Array([0xff, 0xd8, 0xff]),
		mimeType: "image/jpeg",
		sourceWidth: width * 2,
		sourceHeight: width,
		width,
		height: width / 2,
	};
}
