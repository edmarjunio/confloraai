const fs = require('node:fs');
const path = require('node:path');
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = value => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const source = path.resolve(__dirname, '../docs/MANUAL-EQUIPE-CONFLORA.md');
const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
const content = []; const headings = []; let list = null; let table = false;
function close() { if (list) content.push(`</${list}>`); list = null; if (table) content.push('</tbody></table></div>'); table = false; }
for (const line of lines) {
  if (!line.trim()) { close(); continue; }
  const heading = /^(#{1,3}) (.*)/.exec(line);
  if (heading) { close(); const level = heading[1].length; const id = 'sec-' + headings.length; headings.push({ level, id, text: heading[2] }); content.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`); continue; }
  if (line.startsWith('|')) {
    if (/^\|[\s|:-]+\|$/.test(line)) continue;
    const cells = line.slice(1, -1).split('|').map(cell => inline(cell.trim()));
    if (!table) { if (list) { content.push(`</${list}>`); list = null; } content.push('<div class="table-wrap"><table><thead><tr>' + cells.map(cell => '<th>' + cell + '</th>').join('') + '</tr></thead><tbody>'); table = true; }
    else content.push('<tr>' + cells.map(cell => '<td>' + cell + '</td>').join('') + '</tr>');
    continue;
  }
  const item = /^(\d+\. |\- )(.*)/.exec(line);
  if (item) {
    const type = item[1] === '- ' ? 'ul' : 'ol';
    if (list !== type) { close(); content.push(`<${type}>`); list = type; }
    content.push('<li>' + inline(item[2]) + '</li>'); continue;
  }
  close(); content.push('<p>' + inline(line) + '</p>');
}
close();
const nav = headings.filter(heading => heading.level === 2).map(heading => `<a href="#${heading.id}">${escape(heading.text)}</a>`).join('');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manual da equipe Conflora</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f7f5;color:#183427;font:16px/1.65 Arial,sans-serif}header{padding:36px 6%;background:#124d2d;color:white}header strong{font-size:28px}main{max-width:1080px;margin:auto;padding:30px 24px}nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px}nav a{padding:8px 12px;background:#e4f2e8;color:#124d2d;border-radius:8px;text-decoration:none;font-size:14px}article{padding:32px;background:white;border:1px solid #dce7de;border-radius:16px}h1{font-size:32px;line-height:1.2}h2{margin-top:44px;padding-top:22px;border-top:2px solid #dce7de;scroll-margin-top:20px}h3{margin-top:30px}li{margin:10px 0}code{font-size:14px;background:#edf3ee;padding:2px 5px;border-radius:4px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #dce7de;padding:10px;text-align:left;vertical-align:top}th{background:#e4f2e8}footer{text-align:center;padding:28px;color:#52685a}.print{background:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}@media(max-width:600px){article{padding:18px}main{padding:18px 10px}h1{font-size:26px}}@media print{body{background:white;font-size:11pt}header{padding:15px;color:#124d2d;background:white}nav,.print{display:none}main,article{max-width:none;padding:0;border:0}h2,h3{break-after:avoid}tr{break-inside:avoid}a{color:inherit;text-decoration:none}@page{size:A4;margin:18mm}}
</style></head><body><header><strong>Conflora Horta e Viveiro</strong><p>Manual de operação por função · 18/10/2026</p><button class="print" onclick="window.print()">Imprimir ou salvar em PDF</button></header><main><nav aria-label="Índice do manual">${nav}</nav><article>${content.join('\n')}</article></main><footer>Conflora · Guia da equipe · Operação com Pix manual até ativação do Sicredi</footer></body></html>`;
fs.writeFileSync(path.resolve(__dirname, '../docs/MANUAL-EQUIPE-CONFLORA.html'), html);
console.log('Manual da equipe pronto para leitura, impressão e PDF pelo navegador.');
