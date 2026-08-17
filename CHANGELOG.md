# Changelog

Maintained by [Release Please](https://github.com/googleapis/release-please) from
conventional commits. Entries below 1.0.4 predate the automated release pipeline
and are reconstructed from git history.

## 1.0.3

- WordPress 6.9 compatibility.
- Accept a `File` directly in `createThumbnail`, and handle `File` and
  `Uint8Array` correctly in worker message processing.
- Extract image resolution metadata (`xResolution`, `yResolution`,
  `resolutionUnit`) and return it with the thumbnail.
- Detect `OffscreenCanvas` support and fail gracefully without it.
- TIFF support via UTIF.js.

## 1.0.2

- Improve metadata extraction and TIFF error handling.
- Migrate the build from Vite to Rollup.
