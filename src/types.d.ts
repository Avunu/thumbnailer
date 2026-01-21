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
	xResolution?: number; // X-resolution in DPI
	yResolution?: number; // Y-resolution in DPI
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload?: any;
}

export interface WorkerResponse {
	id: string;
	type: 'ready' | 'initialized' | 'result' | 'error';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload?: any;
	error?: string;
}

// UTIF library types
export interface UTIFIFD {
	width?: number;
	height?: number;
	data?: ArrayBuffer;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

export interface UTIFModule {
	decode(buffer: ArrayBuffer): UTIFIFD[];
	decodeImage(buffer: ArrayBuffer, ifd: UTIFIFD): void;
	toRGBA8(ifd: UTIFIFD): Uint8Array;
}

// WASM module declarations
declare module '*.wasm' {
	const src: string;
	export default src;
}
