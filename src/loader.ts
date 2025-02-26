// Worker loader utility
const createAsyncWorker = () => {
  let workerInstance: Worker | null = null;
  let initializationPromise: Promise<Worker> | null = null;

  const getWorker = (): Promise<Worker> => {
    if (workerInstance) {
      return Promise.resolve(workerInstance);
    }

    if (!initializationPromise) {
      initializationPromise = new Promise((resolve, reject) => {
        try {
          const worker = new Worker('/src/worker.ts', { type: 'module' });
          
          worker.onerror = (err) => {
            console.error('Worker initialization error:', err);
            reject(err);
          };

          worker.onmessage = (event) => {
            if (event.data.type === 'initialized') {
              workerInstance = worker;
              console.log('Worker successfully initialized');
              resolve(worker);
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

  // Initialize the property on window
  Object.defineProperty(window, 'thumbnailGen', {
    get: function() {
      // Create worker on first access if not already created
      if (!workerInstance && !initializationPromise) {
        getWorker().catch(err => console.error('Failed to initialize worker:', err));
      }
      return workerInstance;
    },
    configurable: false
  });

  // Expose a method to explicitly load the worker
  return {
    load: getWorker
  };
};

// Export the worker loader
export const workerLoader = createAsyncWorker();

// Initialize the loader immediately but asynchronously
setTimeout(() => {
  workerLoader.load().catch(err => console.error('Deferred worker initialization failed:', err));
}, 0);