const esbuild = require('esbuild')

esbuild.build({
  entryPoints: {
    page1: 'src/separate-files/page1.ts',
    page2: 'src/separate-files/page2.ts',
    page3: 'src/separate-files/page3.ts',
  },
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'dist/separate',
  minify: true,
  treeShaking: true,
  mangleProps: /^_/,
  legalComments: 'none',
  drop: ['debugger'],
  pure: [],
  ignoreAnnotations: false,
  chunkNames: 'shared-[name]-[hash]',
}).then(() => console.log('esbuild separate: done'))
