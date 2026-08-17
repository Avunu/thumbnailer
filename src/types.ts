export type ResolutionUnit = "inch" | "cm" | "none";

// createThumbnail options
export interface ThumbnailOptions {
	file: Uint8Array | File;
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

// The public API, as exposed on `window.thumbnailGen`.
export interface ThumbnailerInterface {
	isInitialized(): boolean;
	isSupported(): boolean;
	load(): Promise<Worker>;
	createThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult>;
}

export interface WorkerRequest {
	id: string;
	type: "initialize" | "createThumbnail";
	payload?: ThumbnailOptions;
}

export interface WorkerResponse {
	id: string;
	type: "ready" | "initialized" | "result" | "error";
	payload?: ThumbnailResult;
	error?: string;
}

// UTIF library types
export interface UTIFIFD {
	width?: number;
	height?: number;
	data?: ArrayBuffer;
	[key: string]: unknown;
}

export interface UTIFModule {
	decode(buffer: ArrayBuffer): UTIFIFD[];
	decodeImage(buffer: ArrayBuffer, ifd: UTIFIFD): void;
	toRGBA8(ifd: UTIFIFD): Uint8Array;
}
