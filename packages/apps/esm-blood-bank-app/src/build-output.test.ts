import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../rspack.config.js');

describe('development and production build isolation', () => {
  it('keeps live chunks outside the directory cleaned by production builds', () => {
    const development = config({}, { mode: 'development' });
    const production = config({}, { mode: 'production' });
    const fromProduction = relative(production.output.path, development.output.path);

    expect(development.output.path).not.toBe(production.output.path);
    expect(fromProduction.startsWith('..') || isAbsolute(fromProduction)).toBe(true);
    expect(production.output.path).toBe(resolve(process.cwd(), 'dist'));
    // The compiled SPA contract still discovers the same remote entry file.
    expect(development.output.filename).toBe(production.output.filename);
    expect(development.output.publicPath).toBe('auto');
  });

  it('avoids caching the live entry while retaining CORS and the existing client workaround', () => {
    const development = config({}, { mode: 'development' });
    expect(development.devServer.headers['Cache-Control']).toBe('no-store');
    expect(development.devServer.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(development.devServer.client).toBe(false);
    expect(development.devServer.hot).toBe(false);
    expect(development.devServer.liveReload).toBe(false);
  });
});
