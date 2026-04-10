import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist/direct',
    rollupOptions: {
      input: {
        page1: resolve(__dirname, 'src/direct-files/page1.ts'),
        page2: resolve(__dirname, 'src/direct-files/page2.ts'),
        page3: resolve(__dirname, 'src/direct-files/page3.ts'),
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
