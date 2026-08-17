#!/usr/bin/env node
// Regenerates the browser-test fixtures in tests/browser/fixtures/.
//
// The fixtures are committed — this script exists so they are reproducible and
// so their exact dimensions and resolution tags are documented rather than
// being magic numbers a test happens to assert. Run it only when the fixtures
// need to change:  node scripts/make-fixtures.mjs
//
// Both files are deliberately tiny and hand-assembled rather than produced by
// an image library, so generating them needs no dependency the Nix build would
// otherwise have to carry.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const outDir = join(import.meta.dirname, "..", "tests", "browser", "fixtures");
mkdirSync(outDir, { recursive: true });

// ── PDF ─────────────────────────────────────────────────────────────────────
// One page, 288x144 pt. Ghostscript renders at 150 DPI, and 288 * 150/72 = 600
// exactly, so the rendered bitmap is 600x300 with no rounding to reason about.
function buildPdf() {
	const content = "1 0 0 rg 24 24 240 96 re f\n";
	const objects = [
		"<</Type/Catalog/Pages 2 0 R>>",
		"<</Type/Pages/Kids[3 0 R]/Count 1>>",
		"<</Type/Page/Parent 2 0 R/MediaBox[0 0 288 144]/Contents 4 0 R>>",
		`<</Length ${content.length}>>\nstream\n${content}endstream`,
	];

	let pdf = "%PDF-1.4\n";
	const offsets = [];
	objects.forEach((body, index) => {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xrefStart = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += "0000000000 65535 f \n";
	for (const offset of offsets) {
		pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;

	return Buffer.from(pdf, "latin1");
}

// ── TIFF ────────────────────────────────────────────────────────────────────
// 40x20 uncompressed RGB, tagged 300 DPI in inches, so the browser test can
// assert both the decode and the EXIF resolution round-trip.
const TIFF_WIDTH = 40;
const TIFF_HEIGHT = 20;
const TIFF_DPI = 300;

function buildTiff() {
	const SHORT = 3;
	const LONG = 4;
	const RATIONAL = 5;

	const pixelBytes = TIFF_WIDTH * TIFF_HEIGHT * 3;

	// Fixed layout: header(8) + count(2) + 13 entries(156) + next(4) = 170.
	const bitsPerSampleAt = 170; // 3 SHORTs — too big for the inline value field
	const xResolutionAt = 176; // RATIONAL is 8 bytes, always out of line
	const yResolutionAt = 184;
	const pixelsAt = 192;

	// Tags must appear in ascending order; UTIF is lenient but the spec is not.
	const entries = [
		[256, SHORT, 1, TIFF_WIDTH], // ImageWidth
		[257, SHORT, 1, TIFF_HEIGHT], // ImageLength
		[258, SHORT, 3, bitsPerSampleAt], // BitsPerSample
		[259, SHORT, 1, 1], // Compression: none
		[262, SHORT, 1, 2], // PhotometricInterpretation: RGB
		[273, LONG, 1, pixelsAt], // StripOffsets
		[277, SHORT, 1, 3], // SamplesPerPixel
		[278, SHORT, 1, TIFF_HEIGHT], // RowsPerStrip: one strip
		[279, LONG, 1, pixelBytes], // StripByteCounts
		[282, RATIONAL, 1, xResolutionAt], // XResolution
		[283, RATIONAL, 1, yResolutionAt], // YResolution
		[284, SHORT, 1, 1], // PlanarConfiguration: chunky
		[296, SHORT, 1, 2], // ResolutionUnit: inch
	];

	const buffer = Buffer.alloc(pixelsAt + pixelBytes);

	buffer.write("II", 0, "latin1"); // little-endian
	buffer.writeUInt16LE(42, 2);
	buffer.writeUInt32LE(8, 4); // first IFD
	buffer.writeUInt16LE(entries.length, 8);

	entries.forEach(([tag, type, count, value], index) => {
		const at = 10 + index * 12;
		buffer.writeUInt16LE(tag, at);
		buffer.writeUInt16LE(type, at + 2);
		buffer.writeUInt32LE(count, at + 4);
		// A SHORT that fits inline sits in the low half of the value field;
		// everything else here is either a LONG or an offset, so a full u32.
		if (type === SHORT && count === 1) {
			buffer.writeUInt16LE(value, at + 8);
			buffer.writeUInt16LE(0, at + 10);
		} else {
			buffer.writeUInt32LE(value, at + 8);
		}
	});

	buffer.writeUInt32LE(0, 166); // no second IFD

	for (let i = 0; i < 3; i++) {
		buffer.writeUInt16LE(8, bitsPerSampleAt + i * 2); // 8 bits per channel
	}

	buffer.writeUInt32LE(TIFF_DPI, xResolutionAt);
	buffer.writeUInt32LE(1, xResolutionAt + 4);
	buffer.writeUInt32LE(TIFF_DPI, yResolutionAt);
	buffer.writeUInt32LE(1, yResolutionAt + 4);

	// A vertical colour ramp, so a decode that silently produces black or
	// garbage is distinguishable from a correct one.
	for (let y = 0; y < TIFF_HEIGHT; y++) {
		for (let x = 0; x < TIFF_WIDTH; x++) {
			const at = pixelsAt + (y * TIFF_WIDTH + x) * 3;
			buffer[at] = Math.round((x / (TIFF_WIDTH - 1)) * 255);
			buffer[at + 1] = Math.round((y / (TIFF_HEIGHT - 1)) * 255);
			buffer[at + 2] = 128;
		}
	}

	return buffer;
}

// ── PNG ─────────────────────────────────────────────────────────────────────
// 32x16 RGB, exercising the plain createImageBitmap path with no decode step.
const PNG_WIDTH = 32;
const PNG_HEIGHT = 16;

// CRC-32 by hand rather than node:zlib's, which only landed in Node 22.2 —
// package.json's floor is 22.0.
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([length, body, crc]);
}

function buildPng() {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(PNG_WIDTH, 0);
	ihdr.writeUInt32BE(PNG_HEIGHT, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: truecolour RGB
	ihdr[10] = 0; // deflate
	ihdr[11] = 0; // adaptive filtering
	ihdr[12] = 0; // no interlace

	// Each scanline is prefixed with its filter type byte (0 = none).
	const raw = Buffer.alloc(PNG_HEIGHT * (1 + PNG_WIDTH * 3));
	let at = 0;
	for (let y = 0; y < PNG_HEIGHT; y++) {
		raw[at++] = 0;
		for (let x = 0; x < PNG_WIDTH; x++) {
			raw[at++] = Math.round((x / (PNG_WIDTH - 1)) * 255);
			raw[at++] = Math.round((y / (PNG_HEIGHT - 1)) * 255);
			raw[at++] = 64;
		}
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", deflateSync(raw)),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

writeFileSync(join(outDir, "sample.pdf"), buildPdf());
writeFileSync(join(outDir, "sample.tiff"), buildTiff());
writeFileSync(join(outDir, "sample.png"), buildPng());

console.log(`Wrote fixtures to ${outDir}`);
console.log("  sample.pdf   288x144 pt -> 600x300 px at 150 DPI");
console.log(`  sample.tiff  ${TIFF_WIDTH}x${TIFF_HEIGHT} RGB at ${TIFF_DPI} DPI`);
console.log(`  sample.png   ${PNG_WIDTH}x${PNG_HEIGHT} RGB`);
