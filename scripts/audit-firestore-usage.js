// Static, local-only inventory; never constructs a database client or reads credentials.
const fs = require('node:fs');
const path = require('node:path');

function inventory(root = path.resolve(__dirname, '../src')) {
  const references = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'dataconnect-admin-generated') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.name.endsWith('.js')) continue;
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        const pattern = /\.(collectionGroup|collection|get|set|read|list|scanPage)\(\s*['"]([a-z][a-z0-9_]*)(?:['"])/g;
        for (const match of line.matchAll(pattern)) references.push({ collection: match[2], access: match[1],
          file: path.relative(path.resolve(__dirname, '..'), file).replaceAll('\\', '/'), line: index + 1 });
      });
    }
  }
  walk(root);
  return { note: 'Static references only; dynamic adapters, multiline calls and subcollection scope require manual review. get/set names can include non-Firestore calls.', references };
}
if (require.main === module) console.log(JSON.stringify(inventory(), null, 2));
module.exports = { inventory };
