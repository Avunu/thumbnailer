export interface WorkerRequest {
  type: 'initialize' | 'createThumbnail';
  id: string;
  payload?: {
    file: Uint8Array;
    filename: string;
    mimeType: string;
    maxWidth: number;
  };
}

export interface WorkerResponse {
  type: 'initialized' | 'thumbnail' | 'error';
  id: string;
  payload?: {
    image: Uint8Array;
    mimeType: string;
    width: number;
    height: number;
  };
  error?: string;
}

declare global {
  interface Window {
    thumbnailGen: Worker;
  }
}
