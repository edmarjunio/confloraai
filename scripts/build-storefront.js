const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const esbuild = require('esbuild');

function buildStorefront(root = path.resolve(__dirname, '..')) {
  const assets = path.join(root, 'public/storefront');
  const destination = path.join(assets, 'dist/versioned');
  fs.mkdirSync(destination, { recursive: true });
  const result = esbuild.buildSync({
    entryPoints: [path.join(assets, 'app.js')], outdir: destination,
    bundle: true, splitting: true, format: 'esm', minify: true,
    target: ['es2022'], entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]',
    metafile: true, logLevel: 'warning',
  });
  const entry = Object.entries(result.metafile.outputs).find(([, value]) => value.entryPoint?.replace(/\\/g, '/').endsWith('/app.js'));
  const appUrl = '/storefront/dist/versioned/' + path.basename(entry[0]);
  const shellAssets = new Set([appUrl]);
  // Static imports are essential to execute the first screen. Lazy modules stay lazy.
  function includeImports(output) {
    for (const dependency of result.metafile.outputs[output]?.imports || []) {
      if (dependency.kind !== 'import-statement' || dependency.external) continue;
      const url = '/storefront/dist/versioned/' + path.basename(dependency.path);
      if (!shellAssets.has(url)) { shellAssets.add(url); includeImports(dependency.path); }
    }
  }
  includeImports(entry[0]);
  let html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
  html = html.replace(/(src|href)="(\/store-assets\/[^"?]+)(?:\?[^\"]*)?"/g, (match, attr, url) => {
    if (url === '/store-assets/v5/app.js') return `${attr}="${appUrl}"`;
    const relative = url.replace(/^\/store-assets\/(?:v[2-5]\/)?/, '');
    if (!/\.(?:js|css|png|webp|svg)$/.test(relative)) return match;
    const file = path.join(assets, relative);
    const extension = path.extname(file);
    let content = fs.readFileSync(file);
    if (extension === '.js' || extension === '.css') content = Buffer.from(esbuild.transformSync(content.toString(), {
      loader: extension === '.css' ? 'css' : 'js', minify: true, target: ['es2022'],
    }).code);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const name = `${path.basename(file, extension)}-${hash}${extension}`;
    fs.writeFileSync(path.join(destination, name), content);
    const versioned = '/storefront/dist/versioned/' + name;
    shellAssets.add(versioned);
    return `${attr}="${versioned}"`;
  });
  // Parser-blocking utilities do not need to block CSS discovery or HTML parsing.
  html = html.replace(/<script src=/g, '<script defer src=');
  // Deferred classic scripts execute before the deferred module entry.
  fs.writeFileSync(path.join(assets, 'shell.html'), html);
  const core = ['/storefront/shell.html', ...shellAssets];
  const version = createHash('sha256').update(html).update(JSON.stringify(core)).digest('hex').slice(0, 16);
  const worker = fs.readFileSync(path.join(assets, 'sw.js'), 'utf8')
    .replace('/* BUILD_MANIFEST */', `self.CONFLORA_BUILD = ${JSON.stringify({ version, core })};`);
  fs.writeFileSync(path.join(assets, 'sw-built.js'), worker);
  fs.writeFileSync(path.join(assets, 'dist/manifest.json'), JSON.stringify({ version, app: appUrl, core, outputs: result.metafile.outputs }, null, 2));
  console.log(`Storefront: ${shellAssets.size} recursos essenciais versionados; módulos secundários sob demanda.`);
  return { version, core };
}
if (require.main === module) buildStorefront();
module.exports = { buildStorefront };
