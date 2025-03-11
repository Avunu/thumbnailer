export interface WorkerRequest {
  id: string;
  type: 'initialize' | 'createThumbnail';
  payload?: any;
}

export interface WorkerResponse {
  id: string;
  type: 'initialized' | 'result' | 'error';
  payload?: any;
  error?: string;
}

// Thumbnail result type that's returned to consumers
export interface ThumbnailResult {
  image: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
}

// Define the public API of the thumbnailer
export interface ThumbnailerInterface {
  ready: Promise<void>;
  isInitialized(): boolean;
  createThumbnail(options: {
    file: Uint8Array;
    filename: string;
    mimeType: string;
    maxWidth: number;
  }): Promise<ThumbnailResult>;
}

// Add the window interface extension
declare global {
  interface Window {
    thumbnailGen: {
      ready: Promise<void>;
      createThumbnail: (options: {
        file: Uint8Array;
        filename: string;
        mimeType: string;
        maxWidth: number;
      }) => Promise<{
        image: Uint8Array;
        width: number;
        height: number;
        mimeType: string;
      }>;
      isInitialized: () => boolean;
    };
  }
}

declare module '*.wasm' {
  const src: string;
  export default src;
}