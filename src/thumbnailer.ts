import type { WorkerRequest, WorkerResponse, ThumbnailOptions, ThumbnailResult } from './types';

class Thumbnailer {
	private workerInstance: Worker | null = null;
	private initializationPromise: Promise<Worker> | null = null;
	private pendingRequests = new Map<string, (response: WorkerResponse) => void>();
	private initialized: boolean = false;
	private workerUrl: string;
	private readyPromise: Promise<void>;
	private supportsOffscreenCanvas: boolean;

	constructor(workerUrl?: string) {
		// Check if OffscreenCanvas is supported
		this.supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

		const scriptUrl = document.currentScript instanceof HTMLScriptElement ? document.currentScript.src : undefined;

		this.workerUrl =
			workerUrl ||
			(scriptUrl ? scriptUrl.replace('thumbnailer.js', 'worker.js') : new URL('./worker.js', import.meta.url).href);

		// Initialize the ready promise
		if (!this.supportsOffscreenCanvas) {
			console.error(
				'Thumbnailer: OffscreenCanvas is not supported in this browser. Thumbnailer will not be initialized.'
			);
			this.readyPromise = Promise.reject(new Error('OffscreenCanvas is not supported in this browser'));
		} else {
			this.readyPromise = this.load().then(() => {
				this.initialized = true;
			});
		}

		if (typeof window !== 'undefined') {
			Object.defineProperty(window, 'thumbnailGen', {
				get: () => this,
				configurable: false,
			});
		}

		// Only initialize if OffscreenCanvas is supported
		if (this.supportsOffscreenCanvas) {
			this.load()
				.then(() => {
					console.log('Thumbnailer initialized');
				})
				.catch((err) => {
					console.error('Failed to initialize Thumbnailer:', err);
				});
		}
	}

	private generateRequestId(): string {
		return Math.random().toString(36).slice(2);
	}

	public load(): Promise<Worker> {
		// Fail immediately if OffscreenCanvas is not supported
		if (!this.supportsOffscreenCanvas) {
			return Promise.reject(new Error('OffscreenCanvas is not supported in this browser'));
		}

		if (this.workerInstance) {
			return Promise.resolve(this.workerInstance);
		}

		if (!this.initializationPromise) {
			this.initializationPromise = new Promise((resolve, reject) => {
				try {
					const worker = new Worker(this.workerUrl, { type: 'module' });

					worker.onerror = (err) => {
						console.error('Worker initialization error:', err);
						reject(err);
					};

					worker.onmessage = (event) => {
						const response = event.data as WorkerResponse;

						if (response.type === 'ready') {
							this.workerInstance = worker;
							this.initialized = true;
							resolve(worker);
							return;
						}

						const resolver = this.pendingRequests.get(response.id);
						if (resolver) {
							this.pendingRequests.delete(response.id);
							resolver(response);
						}
					};
				} catch (error) {
					console.error('Failed to create worker:', error);
					reject(error);
				}
			});
		}

		return this.initializationPromise;
	}

	private async sendWorkerRequest(request: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
		if (!this.supportsOffscreenCanvas) {
			throw new Error('OffscreenCanvas is not supported in this browser');
		}

		console.log('Sending worker request:', request);
		const worker = await this.load();
		const id = this.generateRequestId();

		return new Promise((resolve) => {
			this.pendingRequests.set(id, resolve);
			worker.postMessage({ ...request, id });
		});
	}

	public isInitialized(): boolean {
		return this.initialized;
	}

	public isSupported(): boolean {
		return this.supportsOffscreenCanvas;
	}

	public async createThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
		// Check for support before proceeding
		if (!this.supportsOffscreenCanvas) {
			throw new Error('OffscreenCanvas is not supported in this browser');
		}

		// Wait for worker to be ready
		await this.readyPromise;

		const response = await this.sendWorkerRequest({
			type: 'createThumbnail',
			payload: options,
		});

		if (response.type === 'error') {
			throw new Error(response.error);
		}

		return response.payload as ThumbnailResult;
	}
}

// Create and export the default instance
export const thumbnailer = new Thumbnailer();

// Export the class for custom instantiation
export default Thumbnailer;
