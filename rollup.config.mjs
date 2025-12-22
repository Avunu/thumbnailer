import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import wasm from '@rollup/plugin-wasm';
import copy from 'rollup-plugin-copy';
import { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const wasmSource = resolvePath(__dirname, 'node_modules/@privyid/ghostscript/dist/gs.wasm');

export default [
  {
    // Main library
    input: 'src/thumbnailer.ts',
    output: [
      {
        file: 'dist/thumbnailer.js',
        format: 'es',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/thumbnailer.umd.js',
        format: 'umd',
        name: 'Thumbnailer',
        sourcemap: true,
        exports: 'named'
      }
    ],
    external: ['@privyid/ghostscript'],
    plugins: [
      typescript(),
      resolve({ 
        browser: true, 
        extensions: ['.js', '.ts', '.tsx', '.wasm']
      }),
      commonjs(),
      wasm({
        targetEnv: 'auto'
      })
    ]
  },
  {
    // Worker
    input: 'src/worker.ts',
    output: {
      file: 'dist/worker.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      typescript(),
      resolve({ browser: true, extensions: ['.js', '.ts', '.tsx', '.wasm'] }),
      commonjs(),
      wasm({
        targetEnv: 'auto'
      }),
      copy({
        targets: [
          { src: wasmSource, dest: 'dist' },
        ]
      })
    ]
  },
  {
    // Demo application
    input: 'demo/demo.ts',
    output: {
      file: 'demo/demo.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: false,
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          strict: false,
          noEmit: false,
          declaration: false
        }
      }),
      resolve({ browser: true, extensions: ['.ts', '.js'] }),
      commonjs()
    ]
  }
];
