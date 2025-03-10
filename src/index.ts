import type { WorkerRequest, WorkerResponse } from './types';

class Thumbnailer {
  private workerInstance: Worker | null = null;
  private initializationPromise: Promise<Worker> | null = null;
  private pendingRequests = new Map<string, (response: WorkerResponse) => void>();
  private initialized: boolean = false;
  private workerUrl: string;

  constructor(workerUrl = new URL('./worker', import.meta.url).href) {
    this.workerUrl = workerUrl;
    
    // Add worker to window if in browser context
    if (typeof window !== 'undefined') {
      // Define a hidden property for use with the demo/test page
      Object.defineProperty(window, 'thumbnailGen', {
        get: () => {
          return this.workerInstance;
        },
        configurable: false
      });
    }
    
    // Initialize automatically when DOM is ready
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        this.initialize().catch(error => {
          console.error('Failed to initialize thumbnailer:', error);
        });
      });
    }
  }

  /**
   * Generates a unique request ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).slice(2);
  }

  /**
   * Creates and initializes the worker
   */
  public load(): Promise<Worker> {
    if (this.workerInstance) {
      return Promise.resolve(this.workerInstance);
    }

    if (!this.initializationPromise) {
      this.initializationPromise = new Promise((resolve, reject) => {
        try {
          const worker = new Worker(new URL(this.workerUrl, import.meta.url), { type: 'module' });
          
          worker.onerror = (err) => {
            console.error('Worker initialization error:', err);
            reject(err);
          };

          worker.onmessage = (event) => {
            const response = event.data as WorkerResponse;
            
            if (response.type === 'initialized' && response.id === 'worker') {
              this.workerInstance = worker;
              console.log('Worker successfully initialized');
              resolve(worker);
              return;
            }
            
            const { id } = response;
            const resolver = this.pendingRequests.get(id);
            if (resolver) {
              this.pendingRequests.delete(id);
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
  
  /**
   * Sends a request to the worker and waits for response
   */
  private async sendWorkerRequest(request: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
    const worker = await this.load();
    const id = this.generateRequestId();
    
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      worker.postMessage({ ...request, id });
    });
  }

  /**
   * Initialize the worker
   */
  public async initialize(): Promise<void> {
    try {
      await this.sendWorkerRequest({ type: 'initialize' });
      this.initialized = true;
      
      if (this.initialized && window.thumbnailGen) {
        console.log('Thumbnailer initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize thumbnailer:', error);
    }
    return;
  }

  /**
   * Create a thumbnail from the provided file data
   */
  public async createThumbnail(
    options: {
      file: Uint8Array;
      filename: string;
      mimeType: string;
      maxWidth: number;
    }
  ) {
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
