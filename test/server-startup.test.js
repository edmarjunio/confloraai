const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { spawn } = require('node:child_process');

test('busy port exits with failure and never reports successful startup or leaves workers alive', { timeout: 12000 }, async t => {
  const occupied = net.createServer();
  occupied.listen(0, '0.0.0.0');
  await new Promise(resolve => occupied.once('listening', resolve));
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  const child = spawn(process.execPath, ['--import', './scripts/test-env.js', 'src/server.js'], {
    cwd: require('node:path').resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test', PORT: String(occupied.address().port) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 1);
  assert.match(output, /EADDRINUSE/);
  assert.doesNotMatch(output, /online com sucesso|rodando com sucesso na porta/);
});
