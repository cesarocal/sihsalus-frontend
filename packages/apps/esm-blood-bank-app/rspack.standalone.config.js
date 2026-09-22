const path = require('node:path');
const { HtmlRspackPlugin } = require('@rspack/core');

module.exports = (_env, argv = {}) => ({
  mode: argv.mode || 'development',
  entry: './src/standalone.tsx',
  output: {
    path: path.resolve(__dirname, 'dist', 'standalone'),
    filename: 'standalone.js',
    clean: true,
  },
  devtool: 'source-map',
  devServer: {
    port: 8090,
    hot: true,
    open: false,
    historyApiFallback: true,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: require.resolve('swc-loader'),
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } },
            target: 'es2020',
          },
        },
      },
      { test: /\.css$/, use: [require.resolve('style-loader'), require.resolve('css-loader')] },
      {
        test: /\.s[ac]ss$/i,
        use: [
          require.resolve('style-loader'),
          {
            loader: require.resolve('css-loader'),
            options: { modules: { localIdentName: 'blood-bank__[local]___[hash:base64:5]' } },
          },
          {
            loader: require.resolve('sass-loader'),
            options: { api: 'modern-compiler', implementation: require.resolve('sass-embedded') },
          },
        ],
      },
    ],
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  plugins: [new HtmlRspackPlugin({ template: './standalone.html' })],
});
