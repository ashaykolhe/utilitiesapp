'use strict';
/* Runs every tests/functional/*.test.js in its own process and prints a summary. Usage: node tests/run-functional.js [filter] */
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'functional'), filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f.includes(filter)).sort();
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const last = out.trim().split('\n').slice(-1)[0] || '(no output)';
  console.log((r.status === 0 ? 'ok   ' : 'FAIL ') + f + '  ' + last);
  if (r.status !== 0) { bad++; console.log(out.split('\n').filter(l => /FAIL|Error|error/.test(l)).slice(0, 8).map(l => '       ' + l).join('\n')); }
}
console.log(bad ? '\n' + bad + ' functional test file(s) failed' : '\nall ' + files.length + ' functional test file(s) passed');
process.exit(bad ? 1 : 0);
