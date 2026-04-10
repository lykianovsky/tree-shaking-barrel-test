const esbuild = require('esbuild')

esbuild.build({
  entryPoints: {
    page1: 'src/single-file/page1.ts',
    page2: 'src/single-file/page2.ts',
    page3: 'src/single-file/page3.ts',
  },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist/single',
  minify: true,
  treeShaking: true,
  legalComments: 'none',
  drop: ['debugger'],
  chunkNames: 'shared-[name]-[hash]',
}).then(() => console.log('esbuild single: done'))
