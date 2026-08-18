# Thumbnailer

A WordPress plugin that makes a client-side thumbnail generation library available on selected posts and pages.

Everything happens in the browser. Ghostscript is compiled to WebAssembly for PDF and PostScript, UTIF.js decodes TIFF, and `OffscreenCanvas` does the resizing and JPEG encoding — all off the main thread in a Web Worker. There is no server-side image processing and no external service.

## Purpose

The plugin loads the Thumbnailer library on the WordPress posts and pages you configure. Once loaded, other scripts on those pages can call its API to generate thumbnails from PDF, PostScript, TIFF and common image formats.

## Features

- Loads the library only on the posts and pages you opt in
- Configured from the WordPress admin, no code required
- Non-blocking: decoding and encoding happen in a Web Worker
- PDF, PostScript, TIFF, PNG, JPEG and anything else `createImageBitmap` accepts
- Self-updating from GitHub releases — no wordpress.org listing required

## Requirements

- WordPress 6.5 or later (the plugin uses `wp_enqueue_script_module()`, added in 6.5)
- PHP 8.1 or later

### Browser compatibility

Two features set the floor, and the more restrictive one is module Web Workers:

| Feature | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| `OffscreenCanvas.convertToBlob` | 76 | 105 | 16.4 |
| Module Web Workers | 80 | 114 | 15 |

So in practice: **Chrome/Edge 80+, Firefox 114+, Safari 16.4+**. The library detects support and fails gracefully everywhere else — `window.thumbnailGen.isSupported()` returns `false` and `createThumbnail()` rejects rather than hanging.

## Installation

Download `thumbnailer.zip` from the [latest release](https://github.com/Avunu/thumbnailer/releases/latest) and upload it via **Plugins → Add New → Upload Plugin**.

The zip bundles both the built JavaScript and the Composer dependencies, so no build step is needed on the server. It is around 19 MB, almost entirely the Ghostscript WebAssembly module; if your host caps `upload_max_filesize` below that, install it over SSH or let the auto-updater fetch it instead.

Do not install from a `git clone` or GitHub's source tarball. Neither contains `dist/` or `vendor/`, and the result is a plugin that fatals on activation.

### Updates

The plugin checks its own GitHub releases and offers updates on the normal Plugins screen, using [plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker). It downloads the attached `thumbnailer.zip` release asset rather than the source tarball.

## Usage

1. Install and activate the plugin.
2. Go to **Settings → Thumbnailer**.
3. Enter the comma-separated IDs of the posts or pages that should load the library.
4. Save.

## JavaScript API

Once loaded, the library is available as `window.thumbnailGen`:

```javascript
if (window.thumbnailGen?.isSupported()) {
  const fileData = new Uint8Array(await fetch("example.pdf").then((r) => r.arrayBuffer()));

  const thumbnail = await window.thumbnailGen.createThumbnail({
    file: fileData,
    filename: "example.pdf",
    mimeType: "application/pdf",
    maxWidth: 300,
  });

  const blob = new Blob([thumbnail.image], { type: thumbnail.mimeType });
  document.getElementById("preview").src = URL.createObjectURL(blob);
} else {
  console.warn("Thumbnailer is not supported in this browser");
}
```

### `thumbnailGen.isSupported(): boolean`

Whether this browser has the features the library needs. Check it before anything else.

### `thumbnailGen.isInitialized(): boolean`

Whether the worker has finished instantiating Ghostscript. `createThumbnail()` waits for this on its own, so you rarely need it.

### `thumbnailGen.createThumbnail(options): Promise<ThumbnailResult>`

| Option | Type | Meaning |
| --- | --- | --- |
| `file` | `Uint8Array \| File` | The source file |
| `filename` | `string` | Used only for diagnostics |
| `mimeType` | `string` | Selects the decode path; a `; charset=…` parameter is ignored |
| `maxWidth` | `number` | Target width — note the result is scaled *to* this width, so a smaller source is enlarged |

```typescript
interface ThumbnailResult {
  image: Uint8Array;     // JPEG bytes
  mimeType: string;      // always "image/jpeg"
  sourceWidth: number;   // decoded source dimensions
  sourceHeight: number;
  width: number;         // thumbnail dimensions
  height: number;
  xResolution?: number;  // from EXIF, or 150 for PDF/PostScript
  yResolution?: number;
  resolutionUnit?: "inch" | "cm" | "none";
}
```

Rejects if the browser is unsupported or the file cannot be decoded. A rejected request does not wedge the worker — subsequent calls still work.

## npm package

The same library is published to GitHub Packages as [`@avunu/thumbnailer`](https://github.com/Avunu/thumbnailer/pkgs/npm/thumbnailer), versioned in lockstep with the plugin.

```bash
echo "@avunu:registry=https://npm.pkg.github.com" >> .npmrc
npm install @avunu/thumbnailer
```

The package ships `dist/` only, including `gs.wasm`, so the tarball is around 19 MB. `dist/worker.js` must be served alongside `dist/thumbnailer.js` — the library resolves it relative to its own module URL.

## Development

The toolchain is managed entirely by Nix:

```bash
nix develop
npm ci
```

The shell supplies `third-party/utif` symlinked from the pinned flake input, PHP with Composer and PHPStan, Node, and Playwright with its browsers, plus git hooks installed at the `pre-push` stage. It deliberately does **not** supply `node_modules` — linking it from the store would make it read-only and break `npm ci`/`npm install` inside the shell — so run `npm ci` yourself once.

`third-party/utif` is **not** in git. UTIF.js used to be a submodule; it is now the `utif` flake input, symlinked into place by both the dev shell and every derivation, so `nix build` and `nix develop` can never resolve different sources. Dependabot's `nix` ecosystem keeps the pin current. A plain `git clone && npm install` will not build — use `nix develop`.

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run build` | Emits `dist/` — declarations, both bundles, the worker, and `gs.wasm`. Rolldown does the bundling in well under a second; `tsc` runs first and is what typechecks `src/` |
| `npm run build:demo` | Builds `demo/demo.js` (opt-in, so `npm run build` never dirties the tree) |
| `npm run check` | oxfmt, oxlint, type-aware oxlint, `tsc`, and the version-consistency gate |
| `npm test` | Vitest unit tests |
| `npm run test:browser` | Playwright, against the built `dist/` |
| `nix build .#zip` | Produces `result/thumbnailer.zip` |

### Tests

Six tiers, each runnable as the exact command CI runs:

| Tier | Command | Covers |
| --- | --- | --- |
| static | `nix build .#checks.x86_64-linux.static` | Formatting, lint, types, version consistency |
| phpstan | `nix build .#checks.x86_64-linux.phpstan` | Level 8, WordPress-aware, analysed against PHP 8.1 |
| phpunit | `nix build .#checks.x86_64-linux.phpunit` | The plugin class, against an in-memory WordPress fake |
| vitest | `nix build .#checks.x86_64-linux.vitest` | MIME routing, geometry, EXIF mapping, worker correlation |
| browser | `nix build .#checks.x86_64-linux.browser` | Real Ghostscript-WASM, UTIF, Worker and OffscreenCanvas |
| playground | `nix develop -c node tests/playground/run.mjs` | Real WordPress against the built zip |

`nix flake check` runs the first five. Every one is offline and hermetic — browsers come from the Nix store, so there is no `playwright install`.

The playground tier is the exception and is not part of `nix flake check`: `@wp-playground/cli` downloads WordPress and `php.wasm` at run time, so it needs the network. It lives in `tests/playground/` with its own lockfile, keeping those 250-odd dependencies out of the lockfile the Nix build consumes. Build the zip first:

```bash
nix build .#zip
nix develop -c bash -c 'npm --prefix tests/playground ci && node tests/playground/run.mjs'
```

Browser test fixtures are committed and regenerated by `node scripts/make-fixtures.mjs`, which documents the exact dimensions and resolution tags the tests assert on.

### Bundling

Rolldown builds three entry points: `dist/thumbnailer.js` (ESM), `dist/thumbnailer.umd.js` (UMD) and `dist/worker.js`. It handles TypeScript, node resolution and CommonJS interop natively, so the config carries a single plugin — copying `gs.wasm`, which `@privyid/ghostscript` fetches at run time rather than importing, and which therefore no bundler can discover.

Rolldown transpiles TypeScript without typechecking it. `npm run build` runs `tsc -p tsconfig.build.json` first, which emits the published declarations *and* fails the build on a type error, so the guarantee is unchanged.

One wrinkle is worth knowing about before editing the config: `import.meta.url` has no meaning outside an ES module, and the library uses it to locate `worker.js`. Rollup polyfilled it for UMD output; Rolldown does not, by design. The UMD build therefore defines a shim via `transform.define` plus `output.intro`, which is why the library is built as two configs rather than one with two outputs — `transform.define` is build-level and must not touch the ESM bundle, where `import.meta.url` is legitimate. `tests/browser/umd.spec.ts` guards this.

## Releasing

Release Please watches conventional commits on `main` and maintains a release PR. Merging it bumps the version everywhere, writes `CHANGELOG.md`, tags `v{version}`, creates the GitHub Release, attaches the Nix-built `thumbnailer.zip`, and publishes `@avunu/thumbnailer` to GitHub Packages.

`package.json` is the single source of truth for the version. It is propagated to `composer.json`, the plugin header, the `THUMBNAILER_VERSION` constant and `readme.txt`, and re-stamped into the shipped copies at build time from `flake.nix`. `scripts/check-versions.mjs` fails the build if any of them drift, and runs as part of `npm run check`.

## License

AGPL-3.0-only. The bundled Ghostscript WebAssembly build is AGPL-3.0-only, which sets the license for the whole distribution.
