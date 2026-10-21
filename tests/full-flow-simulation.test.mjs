import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const start = html.indexOf('const code = `') + 'const code = `'.length;
const end = html.indexOf('})();`;', start) + '})();'.length;
const template = html.slice(start, end);

const build = new Function('dep', 'arr', 'dt', 'tm', 'trn', 'pref', 'tgTok', 'tgChat', 'pMin', 'pMax', 'restOn', `return \`${template}\``);
const rawCode = build('용산', '광주송정', '20261031', '183100', '', 'gen_first', '', '', 5000, 10000, false);

console.log('1. 북마클릿 코드 생성 확인:');
assert.ok(rawCode.startsWith('javascript:'));
console.log('   - 총 코드 길이:', rawCode.length, '자');
console.log('   - "#" 문자 포함 여부: 0개 (정상)');
assert.ok(!rawCode.includes('#'));

// 가상 브라우저 DOM & Fetch 환경 구축
const elements = new Map();
const createdElements = [];

function makeEl(tag) {
  let _innerHtml = '';
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    style: {},
    innerText: '',
    children: [],
    onclick: null,
    get innerHTML() { return _innerHtml; },
    set innerHTML(val) {
      _innerHtml = val;
      const ids = [...val.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
      for (const id of ids) {
        if (!elements.has(id)) {
          const child = makeEl('div');
          child.id = id;
          elements.set(id, child);
        }
      }
    },
    remove() {
      if (el.id) elements.delete(el.id);
    },
    appendChild(child) {
      el.children.push(child);
      if (child.id) elements.set(child.id, child);
    }
  };
  createdElements.push(el);
  return el;
}

const fakeDoc = {
  getElementById: (id) => elements.get(id) || null,
  createElement: (tag) => makeEl(tag),
  body: {
    appendChild: (child) => {
      if (child.id) elements.set(child.id, child);
    }
  },
  dispatchEvent: () => {}
};

let tickCount = 0;
let fetchCalls = [];

const fakeFetch = async (url, opts) => {
  fetchCalls.push({ url, opts });
  if (url.includes('ScheduleView')) {
    tickCount++;
    return {
      json: async () => ({
        strResult: 'SUCC',
        trn_infos: {
          trn_info: [
            { h_trn_no: '1451', h_trn_clsf_nm: '새마을', h_dpt_tm: '181000', h_spe_rsv_cd: '13', h_gen_rsv_cd: '11' }, // 새마을 일반실 자리 있음
            { h_trn_no: '00435', h_trn_clsf_nm: 'KTX', h_dpt_tm: '183100', h_spe_rsv_cd: '13', h_gen_rsv_cd: (tickCount >= 4 ? '11' : '13') }, // KTX 435호는 시도 3회차에 취소표 발생!
            { h_trn_no: '00437', h_trn_clsf_nm: 'KTX', h_dpt_tm: '194100', h_spe_rsv_cd: '13', h_gen_rsv_cd: '13' }
          ]
        }
      })
    };
  }
  if (url.includes('TicketReservation')) {
    return {
      json: async () => ({
        strResult: 'SUCC',
        h_pnr_no: '999920261031TEST'
      })
    };
  }
  return { json: async () => ({}) };
};

let pendingTimer = null;
const fakeSetTimeout = (fn, ms) => {
  pendingTimer = fn;
  return 123;
};

const fakeClearTimeout = () => {
  pendingTimer = null;
};

const jsBody = rawCode.slice('javascript:'.length);
const runEnv = new Function(
  'window', 'document', 'fetch', 'setTimeout', 'clearTimeout', 'AbortController', 'alert',
  jsBody
);

const fakeWindow = {};
let alertMessages = [];
const fakeAlert = (msg) => alertMessages.push(msg);

console.log('\n2. 북마클릿 최초 실행 테스트 (사용자가 북마크 클릭한 시점):');
runEnv(fakeWindow, fakeDoc, fakeFetch, fakeSetTimeout, fakeClearTimeout, undefined, fakeAlert);

// 오버레이가 생성되었는가?
const overlay = fakeDoc.getElementById('jabatta_overlay');
assert.ok(overlay, '오버레이 엘리먼트가 DOM에 생성되지 않음');
console.log('   - [성공] jabatta_overlay 엘리먼트 정상 생성');

// 최초 로드 tick 실행 (열차 목록 불러오기)
assert.ok(pendingTimer, '첫 번째 스케줄 타이머가 잡히지 않음');
await pendingTimer();

console.log('\n3. 대기 모드 동작 검증 (사용자가 열차를 고르기 전):');
assert.equal(fakeWindow.__jabatta_running, false, '감시 루프가 멋대로 실행 중임!');
const trainList = fakeDoc.getElementById('j_train_list');
assert.ok(trainList, '열차 리스트 컨테이너 없음');
console.log('   - 렌더링된 열차 버튼 수:', trainList.children.length, '개');
trainList.children.forEach(b => console.log('     *', b.innerText));

// 중요 검증: 새마을호에 자리가 있었음에도 불구하고, 사용자가 감시 시작을 누르지 않았으므로 예약 요청이 절대 나가면 안 됨!
const rsvBeforeStart = fetchCalls.filter(c => c.url.includes('TicketReservation'));
assert.equal(rsvBeforeStart.length, 0, '사용자 시작 버튼 클릭 전에 예약이 멋대로 실행됨!');
console.log('   - [성공] 사용자 동의 없이 새마을호가 제멋대로 예약되지 않음 (예약 호출 0건 확인)');

console.log('\n4. 사용자가 435호 열차를 클릭하고 [감시 시작]을 누르는 시나리오:');
// 435호 버튼 찾아서 클릭
const btn435 = trainList.children.find(b => b.innerText.includes('435'));
assert.ok(btn435, '435호 버튼을 찾을 수 없음');
btn435.onclick();
console.log('   - [성공] 435호 열차 클릭 완료. 현재 타깃:', fakeWindow.__jabatta_cur_trn, '호');
assert.equal(fakeWindow.__jabatta_cur_trn, '00435');

// 감시 시작 버튼 클릭
const startBtn = fakeDoc.getElementById('j_start_btn');
assert.ok(startBtn, '감시 시작 버튼 없음');
startBtn.onclick();
assert.equal(fakeWindow.__jabatta_running, true, '감시 루프가 running으로 전환되지 않음');
console.log('   - [성공] [선택한 열차 감시 시작] 클릭 완료. 실시간 루프 가동 시작');

console.log('\n5. 실시간 감시 시뮬레이션 (취소표 탐색):');
console.log('   - 시도 1: 435호 매진 상태 (대기)');
await pendingTimer(); // 시도 1
assert.equal(fetchCalls.filter(c => c.url.includes('TicketReservation')).length, 0);

console.log('   - 시도 2: 435호 여전히 매진 (대기)');
await pendingTimer(); // 시도 2
assert.equal(fetchCalls.filter(c => c.url.includes('TicketReservation')).length, 0);

console.log('   - 시도 3: 435호에 드디어 취소표 발생!');
await pendingTimer(); // 시도 3 (이때 435호 취소표 발생하도록 모킹)

const rsvCalls = fetchCalls.filter(c => c.url.includes('TicketReservation'));
assert.equal(rsvCalls.length, 1, '예약 요청이 1건 실행되어야 함');
const rsvBody = rsvCalls[0].opts.body;
console.log('   - [성공] 435호 취소표 발생 즉시 TicketReservation API 전송!');
console.log('     * 예약 요청 열차번호 파라미터 확인:', rsvBody.includes('txtTrnNo1=00435') ? '00435호 정확히 전송됨' : '열차번호 불일치!');
assert.ok(rsvBody.includes('txtTrnNo1=00435'));

console.log('   - [성공] 예약 완료 알림 메시지 확인:');
alertMessages.forEach(m => console.log('     [ALERT]', m.replace(/\n/g, ' ')));

console.log('\n=========================================');
console.log('🎉 전체 흐름 테스트 100% 통과! (새마을호 차단 & 435호 단독 예약 검증 완료)');
console.log('=========================================');
