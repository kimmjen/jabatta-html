import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const code = `') + 'const code = `'.length;
const end = html.indexOf('})();`;', start) + '})();'.length;
const template = html.slice(start, end);

const build = new Function('dep', 'arr', 'dt', 'tm', 'trn', 'pref', 'tgTok', 'tgChat', 'pMin', 'pMax', `return \`${template}\``);

for (const [trn, tgTok, tgChat] of [['', '', ''], ['101', '123:ABC', '456']]) {
  const code = build('서울', '광주송정', '20261031', '080000', trn, 'gen_first', tgTok, tgChat, 5000, 10000);
  assert.ok(code.startsWith('javascript:'));
  assert.doesNotThrow(() => new Function(code.slice('javascript:'.length)), `SyntaxError (trn=${trn})`);
  assert.ok(code.includes('var pMin=5000,pMax=10000;'), 'poll interval not embedded');
  assert.ok(!code.includes('scheduleNext(1600)'), 'fixed 1600ms interval remains');
}

const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>[^<]*초/g)].map((m) => m[1]);
assert.ok(options.length >= 3, 'pollRate options missing');
for (const v of options) assert.match(v, /^\d+(\.\d+)?-\d+(\.\d+)?$/, `bad pollRate option: ${v}`);
console.log('ok');
