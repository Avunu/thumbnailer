export type ResolutionUnit = 'inch' | 'cm' | 'none';

// createThumbnail options
export interface ThumbnailOptions {
  file: Uint8Array;
  filename: string;
  mimeType: string;
  maxWidth: number;
}

// Thumbnail result type that's returned to consumers
export interface ThumbnailResult {
  image: Uint8Array<ArrayBuffer>;
  mimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  xResolution?: number;  // X-resolution in DPI
  yResolution?: number;  // Y-resolution in DPI
  resolutionUnit?: ResolutionUnit; // Resolution unit (e.g., 'inch', 'cm')
}

// Define the public API of the thumbnailer
export interface ThumbnailerInterface {
  ready: Promise<void>;
  isInitialized(): boolean;
  createThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult>;
}

export interface WorkerRequest {
  id: string;
  type: 'initialize' | 'createThumbnail';
  payload?: any;
}

export interface WorkerResponse {
  id: string;
  type: 'ready' | 'initialized' | 'result' | 'error';
  payload?: any;
  error?: string;
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