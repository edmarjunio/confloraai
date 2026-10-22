const { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');
const root = resolve(__dirname, '..');
const destination = resolve(root, 'public/pdv/dist');
mkdirSync(destination, { recursive: true });
const files = ['order-card.styles.js', 'components.jsx', 'delivery.jsx', 'app.jsx'];
const source = "const React = require('react'); const ReactDOM = require('react-dom/client'); window.ConfloraNotifications = require('./public/storefront/browser-notifications.js'); window.React = React; window.styled = {default:require('styled-components').default};\n" + files.map(file => readFileSync(resolve(root, 'public/pdv', file), 'utf8')).join('\n');
const result = esbuild.buildSync({ stdin: { contents: source, loader: 'jsx', resolveDir: root }, bundle: true, minify: true, sourcemap: false, drop: ['debugger'], write: false, define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'], logLevel: 'warning' });
const javascript = result.outputFiles[0].contents;
execFileSync(process.execPath, [resolve(dirname(require.resolve('@tailwindcss/cli/package.json')), 'dist/index.mjs'), '-i', resolve(root, 'public/pdv/styles.css'), '-o', resolve(destination, 'styles.css'), '--minify'], { cwd: root, stdio: 'pipe' });
const stylesheet = readFileSync(resolve(destination, 'styles.css'));
const name = (content, extension) => createHash('sha256').update(content).digest('hex').slice(0, 16) + '.' + extension;
const manifest = { script: name(javascript, 'js'), styles: name(stylesheet, 'css') };
// Only remove files created by this build in its fixed output directory.
for (const file of readdirSync(destination)) if (/^[a-f0-9]{16}\.(js|css)$/.test(file) || file === 'styles.css') unlinkSync(resolve(destination, file));
writeFileSync(resolve(destination, manifest.script), javascript); writeFileSync(resolve(destination, manifest.styles), stylesheet);
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest));
console.log('Interface do caixa compilada com dependências locais e arquivos versionados.');

const storefrontDestination = resolve(root, 'public/storefront/dist');
mkdirSync(storefrontDestination, { recursive: true });
esbuild.buildSync({ entryPoints: [resolve(root, 'public/storefront/spending-chart.jsx')], outfile: resolve(storefrontDestination, 'spending-chart.js'), bundle: true, format: 'esm', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'], logLevel: 'warning' });
require('./build-storefront').buildStorefront(root);
