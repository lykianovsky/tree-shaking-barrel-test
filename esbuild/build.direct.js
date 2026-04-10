const esbuild = require('esbuild')

esbuild.build({
  entryPoints: {
    page1: 'src/direct-files/page1.ts',
    page2: 'src/direct-files/page2.ts',
    page3: 'src/direct-files/page3.ts',
  },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist/direct',
  minify: true,
  treeShaking: true,
  legalComments: 'none',
  drop: ['debugger'],
  chunkNames: 'shared-[name]-[hash]',
}).then(() => console.log('esbuild direct: done'))
