import { describe, expect, it } from "vitest";
import { calculateAspectRatio } from "../../src/geometry";

describe("calculateAspectRatio", () => {
	it("preserves the aspect ratio when scaling down", () => {
		expect(calculateAspectRatio(1000, 500, 200)).toEqual({ width: 200, height: 100 });
	});

	it("scales up when the target exceeds the source", () => {
		// The option is named maxWidth but has always scaled *to* the target
		// rather than clamping at it. Pinned here so a change is deliberate.
		expect(calculateAspectRatio(100, 50, 400)).toEqual({ width: 400, height: 200 });
	});

	it("rounds the height to a whole pixel", () => {
		expect(calculateAspectRatio(3, 2, 10)).toEqual({ width: 10, height: 7 });
	});

	it("keeps a square square", () => {
		expect(calculateAspectRatio(512, 512, 128)).toEqual({ width: 128, height: 128 });
	});

	it("never returns a zero height", () => {
		// 4000x3 scaled to 100 rounds to height 0, and `new OffscreenCanvas(100, 0)`
		// throws — a crash rather than an ugly thumbnail.
		expect(calculateAspectRatio(4000, 3, 100)).toEqual({ width: 100, height: 1 });
	});

	it.each([
		["zero source width", 0, 100, 50],
		["negative source width", -10, 100, 50],
		["zero source height", 100, 0, 50],
		["zero target width", 100, 100, 0],
		["NaN source width", Number.NaN, 100, 50],
		["infinite source height", 100, Number.POSITIVE_INFINITY, 50],
	])("throws on %s rather than producing NaN", (_label, src, srcH, target) => {
		expect(() => calculateAspectRatio(src, srcH, target)).toThrow();
	});
});
