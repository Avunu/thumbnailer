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
      exclude: ['@privyid/ghostscript'],
    },
    worker: {
      format: 'es' as const,
      plugins: () => [
        wasm(),
        topLevelAwait()
      ]
    },
    server: {
      port: 3000
    },
    plugins: [
      wasm(),
      topLevelAwait()
    ]
  };

  if (isWP) {
    // WordPress plugin configuration
    return {
      ...commonConfig,
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'thumbnailer',
          formats: ['umd'],
          fileName: () => 'thumbnailer.js'
        },
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: false,
        rollupOptions: {
          external: ['@privyid/ghostscript'],
          output: {
            globals: {
              '@privyid/ghostscript': 'GhostScript'
            }
          }
        }
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
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'thumbnailer',
          formats: ['es', 'umd'],
          fileName: (format) => `thumbnailer.${format}.js`
        },
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true,
        rollupOptions: {
          external: ['@privyid/ghostscript'],
          output: {
            globals: {
              '@privyid/ghostscript': 'GhostScript'
            }
          }
        }
      }
    };
  } else {
    // Demo configuration
    return {
      ...commonConfig,
      root: 'demo',
      build: {
        outDir: '../dist-demo',
        sourcemap: true
      }
    };
  }
});