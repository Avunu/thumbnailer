#!/usr/bin/env node
// Static server for the browser tests.
//
// Serves the *built* dist/ — not the TypeScript sources — because the point of
// this tier is to exercise the artifact that actually ships: the rollup bundle,
// the real gs.wasm, and the worker resolved the way a browser resolves it.
//
// Binds 127.0.0.1 only, so the whole suite runs inside the Nix build sandbox
// with no network access.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");

const PORT = Number(process.env.PORT ?? 4173);
const HOST = "127.0.0.1";

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".map": "application/json; charset=utf-8",
	// Required: Ghostscript's loader uses WebAssembly.instantiateStreaming,
	// which rejects any response not served as application/wasm.
	".wasm": "application/wasm",
	".pdf": "application/pdf",
	".tiff": "image/tiff",
	".png": "image/png",
	".jpg": "image/jpeg",
};

// The harness mirrors how WordPress loads the library: a single
// <script type="module">, which is what wp_enqueue_script_module() emits. In
// that context document.currentScript is null, so this page is also what
// proves the import.meta.url fallback resolves the worker correctly.
const INDEX = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Thumbnailer browser tests</title></head>
<body>
<script type="module" src="/dist/thumbnailer.js"></script>
</body>
</html>
`;

// The UMD bundle, loaded the way a UMD consumer loads it: a classic <script>,
// where document.currentScript is set and import.meta.url does not exist. That
// is a different worker-URL code path from the module build, and it had no
// coverage at all until the Rolldown migration — which is why it was broken in
// two independent ways at once.
const INDEX_UMD = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Thumbnailer UMD browser tests</title></head>
<body>
<script src="/dist/thumbnailer.umd.js"></script>
</body>
</html>
`;

const server = createServer((req, res) => {
	const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
	const pathname = decodeURIComponent(url.pathname);

	if (pathname === "/health") {
		res.writeHead(200, { "content-type": "text/plain" });
		res.end("ok");
		return;
	}

	if (pathname === "/" || pathname === "/index.html") {
		res.writeHead(200, { "content-type": MIME[".html"] });
		res.end(INDEX);
		return;
	}

	if (pathname === "/umd") {
		res.writeHead(200, { "content-type": MIME[".html"] });
		res.end(INDEX_UMD);
		return;
	}

	// normalize collapses any ../ before it is joined, so a traversal attempt
	// cannot escape the repo root.
	const target = join(root, normalize(pathname).replace(/^(\.\.[/\\])+/u, ""));
	if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
		res.writeHead(404, { "content-type": "text/plain" });
		res.end("not found");
		return;
	}

	res.writeHead(200, {
		"content-type": MIME[extname(target)] ?? "application/octet-stream",
		"cache-control": "no-store",
	});
	createReadStream(target).pipe(res);
});

server.listen(PORT, HOST, () => {
	console.log(`browser-test server on http://${HOST}:${PORT}`);
});
