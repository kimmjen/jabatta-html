import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const code = `') + 'const code = `'.length;
const end = html.indexOf('})();`;', start) + '})();'.length;
const template = html.slice(start, end);

const build = new Function('dep', 'arr', 'dt', 'tm', 'trn', 'pref', 'tgTok', 'tgChat', 'pMin', 'pMax', 'restOn', `return \`${template}\``);
const make = (trn, tgTok, tgChat, restOn) => build('서울', '광주송정', '20261031', '080000', trn, 'gen_first', tgTok, tgChat, 5000, 10000, restOn);

for (const [trn, tgTok, tgChat] of [['', '', ''], ['101', '123:ABC', '456']]) {
  const code = make(trn, tgTok, tgChat, false);
  assert.ok(code.startsWith('javascript:'));
  assert.doesNotThrow(() => new Function(code.slice('javascript:'.length)), `SyntaxError (trn=${trn})`);
  assert.ok(!code.includes('#'), `Found '#' in bookmarklet code which breaks bookmarklet URLs!`);
  assert.ok(!code.split('\n').some(l => l.trim().startsWith('//')), `Single-line comment '//' found in bookmarklet code which breaks compressed bookmarklets!`);
  assert.ok(code.includes('var pMin=5000,pMax=10000;'), 'poll interval not embedded');
  assert.ok(!code.includes('scheduleNext(1600)'), 'fixed 1600ms interval remains');
}

// 북마클릿을 가짜 환경에서 돌려 조회 사이에 잡히는 지연(ms)을 순서대로 모은다.
async function delays(restOn, ticks) {
  const out = [];
  let pending = null;
  const el = () => ({ style: {}, remove() {}, innerHTML: '' });
  const fakeDoc = { getElementById: () => null, createElement: el, body: { appendChild() {} }, dispatchEvent() {} };
  const fakeFetch = async () => ({ json: async () => ({ h_msg_txt: 'none' }) });
  const fakeSetTimeout = (fn, ms) => { pending = fn; out.push(ms); return 1; };
  const body = make('', '', '', restOn).slice('javascript:'.length);
  new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout', 'AbortController', body)(
    {}, fakeDoc, fakeFetch, fakeSetTimeout, () => {}, undefined);
  for (let i = 0; i < ticks; i++) await pending();
  return out;
}

const REST_MIN = 60000, REST_MAX = 180000;

const off = await delays(false, 300);
assert.equal(off[0], 100, 'first tick should be immediate');
for (const d of off.slice(1)) assert.ok(d >= 5000 && d <= 10000, `interval out of range: ${d}`);

const on = await delays(true, 450);
const restAt = on.map((d, i) => (d >= REST_MIN ? i : -1)).filter((i) => i >= 0);
assert.ok(restAt.length >= 2, 'expected at least two rests in 450 ticks');
// out[0]는 첫 예약(100ms)이라 i번째 지연은 i번째 조회 직후의 것
assert.ok(restAt[0] >= 100 && restAt[0] <= 200, `first rest after ${restAt[0]} ticks`);
assert.ok(restAt[1] - restAt[0] >= 100 && restAt[1] - restAt[0] <= 200, `second rest after ${restAt[1] - restAt[0]} ticks`);
for (const i of restAt) assert.ok(on[i] <= REST_MAX, `rest too long: ${on[i]}`);

const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>[^<]*초/g)].map((m) => m[1]);
assert.ok(options.length >= 3, 'pollRate options missing');
for (const v of options) assert.match(v, /^\d+(\.\d+)?-\d+(\.\d+)?$/, `bad pollRate option: ${v}`);
console.log('ok');
