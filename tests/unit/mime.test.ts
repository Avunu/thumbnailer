import { describe, expect, it } from "vitest";
import { isPostScriptType, isTiffType } from "../../src/mime";

describe("isPostScriptType", () => {
	it.each([
		"application/pdf",
		"application/postscript",
		"application/ps",
		"application/x-eps",
		"application/x-postscript",
		"application/x-postscript-not-eps",
		"application/x-ps",
		"image/eps",
		"image/x-eps",
		"text/postscript",
	])("routes %s to Ghostscript", (mimeType) => {
		expect(isPostScriptType(mimeType)).toBe(true);
	});

	it.each(["image/png", "image/jpeg", "image/tiff", "text/plain", ""])(
		"does not claim %s",
		(mimeType) => {
			expect(isPostScriptType(mimeType)).toBe(false);
		},
	);

	it("ignores case", () => {
		expect(isPostScriptType("APPLICATION/PDF")).toBe(true);
	});

	it("ignores charset parameters", () => {
		// Browsers hand back the full Content-Type for a File; an exact string
		// match would send "application/pdf; charset=binary" down the plain-image
		// path, where createImageBitmap rejects it.
		expect(isPostScriptType("application/pdf; charset=binary")).toBe(true);
	});
});

describe("isTiffType", () => {
	it.each([
		"image/tiff",
		"image/tif",
		"image/tiff-fx",
		"image/x-tif",
		"image/x-tiff",
		"application/tif",
		"application/tiff",
		"application/x-tif",
		"application/x-tiff",
	])("routes %s to UTIF", (mimeType) => {
		expect(isTiffType(mimeType)).toBe(true);
	});

	it.each(["image/png", "application/pdf", "image/jpeg", ""])("does not claim %s", (mimeType) => {
		expect(isTiffType(mimeType)).toBe(false);
	});

	it("ignores case and parameters", () => {
		expect(isTiffType("Image/TIFF; foo=bar")).toBe(true);
	});
});

describe("the two decoders are disjoint", () => {
	it("never routes one type to both", () => {
		const types = [
			"application/pdf",
			"image/tiff",
			"application/tiff",
			"image/png",
			"application/postscript",
		];

		for (const type of types) {
			expect(isPostScriptType(type) && isTiffType(type)).toBe(false);
		}
	});
});
