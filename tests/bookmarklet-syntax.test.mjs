import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const code = `') + 'const code = `'.length;
const end = html.indexOf('})();`;', start) + '})();'.length;
const template = html.slice(start, end);

const build = new Function('dep', 'arr', 'dt', 'tm', 'trn', 'pref', 'tgTok', 'tgChat', `return \`${template}\``);

for (const [trn, tgTok, tgChat] of [['', '', ''], ['101', '123:ABC', '456']]) {
  const code = build('서울', '광주송정', '20261031', '080000', trn, 'gen_first', tgTok, tgChat);
  assert.ok(code.startsWith('javascript:'));
  assert.doesNotThrow(() => new Function(code.slice('javascript:'.length)), `SyntaxError (trn=${trn})`);
}
console.log('ok');
