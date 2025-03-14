import type { WorkerRequest, WorkerResponse } from './types';

class Thumbnailer {
  private workerInstance: Worker | null = null;
  private initializationPromise: Promise<Worker> | null = null;
  private pendingRequests = new Map<string, (response: WorkerResponse) => void>();
  private initialized: boolean = false;
  private workerUrl: string;
  private readyPromise: Promise<void>;

  constructor(workerUrl?: string) {
    const scriptUrl = document.currentScript instanceof HTMLScriptElement
      ? document.currentScript.src
      : undefined;

    this.workerUrl = workerUrl || (scriptUrl
      ? scriptUrl.replace('thumbnailer.js', 'worker.js')
      : new URL('./worker.js', import.meta.url).href);

    // Initialize the ready promise immediately with worker load
    this.readyPromise = this.load().then(() => {
      this.initialized = true;
    });

    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'thumbnailGen', {
        get: () => this,
        configurable: false
      });
    }
  }

  private generateRequestId(): string {
    return Math.random().toString(36).slice(2);
  }

  public load(): Promise<Worker> {
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

  public async createThumbnail(
    options: {
      file: Uint8Array;
      filename: string;
      mimeType: string;
      maxWidth: number;
    }
  ) {
    // Wait for worker to be ready
    await this.readyPromise;

    const response = await this.sendWorkerRequest({
      type: 'createThumbnail',
      payload: options
    });

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return response.payload!;
  }
}

// Create and export the default instance
export const thumbnailer = new Thumbnailer();

// Export the class for custom instantiation
export default Thumbnailer;

// Export types
export type { WorkerRequest, WorkerResponse };
