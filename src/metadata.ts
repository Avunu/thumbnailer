import type { ResolutionUnit } from "./types";

export interface ResolutionMetadata {
	xResolution?: number;
	yResolution?: number;
	resolutionUnit?: ResolutionUnit;
}

/** The shape of the subset of ExifReader's output this module reads. */
export interface ExifTagLike {
	value?: unknown;
}
export type ExifTagsLike = Record<string, ExifTagLike | undefined>;

/**
 * EXIF stores resolutions as a rational — a `[numerator, denominator]` pair —
 * but some producers write a bare number instead. Returns undefined for
 * anything else, including a zero denominator (which would otherwise yield
 * Infinity and travel all the way out to the caller as a "resolution").
 */
export function toNumericTag(value: unknown): number | undefined {
	if (Array.isArray(value)) {
		const [numerator, denominator] = value as unknown[];
		if (typeof numerator === "number" && typeof denominator === "number" && denominator !== 0) {
			const result = numerator / denominator;
			return Number.isFinite(result) ? result : undefined;
		}
		return undefined;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	return undefined;
}

/** EXIF ResolutionUnit: 1 = none, 2 = inches, 3 = centimetres. */
export function toResolutionUnit(value: unknown): ResolutionUnit | undefined {
	switch (value) {
		case 2:
			return "inch";
		case 3:
			return "cm";
		case 1:
			return "none";
		default:
			return undefined;
	}
}

/**
 * Pulls the resolution triple out of an ExifReader tag set. Pure and
 * synchronous — the async `ExifReader.load()` call stays in worker.ts so this
 * can be exercised directly against fixture tag objects.
 */
export function extractResolution(tags: ExifTagsLike | null | undefined): ResolutionMetadata {
	const metadata: ResolutionMetadata = {};
	if (!tags) {
		return metadata;
	}

	const xResolution = toNumericTag(tags["XResolution"]?.value);
	if (xResolution !== undefined) {
		metadata.xResolution = xResolution;
	}

	const yResolution = toNumericTag(tags["YResolution"]?.value);
	if (yResolution !== undefined) {
		metadata.yResolution = yResolution;
	}

	const resolutionUnit = toResolutionUnit(tags["ResolutionUnit"]?.value);
	if (resolutionUnit !== undefined) {
		metadata.resolutionUnit = resolutionUnit;
	}

	return metadata;
}
