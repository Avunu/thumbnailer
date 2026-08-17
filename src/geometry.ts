export interface Dimensions {
	width: number;
	height: number;
}

/**
 * Scales `srcWidth`×`srcHeight` to exactly `targetWidth`, preserving aspect
 * ratio.
 *
 * Note this scales *to* the target width rather than clamping at it: a source
 * narrower than `targetWidth` is enlarged. That is the behaviour the library
 * has always had, despite the option being named `maxWidth`.
 *
 * The height is floored at 1. A sufficiently wide-and-short source (say
 * 4000×3 scaled to 100) rounds to a height of 0, and `new OffscreenCanvas(w, 0)`
 * then throws — a crash rather than a bad thumbnail.
 */
export function calculateAspectRatio(
	srcWidth: number,
	srcHeight: number,
	targetWidth: number,
): Dimensions {
	if (!Number.isFinite(srcWidth) || srcWidth <= 0) {
		throw new Error(`Invalid source width: ${srcWidth}`);
	}
	if (!Number.isFinite(srcHeight) || srcHeight <= 0) {
		throw new Error(`Invalid source height: ${srcHeight}`);
	}
	if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
		throw new Error(`Invalid target width: ${targetWidth}`);
	}

	const ratio = targetWidth / srcWidth;
	return {
		width: Math.round(targetWidth),
		height: Math.max(1, Math.round(srcHeight * ratio)),
	};
}
