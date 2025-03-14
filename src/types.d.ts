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

// createThumbnail options
export interface ThumbnailOptions {
  file: Uint8Array;
  filename: string;
  mimeType: string;
  maxWidth: number;
}

// Thumbnail result type that's returned to consumers
export interface ThumbnailResult {
  image: Uint8Array;
  mimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
}

// Define the public API of the thumbnailer
export interface ThumbnailerInterface {
  ready: Promise<void>;
  isInitialized(): boolean;
  createThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult>;
}

// Add the window interface extension
declare global {
  interface Window {
    thumbnailGen: ThumbnailerInterface;
  }
}

declare module '*.wasm' {
  const src: string;
  export default src;
}