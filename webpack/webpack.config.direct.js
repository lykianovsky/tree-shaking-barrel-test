const path = require('path')

module.exports = {
  mode: 'production',
  entry: {
    page1: './src/direct-files/page1.ts',
    page2: './src/direct-files/page2.ts',
    page3: './src/direct-files/page3.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/direct'),
    clean: true,
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
}
