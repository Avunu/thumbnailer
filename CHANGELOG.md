# Changelog

Maintained by [Release Please](https://github.com/googleapis/release-please) from
conventional commits. Entries below 1.0.4 predate the automated release pipeline
and are reconstructed from git history.

## [1.1.0](https://github.com/Avunu/thumbnailer/compare/thumbnailer-v1.0.3...thumbnailer-v1.1.0) (2026-08-18)


### Features

* allow wordpress pages ([9828c36](https://github.com/Avunu/thumbnailer/commit/9828c3618fb25d5cde05f9e4a36deab50d737990))
* better error handling with TIFF conversion ([91f3a4f](https://github.com/Avunu/thumbnailer/commit/91f3a4f965ae2b0c45d2136c223ffa8343b35c5c))
* metadata handling for resolution extraction ([a998353](https://github.com/Avunu/thumbnailer/commit/a9983532151fbb8110acd0c4bd17a96586916b9d))
* Nix-based CI, releases, auto-updater and a test suite ([c987400](https://github.com/Avunu/thumbnailer/commit/c987400b4e73f8e3550fc7ecfe963d9e1438bbd5))
* Nix-based CI, releases, auto-updater and a test suite ([efa3e95](https://github.com/Avunu/thumbnailer/commit/efa3e95f97876861c12d3424ce614a40c0741e5a))
* OffscreenCanvas check ([6215dac](https://github.com/Avunu/thumbnailer/commit/6215dac06a609566d191bf5d90651e2bc168c428))
* return the source image dimensions ([a108a5f](https://github.com/Avunu/thumbnailer/commit/a108a5f7d02a6734fdc1427e7d2052dba94d05b7))
* tiff support ([f218820](https://github.com/Avunu/thumbnailer/commit/f218820be7a2e58adc78a5560b3ad29387a669c4))
* transition to library-exclusive focus ([5aeab05](https://github.com/Avunu/thumbnailer/commit/5aeab05890d0036a045ad87694c2062b6a4440bd))
* transition to rollup ([b6a9ff8](https://github.com/Avunu/thumbnailer/commit/b6a9ff809be439d377cdd7797af5ff476a1f0c40))
* update thumbnail generation to accept File directly ([99fa710](https://github.com/Avunu/thumbnailer/commit/99fa710c1ead7e1012dd4e8d84c6aa0dcaf603f3))
* utif as submodule ([77ea1d1](https://github.com/Avunu/thumbnailer/commit/77ea1d1c10c5e94473ada2c97d3d566a2560042a))
* wordpress 6.9 compatibility ([467120c](https://github.com/Avunu/thumbnailer/commit/467120ccdb157ddf70462138ba964707974d4b36))
* wordpress plugin ([adca341](https://github.com/Avunu/thumbnailer/commit/adca341b66ce18ead548444c16731db62b573d5b))


### Bug Fixes

* all build and type issues ([74e96b9](https://github.com/Avunu/thumbnailer/commit/74e96b9b180dcddd36e0f7a459e1946a5cfe724f))
* build issues ([c81c7fa](https://github.com/Avunu/thumbnailer/commit/c81c7faea58888bef276441d7753fe5555203dd1))
* handle File and Uint8Array correctly in worker message processing ([173fe3d](https://github.com/Avunu/thumbnailer/commit/173fe3da1f09f1fa1671055074f43d91827f9e95))
* load new versions of library when updated ([a217fd5](https://github.com/Avunu/thumbnailer/commit/a217fd582ed12ceb19a4558a5952d6646e66dcf4))
* load worker relative to the main script ([7c7bd8f](https://github.com/Avunu/thumbnailer/commit/7c7bd8fc654fff8a9c64396f9198f3b56c0b0f28))
* remove unnecessary initialization logs from worker script ([d2a4677](https://github.com/Avunu/thumbnailer/commit/d2a4677e11f1ec810b700d1859e74d232e87a3ce))
* remove unused import for ThumbnailOptions ([2b710d4](https://github.com/Avunu/thumbnailer/commit/2b710d4f48b577a5839ef809ab1d1408005c6dc7))
* sourceWidth/Height export ([35d9853](https://github.com/Avunu/thumbnailer/commit/35d9853a67dd930efd2d67d27767cb188ef76ff7))
* ts language server issues ([1c6d859](https://github.com/Avunu/thumbnailer/commit/1c6d859d95e739b2842dbb473e98262ab8aaa589))
* unbreak main (TypeScript 7 bump) and derive the expected plugin version ([01fe478](https://github.com/Avunu/thumbnailer/commit/01fe478ad2d9a4035a1483ebd235e1fdf66228a4))
* update demo.js.map to reflect changes in source mapping ([72f91d6](https://github.com/Avunu/thumbnailer/commit/72f91d608fbdca88606cf9e5e217734cf0ba6448))
* update dependencies and improve metadata extraction logic ([324a3c7](https://github.com/Avunu/thumbnailer/commit/324a3c77c5c0e99531e5b1d251763345c1f4e1d3))
* update package dependencies and improve type definitions ([30750d7](https://github.com/Avunu/thumbnailer/commit/30750d77daddd91c9964c026e1026b7aeb06090d))
* update worker response type to 'ready' and adjust initialization message ([61d098a](https://github.com/Avunu/thumbnailer/commit/61d098ac630c0c2c20e170ec8d0c822ead7097c8))

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
