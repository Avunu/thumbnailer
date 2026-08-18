=== Thumbnailer ===
Contributors: avunu
Tags: images, thumbnail, pdf, postscript, tiff
Requires at least: 6.5
Tested up to: 6.9
Requires PHP: 8.1
x-release-please-start-version
Stable tag: 1.1.1
x-release-please-end
License: AGPL-3.0-only
License URI: https://www.gnu.org/licenses/agpl-3.0.html

Thumbnail generator for WordPress that works with various file formats including PDF and PostScript.

== Description ==

Thumbnailer makes a client-side thumbnail generation library available on selected posts and pages. Other scripts on those pages can then generate thumbnails from PDF, PostScript, TIFF and common image formats entirely in the browser — there is no server-side image processing and no external service.

The work happens off the main thread in a Web Worker, using Ghostscript compiled to WebAssembly for PDF and PostScript, UTIF.js for TIFF, and OffscreenCanvas for resizing and encoding. A browser without OffscreenCanvas support is detected and fails gracefully.

== Installation ==

1. Upload the release zip via Plugins > Add New > Upload Plugin, then activate.
2. Go to Settings > Thumbnailer.
3. Enter the comma-separated IDs of the posts or pages that should load the library, and save.

== Changelog ==

The full changelog is maintained in CHANGELOG.md and published with each GitHub
release at https://github.com/Avunu/thumbnailer/releases
