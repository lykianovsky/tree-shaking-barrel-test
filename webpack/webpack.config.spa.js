const path = require('path')

const baseConfig = {
  mode: 'production',
  entry: {
    app: './src/spa/entry.ts',
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
}

module.exports = [
  {
    ...baseConfig,
    name: 'spa-default',
    output: {
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      path: path.resolve(__dirname, 'dist/spa-default'),
      clean: true,
    },
  },
  {
    ...baseConfig,
    name: 'spa-split',
    output: {
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      path: path.resolve(__dirname, 'dist/spa-split'),
      clean: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        minSize: 0,
      },
    },
  },
]
