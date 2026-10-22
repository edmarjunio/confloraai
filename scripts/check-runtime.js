const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../public/pdv/dist');
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  for (const name of [manifest.script, manifest.styles]) {
    if (!/^[a-f0-9]{16}\.(js|css)$/.test(name) || !fs.statSync(path.join(directory, name)).isFile()) throw new Error('BUILD_MISSING');
  }
  const storefront = path.resolve(__dirname, '../public/storefront');
  const publicManifest = JSON.parse(fs.readFileSync(path.join(storefront, 'dist/manifest.json'), 'utf8'));
  if (!publicManifest.core.includes(publicManifest.app) || !fs.existsSync(path.join(storefront, 'sw-built.js'))) throw new Error('BUILD_MISSING');
  for (const file of publicManifest.core) {
    if (!/^\/storefront\/(?:shell\.html|dist\/versioned\/[\w.-]+)$/.test(file) ||
        !fs.statSync(path.join(storefront, file.slice('/storefront/'.length))).isFile()) throw new Error('BUILD_MISSING');
  }
} catch {
  console.error('Compile o aplicativo antes de iniciar: npm run build:frontend');
  process.exitCode = 1;
}
