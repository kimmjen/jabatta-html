# Claude Development Guide (CLAUDE.md)

이 문서는 **Jabatta-HTML (잡았다 북마클릿 웹 생성기)** 프로젝트에서 Claude 및 모든 AI 어시스턴트가 코드를 분석, 유지보수, 수정할 때 준수해야 하는 엔지니어링 가이드라인입니다.

---

## 📌 1. 프로젝트 개요 및 핵심 철학
- **목적**: 별도의 클라이언트 설치 없이 누구나 웹 브라우저 북마크 등록만으로 코레일(KTX/SRT) 취소표를 0.1초 만에 낚아챌 수 있는 정적 웹 생성기.
- **단일 파일 아키텍처 (Single-File Architecture)**:
  - 모든 UI, CSS, JavaScript, 북마클릿 생성 엔진은 **`index.html` 단일 파일**에 완결되어야 합니다.
  - 빌드 단계(Webpack, Vite, Babel 등)나 npm 의존성을 추가하지 마십시오. GitHub Pages에서 즉시 서빙되는 순수 웹 표준(Vanilla)을 유지합니다.

---

## 🚄 2. 코레일 모바일 API 규격 가이드

### 조회 엔드포인트
- **URL**: `/classes/com.korail.mobile.seatMovie.ScheduleView` (POST)
- **핵심 파라미터**:
  - `txtGoAbrdDt`: 탑승 일자 (`YYYYMMDD`)
  - `txtGoHour`: 조회 시작 시간 (`HH`, 2자리)
  - `txtGoStart`: 출발역 명칭 (예: `광주송정`, `서울`)
  - `txtGoEnd`: 도착역 명칭 (예: `동탄`, `부산`)
  - `radJobId`: `'1'` (편도)
  - `selGoTrain`: `'100'` (KTX/전체)
- **잔여석 판별 필드**:
  - 일반실 가능: `item.h_gen_rsv_cd === '11'`
  - 특실 가능: `item.h_spe_rsv_cd === '11'`

### 예약 엔드포인트
- **URL**: `/classes/com.korail.mobile.certification.TicketReservation` (POST)
- **핵심 파라미터**:
  - `txtPsrmClCd1`: 좌석 등급 (`'1'`: 일반실, `'2'`: 특실)
  - `txtJobId`: `'1101'`
  - `txtJrnyCnt`: `'1'`
  - `txtJrnySqno1`: `'001'`
  - `txtJrnyTpCd1`: `'11'`
  - `txtMenuId`: `'11'`
  - `txtTotPsgCnt`: `'1'`

---

## 🛡️ 3. 브라우저 크래시 방지 필수 규칙 (Zero-Crash Engine)

장시간(수 시간~밤샘) 백그라운드 폴링 시 macOS/Windows 브라우저 프로세스 강제 종료(SIGTRAP, OOM, Aw Snap!)를 방지하기 위해 다음 규칙을 엄격히 준수하십시오:

1. **절대 `setInterval`을 사용하지 말 것**:
   - 비동기 타이머 누적 및 콜 스택 팽창 방지를 위해 반드시 **재귀적 `setTimeout(doTick, 1600)`** 방식을 사용하십시오.
2. **`cache: 'no-store'` 헤더 강제**:
   - 브라우저 메인 프로세스(AppKit/CrBrowserMain)에 HTTP 캐시 메타데이터가 쌓여 가상 메모리(`va_size`)가 고갈되지 않도록 fetch 시 캐시를 완전히 비활성화하십시오.
3. **요청 폼 데이터 사전 캐싱**:
   - 루프 내부에서 `new URLSearchParams(...)`를 매 회차 생성하지 말고, 클로저 바깥에 문자열로 미리 빌드하여 메모리 할당을 0으로 억제하십시오.
4. **JSON 객체 즉시 참조 해제**:
   - 각 회차의 `rst`, `trs`, `list` 변수는 작업 직후 `null`을 대입하여 V8 가비지 컬렉터가 즉시 수거하도록 하십시오.
5. **코레일 세션 킬러 방지 (`keepAlive`)**:
   - 무조작으로 인한 10분 자동 로그아웃 방지 루틴을 보존하십시오.
6. **네트워크 타임아웃 안전망**:
   - `AbortController` (4초)를 적용하여 소켓 누수를 차단하십시오.

---

## 🔒 4. 보안 및 인증 구현 규칙
1. **평문 비밀번호 노출 금지**:
   - 소스코드에 평문 비밀번호를 기재하지 마십시오. 반드시 **SHA-256 해시값**으로 비교해야 합니다.
2. **두벌식 한영 자동 정규화**:
   - 사용자가 한글 자판 상태로 입력하든, 영문 자판 상태로 오타를 내든 동일하게 인식할 수 있도록 `korToEng` 자판 디컴포지션 로직을 절대 훼손하지 마십시오.
3. **사용자 설정 로컬 격리**:
   - 텔레그램 토큰, 채팅 ID 등 개인정보는 외부 서버로 전송해서는 안 되며 오직 `localStorage`에만 보관해야 합니다.
