import { describe, expect, it } from "vitest";
import { extractResolution, toNumericTag, toResolutionUnit } from "../../src/metadata";

describe("toNumericTag", () => {
	it("divides an EXIF rational", () => {
		expect(toNumericTag([300, 1])).toBe(300);
		expect(toNumericTag([720000, 10000])).toBe(72);
	});

	it("accepts a bare number", () => {
		expect(toNumericTag(150)).toBe(150);
	});

	it("rejects a zero denominator", () => {
		// A malformed rational would otherwise divide to Infinity and travel out
		// to the caller as a plausible-looking resolution.
		expect(toNumericTag([300, 0])).toBeUndefined();
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["a string", "300"],
		["an empty array", []],
		["a one-element array", [300]],
		["a non-numeric pair", ["300", "1"]],
		["an object", { value: 300 }],
		["NaN", Number.NaN],
	])("returns undefined for %s", (_label, value) => {
		expect(toNumericTag(value)).toBeUndefined();
	});
});

describe("toResolutionUnit", () => {
	it("maps the EXIF enumeration", () => {
		expect(toResolutionUnit(1)).toBe("none");
		expect(toResolutionUnit(2)).toBe("inch");
		expect(toResolutionUnit(3)).toBe("cm");
	});

	it.each([[0], [4], ["inch"], [undefined], [null]])(
		"returns undefined for the unknown value %s",
		(value) => {
			expect(toResolutionUnit(value)).toBeUndefined();
		},
	);
});

describe("extractResolution", () => {
	it("reads a full tag set", () => {
		expect(
			extractResolution({
				XResolution: { value: [300, 1] },
				YResolution: { value: [300, 1] },
				ResolutionUnit: { value: 2 },
			}),
		).toEqual({ xResolution: 300, yResolution: 300, resolutionUnit: "inch" });
	});

	it("omits keys it cannot read rather than emitting undefined values", () => {
		const result = extractResolution({ XResolution: { value: [72, 1] } });

		expect(result).toEqual({ xResolution: 72 });
		expect("yResolution" in result).toBe(false);
		expect("resolutionUnit" in result).toBe(false);
	});

	it("handles non-square resolutions", () => {
		expect(
			extractResolution({
				XResolution: { value: [300, 1] },
				YResolution: { value: [150, 1] },
				ResolutionUnit: { value: 3 },
			}),
		).toEqual({ xResolution: 300, yResolution: 150, resolutionUnit: "cm" });
	});

	it.each([
		["null", null],
		["undefined", undefined],
	])("returns an empty object for %s tags", (_label, tags) => {
		expect(extractResolution(tags)).toEqual({});
	});

	it("returns an empty object when no resolution tags are present", () => {
		expect(extractResolution({ Make: { value: "ACME" } })).toEqual({});
	});

	it("survives tags whose value is missing entirely", () => {
		expect(extractResolution({ XResolution: {}, ResolutionUnit: {} })).toEqual({});
	});
});
