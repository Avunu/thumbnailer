import type { WorkerRequest, WorkerResponse } from './types';

class Thumbnailer {
  private workerInstance: Worker | null = null;
  private initializationPromise: Promise<Worker> | null = null;
  private pendingRequests = new Map<string, (response: WorkerResponse) => void>();
  private initialized: boolean = false;
  private workerUrl: string;
  private readyResolve!: (value: void | PromiseLike<void>) => void;
  private readyReject!: (reason?: any) => void;
  
  /**
   * Public promise that resolves when the thumbnailer is fully initialized
   * and ready to process files
   */
  public ready: Promise<void>;

  constructor(workerUrl?: string) {
    this.workerUrl = workerUrl || new URL('./worker.js', import.meta.url).href;
    
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    
    // Add thumbnailer to window if in browser context
    if (typeof window !== 'undefined') {
      // Define a property for use with the demo/test page
      Object.defineProperty(window, 'thumbnailGen', {
        get: () => {
          return this;
        },
        configurable: false
      });
    }
    
    // Start initialization immediately but with a slight delay to ensure DOM is ready
    setTimeout(() => {
      this.initialize().catch(error => {
        console.error('Failed to initialize thumbnailer:', error);
        this.readyReject(error);
      });
    }, 0);
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
          console.log('Creating worker from URL:', this.workerUrl);
          // Create worker using direct URL object to avoid import issues
          const worker = new Worker(this.workerUrl, { type: 'module' });
          
          worker.onerror = (err) => {
            console.error('Worker initialization error:', err);
            reject(err);
          };

          worker.onmessage = (event) => {
            const response = event.data as WorkerResponse;
            
            if (response.type === 'initialized' && response.id === 'worker') {
              this.workerInstance = worker;
              console.log('Worker successfully loaded');
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
   * Initialize the worker - now private as it's called automatically
   */
  private async initialize(): Promise<void> {
    try {
      // First load the worker
      await this.load();
      
      // Then send the initialize request
      const response = await this.sendWorkerRequest({ type: 'initialize' });
      
      if (response.type === 'error') {
        throw new Error(`Failed to initialize: ${response.error}`);
      }
      
      this.initialized = true;
      console.log('Thumbnailer initialized successfully');
      
      // Resolve the ready promise
      this.readyResolve();
    } catch (error) {
      console.error('Failed to initialize thumbnailer:', error);
      this.readyReject(error);
      throw error;
    }
  }

  /**
   * Check if the thumbnailer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a thumbnail from the provided file data
   * If thumbnailer isn't ready, it will wait for initialization to complete
   */
  public async createThumbnail(
    options: {
      file: Uint8Array;
      filename: string;
      mimeType: string;
      maxWidth: number;
    }
  ) {
    // If not initialized, wait for it
    if (!this.initialized) {
      await this.ready;
    }
    
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
