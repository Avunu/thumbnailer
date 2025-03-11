// @ts-check
import * as esbuild from 'esbuild'
import { copy } from 'fs-extra'
import { resolve } from 'path'

const wasmSource = resolve(__dirname, 'node_modules/@privyid/ghostscript/dist/gs.wasm')

async function buildLib() {
  // Build the main library
  await esbuild.build({
    entryPoints: ['src/thumbnailer.ts'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/thumbnailer.js',
    sourcemap: true,
    target: 'es2020',
    external: ['@privyid/ghostscript']
  })

  // Build the worker
  await esbuild.build({
    entryPoints: ['src/worker.ts'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/worker.js',
    sourcemap: true,
    target: 'es2020'
  })

  // Copy WASM file
  await copy(wasmSource, 'dist/gs.wasm')
}

// Run the appropriate build
const mode = process.argv[2] || 'lib'
console.log(`Building for ${mode}...`)

switch (mode) {
  case 'lib':
    buildLib()
    break
  default:
    console.error('Unknown build mode:', mode)
    process.exit(1)
}