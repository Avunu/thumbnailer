import type { WorkerRequest, WorkerResponse } from './types';

// Worker loader utility
export const createAsyncWorker = (workerUrl = '/src/worker.ts') => {
  let workerInstance: Worker | null = null;
  let initializationPromise: Promise<Worker> | null = null;
  const pendingRequests = new Map<string, (response: WorkerResponse) => void>();
  
  /**
   * Generates a unique request ID
   */
  const generateRequestId = (): string => {
    return Math.random().toString(36).slice(2);
  };

  /**
   * Creates and initializes the worker
   */
  const getWorker = (): Promise<Worker> => {
    if (workerInstance) {
      return Promise.resolve(workerInstance);
    }

    if (!initializationPromise) {
      initializationPromise = new Promise((resolve, reject) => {
        try {
          const worker = new Worker(workerUrl, { type: 'module' });
          
          worker.onerror = (err) => {
            console.error('Worker initialization error:', err);
            reject(err);
          };

          worker.onmessage = (event) => {
            const response = event.data as WorkerResponse;
            
            if (response.type === 'initialized' && response.id === 'worker') {
              workerInstance = worker;
              console.log('Worker successfully initialized');
              resolve(worker);
              return;
            }
            
            const { id } = response;
            const resolver = pendingRequests.get(id);
            if (resolver) {
              pendingRequests.delete(id);
              resolver(response);
            }
          };
        } catch (error) {
          console.error('Failed to create worker:', error);
          reject(error);
        }
      });
    }

    return initializationPromise;
  };
  
  /**
   * Sends a request to the worker and waits for response
   */
  const sendWorkerRequest = async (request: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse> => {
    const worker = await getWorker();
    const id = generateRequestId();
    
    return new Promise((resolve) => {
      pendingRequests.set(id, resolve);
      worker.postMessage({ ...request, id });
    });
  };

  /**
   * Initialize the worker
   */
  const initialize = async (): Promise<void> => {
    await sendWorkerRequest({ type: 'initialize' });
    return;
  };

  /**
   * Create a thumbnail from the provided file data
   */
  const createThumbnail = async (
    options: {
      file: Uint8Array;
      filename: string;
      mimeType: string;
      maxWidth: number;
    }
  ) => {
    const response = await sendWorkerRequest({
      type: 'createThumbnail',
      payload: options
    });

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return response.payload!;
  };

  // Add worker to window if in browser context
  if (typeof window !== 'undefined') {
    // Define a hidden property for use with the demo/test page
    Object.defineProperty(window, 'thumbnailGen', {
      get: function() {
        return workerInstance;
      },
      configurable: false
    });
  }

  // Return the public API
  return {
    load: getWorker,
    initialize,
    createThumbnail
  };
};

// Export the default worker loader instance
export const workerLoader = createAsyncWorker();