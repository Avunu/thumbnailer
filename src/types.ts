export interface WorkerRequest {
  type: 'initialize' | 'process';
  id: string;
  payload?: Uint8Array;
}

export interface WorkerResponse {
  type: 'initialized' | 'processed' | 'error';
  id: string;
  payload?: Uint8Array;
  error?: string;
}

declare global {
  interface Window {
    gsWorker: Worker;
  }
}
