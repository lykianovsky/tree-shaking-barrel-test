const path = require('path')

module.exports = {
  mode: 'production',
  entry: {
    page1: './src/single-file/page1.ts',
    page2: './src/single-file/page2.ts',
    page3: './src/single-file/page3.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/single'),
    clean: true,
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    usedExports: true,
    splitChunks: {
      chunks: 'all',
      minSize: 0, // Чтобы даже маленькие модули выносились в shared
    },
  },
}
