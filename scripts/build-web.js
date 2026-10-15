const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
const babel = require('@babel/core');
const translationPlugin = require('./build/translation-plugin.cjs');
async function build() {
  await esbuild.build({ entryPoints: { app: 'src/web/app/main.jsx' }, outdir: 'public/react', bundle: true,
    format: 'esm', splitting: true, jsx: 'automatic', minify: true, target: ['es2022'],
    entryNames: '[name]', chunkNames: 'chunks/[name]-[hash]', assetNames: 'assets/[name]-[hash]',
    define: { 'process.env.NODE_ENV': '"production"' }, metafile: true,
    alias: { '@i18n': path.resolve('src/web/i18n/runtime.mjs') },
    plugins: [{ name: 'translation-keys', setup(build) {
      build.onLoad({ filter: /src[\\/]web[\\/].*\.[jm]sx?$/ }, async ({ path: filename }) => {
        const result = babel.transformSync(await fs.readFile(filename, 'utf8'), { filename, configFile: false, babelrc: false,
          plugins: [require('@babel/plugin-syntax-jsx'), translationPlugin] });
        return { contents: result.code, loader: 'jsx', resolveDir: path.dirname(filename) };
      });
    } }],
  });
  const shell = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#166534"><title>Conflora</title></head><body><div id="root"></div><script type="module" src="/react/app.js"></script></body></html>';
  await fs.copyFile('src/web/app/styles.css', 'public/react/internal.css');
  await fs.copyFile('src/web/storefront/compat.css', 'public/react/storefront.css');
  await fs.writeFile('public/react/index.html', shell);
  // Firebase Hosting also serves these entry points directly.
  await fs.writeFile('public/index.html', shell);
  await fs.writeFile('public/storefront/index.html', shell);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
