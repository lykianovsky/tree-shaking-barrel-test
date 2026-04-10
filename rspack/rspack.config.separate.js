const path = require('path')

module.exports = {
  mode: 'production',
  entry: {
    page1: './src/separate-files/page1.ts',
    page2: './src/separate-files/page2.ts',
    page3: './src/separate-files/page3.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/separate'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  devtool: false,
}
