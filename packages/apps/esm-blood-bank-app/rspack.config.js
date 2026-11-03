const defaultConfig = require('openmrs/default-rspack-config');
const { resolve } = require('node:path');

module.exports = (env, argv) => {
  const config = defaultConfig(env, argv);

  if (config.mode === 'development') {
    // A production build cleans dist. Keep live development chunks outside it
    // so validation cannot remove files still referenced by the running server.
    config.output = {
      ...config.output,
      path: resolve(__dirname, 'node_modules', '.cache', 'blood-bank-dev'),
    };
    // The current Rspack dev client crashes before this ESM can mount when it
    // calls setLogLevel. Keep recompilation, and refresh the browser manually.
    config.devServer = {
      ...config.devServer,
      headers: {
        ...config.devServer?.headers,
        'Cache-Control': 'no-store',
      },
      client: false,
      hot: false,
      liveReload: false,
    };
  }

  return config;
};
