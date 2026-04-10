import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default {
  input: {
    page1: 'src/single-file/page1.ts',
    page2: 'src/single-file/page2.ts',
    page3: 'src/single-file/page3.ts',
  },
  output: {
    dir: 'dist/single',
    format: 'es',
    entryFileNames: '[name].js',
    chunkFileNames: 'shared-[name].js',
    compact: true,
    experimentalMinChunkSize: 1000,
  },
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
    unknownGlobalSideEffects: false,
  },
  plugins: [resolve({ rootDir: '..' }), typescript({ rootDir: '..', tsconfig: './tsconfig.json' }), terser()],
}
