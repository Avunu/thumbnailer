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
    build: {
      target: 'es2020',
      modulePreload: {
        polyfill: true
      }
    },
    resolve: {
      alias: [
        {
          find: /^@privyid\/ghostscript\/dist\/gs\.wasm$/,
          replacement: resolve(__dirname, 'node_modules/@privyid/ghostscript/dist/gs.wasm')
        }
      ]
    },
    worker: {
      format: 'es',
      plugins: () => [
        wasm(),
        topLevelAwait()
      ]
    },
    server: {
      port: 3000
    },
    plugins: [
      wasm({
        include: [/\.wasm$/],
      }),
      topLevelAwait()
    ],
    assetsInclude: ['**/*.wasm'],
  };

  // Common build configuration for handling WASM files
  const commonBuildOptions = {
    rollupOptions: {
      external: [
        '@privyid/ghostscript',
        '@privyid/ghostscript/dist/gs.wasm'
      ],
      output: {
        globals: {
          '@privyid/ghostscript': 'GhostScript'
        },
        exports: "named",
        assetFileNames: (assetInfo) => {
          // Ensures WASM files maintain their path structure
          if (assetInfo.name && assetInfo.name.endsWith('.wasm')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
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
        emptyOutDir: false,
        ...commonBuildOptions
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
        ...commonBuildOptions
      }
    };
  } else {
    // Demo configuration
    return {
      ...commonConfig,
      root: 'src',
      publicDir: '../public',
      build: {
        outDir: '../dist',
        sourcemap: true,
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