import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ command, mode }) => {
  const isLib = mode === 'lib';
  
  return {
    build: isLib ? {
      lib: {
        entry: resolve('src/index.ts'),
        name: 'thumbnailer',
        fileName: (format) => `thumbnailer.${format}.js`,
        formats: ['es', 'umd']
      },
      rollupOptions: {
        external: ['@privyid/ghostscript'],
        output: {
          globals: {
            '@privyid/ghostscript': 'GhostScript'
          }
        }
      },
      outDir: 'dist',
      sourcemap: true
    } : {
      target: 'esnext',
      outDir: 'dist-demo',
      sourcemap: true
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      isLib && dts({
        insertTypesEntry: true,
        include: ['src/**/*.ts'],
        exclude: ['src/demo/**/*', 'src/test.ts']
      })
    ].filter(Boolean),
    optimizeDeps: {
      esbuildOptions: {
        target: "esnext",
      } as any,
      exclude: ['@privyid/ghostscript'],
    },
    worker: {
      format: 'es'
    },
    server: {
      port: 3000
    }
  };
});