import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import type { ConfigEnv, UserConfig } from 'vite';

export default defineConfig(({ command, mode }: ConfigEnv): UserConfig => {
  const isLib = mode === 'lib';
  const isWP = mode === 'wp';
  
  // Common configuration options
  const commonConfig: UserConfig = {
    optimizeDeps: {
      esbuildOptions: {
        target: "es2020",
      } as any,
      exclude: ['@privyid/ghostscript']
    },
    build: {
      target: 'es2020',
      modulePreload: {
        polyfill: true
      },
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/thumbnailer.ts'),
          worker: resolve(__dirname, 'src/worker.ts')
        }
      }
    },
    plugins: [
      wasm(),
      topLevelAwait()
    ],
    worker: {
      format: 'es'
    },
    publicDir: resolve(__dirname, 'node_modules/@privyid/ghostscript/dist'),
    assetsInclude: ['**/*.wasm']
  };

  if (isWP) {
    // WordPress plugin configuration
    return {
      ...commonConfig,
      build: {
        lib: {
          entry: resolve(__dirname, 'src/thumbnailer.ts'),
          name: 'thumbnailer',
          formats: ['umd'],
          fileName: () => 'thumbnailer.js'
        },
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true
      }
    };
  } else if (isLib) {
    // Base library configuration
    return {
      ...commonConfig,
      plugins: [
        ...commonConfig.plugins || [],
        dts({
          insertTypesEntry: true,
          include: ['src/*.ts']
        })
      ],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/thumbnailer.ts'),
          name: 'thumbnailer',
          formats: ['es', 'umd'],
          fileName: (format) => `thumbnailer.${format}.js`
        },
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true,
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
                return 'gs.wasm';
              }
              return 'assets/[name]-[hash][extname]';
            }
          }
        }
      }
    };
  } else {
    // Demo configuration
    return {
      ...commonConfig,
      root: 'src',
      build: {
        outDir: '../dist',
        sourcemap: true,
		emptyOutDir: true,
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
                return 'assets/[name][extname]';
              }
              return 'assets/[name]-[hash][extname]';
            }
          }
        }
      }
    };
  }
});