import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({ command, mode }) => {
  const isLib = mode === 'lib';
  const isWP = mode === 'wp';
  
  // Base configuration for the library
  const libConfig = {
    build: {
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
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      dts({
        insertTypesEntry: true,
        include: ['src/**/*.ts'],
        exclude: ['src/demo/**/*', 'src/test.ts', 'src/thumbnailer.ts']
      })
    ]
  };
  
  // WordPress plugin configuration
  const wpConfig = {
    build: {
      lib: {
        entry: resolve('src/thumbnailer.ts'),
        name: 'thumbnailer',
        fileName: () => 'thumbnailer.js',
        formats: ['umd']
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
    },
    plugins: [
      wasm(),
      topLevelAwait()
    ]
  };
  
  // Demo configuration
  const demoConfig = {
    build: {
      target: 'esnext',
      outDir: 'dist-demo',
      sourcemap: true
    },
    plugins: [
      wasm(),
      topLevelAwait()
    ]
  };
  
  // Common configuration options
  const commonConfig = {
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
  
  // Return the appropriate configuration
  if (isWP) {
    return { ...wpConfig, ...commonConfig };
  } else if (isLib) {
    return { ...libConfig, ...commonConfig };
  } else {
    return { ...demoConfig, ...commonConfig };
  }
});