import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist/single',
    rollupOptions: {
      input: {
        page1: resolve(__dirname, 'src/single-file/page1.ts'),
        page2: resolve(__dirname, 'src/single-file/page2.ts'),
        page3: resolve(__dirname, 'src/single-file/page3.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared-[name].js',
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        toplevel: true,
        dead_code: true,
        collapse_vars: true,
      },
      mangle: { toplevel: true },
    },
  },
})
