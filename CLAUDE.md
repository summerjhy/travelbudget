# 여행 가계부 PWA — 작업 컨텍스트

> 전체 스펙은 [SPEC.md](SPEC.md), 디자인/화면 레퍼런스는 [preview.html](preview.html) 참고.
> 이 파일은 SPEC.md 확정 이후 논의를 통해 바뀌거나 구체화된 결정사항을 기록한다. SPEC.md와 이 파일이 충돌하면 이 파일이 우선한다.

## 여행 정보
- 2026-09-03 시작, 상하이. 친구 4명 (소영/민정/유리/혜연) — 단, 하드코딩 아님, 아래 멤버 구조 참고.

## 확정된 설계 결정 (SPEC.md 대비 변경/구체화)

### 1. 멤버 구조 — SPEC 4장 데이터 모델 변경
SPEC.md의 `members`(trip 1:N)를 다음으로 대체한다:

```sql
-- people (전역, 여행에 종속되지 않는 사람 마스터)
id    uuid pk
name  text not null
created_at timestamptz

-- trip_members (여행별 참여 조인 테이블)
id         uuid pk
trip_id    uuid fk -> trips
person_id  uuid fk -> people
active     boolean not null default true   -- 소프트 삭제. false면 그 여행에서 비활성
sort       int
created_at timestamptz

-- entries.member_id는 trip_members.id를 참조 (people.id 아님)
```

이유: 같은 사람이 여러 여행에 재사용되고, 여행마다 참여 여부가 달라질 수 있음(예: A가 상하이는 빠지고 도쿄는 참여). `trip_members.active=false`로 비활성화하되 기존 entries 참조 무결성을 위해 하드 삭제는 하지 않는다.

설정 탭에서 멤버 추가/이름수정/비활성화(소프트 삭제)가 가능해야 한다. 하드코딩 금지.

**참여자 등록 흐름**: 여행은 관리자(본인)만 생성(4-1, 5-1 참고)하지만, 참여자는 사전 등록 없이 **코드를 입력해 접속한 사람이면 누구나** 참여 가능하다. 최초 접속 시 "누구세용 (이름 입력해주세요)" 입력창에서 본인이 직접 이름을 타이핑한다 (10자 이하 제한). 이 이름으로 `people`에 upsert(같은 이름이 이미 그 여행의 `trip_members`에 있으면 재사용, 없으면 새로 생성)하고 `trip_members`에 연결한다. 즉 설정 탭의 "멤버 편집"은 관리자가 오탈자를 고치거나 비활성화하는 보조 수단이지, 참여자 등록의 주 경로가 아니다.

### 2. 정산 기능 — SPEC 12장 열린 결정 해소
별도의 "누가 누구에게 얼마" 정산 계산 로직은 넣지 않는다. 기존 화면(개인 결제 합계, per-member 표시)으로 충분하다고 판단. 정산이 필요해지면 여행 후 별도 요청으로 추가.

### 3. 텍스트 파싱 하이브리드 — SPEC 6-2 적용 시점
SPEC.md는 "정규식 우선, 실패한 줄만 Gemini로"를 원칙으로 명시하지만, Gemini 연동(Edge Function + API 키)은 **7단계(이미지 파싱)에서 텍스트 폴백과 함께 구현**한다. MVP(4단계)는 `preview.html`의 정규식 파서 로직만 이식하고, 파싱 실패 줄은 직접입력 폼으로 유도한다.

### 4. Supabase 인증
SPEC.md 원안대로 anon key를 클라이언트에 노출하고 RLS로 trip_code 일치를 강제한다 (Edge Function 경유 방식 아님). Edge Function은 Gemini 호출·환율 외부 API 호출처럼 시크릿 키가 필요한 경우에만 사용.

### 4-1. 여행 코드 발급/진입 방식 — SPEC 3장 변경
SPEC.md 원안은 "8~10자 랜덤 코드를 시스템이 자동 발급 + URL 링크 공유"였지만, 다음으로 변경한다:

- **코드는 관리자(여행 생성자, 본인)가 직접 지정**하는 숫자 8자리. 랜덤 자동생성 아님.
- 참여자는 **링크가 아니라 코드를 앱에 직접 입력**해서 접속한다 (`/t/:code` 라우팅 자체는 유지하되, 기본 진입 경로는 코드 입력 폼).
- 최초 입력 성공 시 `localStorage`에 저장하여 이후 재방문 시 입력 화면을 건너뛰고 바로 해당 여행으로 진입한다 (참여자 이름 선택도 동일하게 localStorage 캐시).
- **여행 전환**: 설정 탭에 "다른 여행 코드로 전환" 메뉴를 둔다. 누르면 새 코드 입력 화면이 뜨고, 성공하면 localStorage의 코드를 교체한다. 기존 코드는 버리지 않고 다시 입력하면 그 여행으로 복귀 가능(즉 코드 자체는 서버에 남아있고 클라이언트가 "현재 보고 있는 코드"만 스위칭하는 개념).
- RLS 검증 방식: 클라이언트가 매 요청 시 `trip_code`를 알고 있다는 것 자체가 접근 권한이므로, RLS policy는 각 테이블의 `trip_id`로 `trips`를 join해 `trips.code = 요청이 지정한 코드`를 확인하는 함수 기반 조건으로 작성한다(3단계에서 구체 SQL 확정).

### 5. Gemini 할당량 초과 처리
분당 10회/일 1500회 초과로 Gemini 호출이 실패하면 재시도 로직 없이 즉시 에러를 반환하고, 사용자에게 "직접입력으로 전환" 안내만 띄운다.

### 5-1. 여행 생성 권한 — Edge Function을 2단계로 당김
"여행 생성은 나(관리자)만 할 수 있어야 한다"는 요구사항이 있다. 로그인이 없으므로 DB 레벨에서 역할 구분이 불가능해, 다음으로 처리한다:

- `trips` 테이블은 RLS에 INSERT 정책이 없다(anon/authenticated 모두 불가). 오직 `service_role`만 INSERT 가능.
- `create-trip` Edge Function을 두고, 요청 바디의 관리자 비밀번호가 환경변수 `ADMIN_PASSWORD`와 일치할 때만 `service_role` 클라이언트로 `trips`(+필요 시 `people`/`trip_members`/`budgets` 초기값)를 생성한다.
- 원래 계획(CLAUDE.md 작업 순서)은 Edge Function을 6~7단계에서 도입할 예정이었지만, 이 기능 때문에 **2단계(schema)에서 최소 Edge Function 인프라(`supabase/functions/create-trip`)를 미리 구축**한다. 6~7단계의 환율/Gemini Edge Function은 이 인프라를 재사용한다.
- `ADMIN_PASSWORD`는 Supabase 프로젝트의 Edge Function 시크릿으로 등록한다(`supabase secrets set`). 클라이언트 코드/`.env`(`VITE_` 접두사)에는 절대 두지 않는다.

### 6. 오프라인 큐 범위
IndexedDB 큐잉 + 온라인 복귀 동기화는 **8단계에서만** 구현한다. 1~7단계는 온라인 연결을 전제로 동작해도 된다.

### 6-1. 환율 계산 — 4단계(MVP) 범위 제한
SPEC 5장의 5단계 우선순위 중 4번(외부 API 자동 조회)은 6단계(fx-rates, Edge Function) 몫이다. 4단계(mvp-record)에서는 다음만 구현한다:

1. 위안·원화 둘 다 입력된 경우 → `rate = krw / cny` 역산
2. 하나만 입력된 경우 → `rates` 테이블에 그 날짜 값이 있으면 재사용
3. `rates`에도 없으면 → 자동 계산 불가. 저장 미리보기에서 두 금액 중 하나를 직접 채우도록 안내(둘 다 없으면 저장 차단)

외부 API 조회(frankfurter.app 등)와 "조회 실패 시 최근 저장값 폴백"은 6단계에서 추가한다. 즉 4단계 시점에는 관리자가 설정 탭에서 환율을 최소 1회 수동 입력해둬야 자동 환산이 동작한다(설정 탭 환율 입력 UI는 5~6단계에서 완성, 4단계는 rates 테이블에 직접 seed하거나 두 금액을 모두 입력하는 것으로 우회 가능).

### 7. GitHub 저장소 공개 범위
**퍼블릭 저장소**로 한다. 코드에 개인정보 없음, API 키는 `.env`로 분리되어 커밋되지 않으므로 프라이빗일 이유가 없고, Cloudflare Pages Free 연동도 더 단순해짐.

## 진행 상황

- [x] 1. scaffold
- [x] 2. schema (trips/people/trip_members/budgets/entries/rates + RLS + create-trip Edge Function 완료, 실제 프로젝트에 적용 및 curl 검증 완료)
- [x] 3. trip-entry (코드 입력 → 이름 입력 → localStorage 캐시 → 재방문 자동 진입 → 설정 탭 "다른 여행 코드로 전환" 모두 Playwright로 검증 완료)
- [x] 4. mvp-record (텍스트 파싱 → 편집 가능 미리보기 → 저장 → 이번 사용금액/공금외 누적/잔여예산 표시. **MVP 최소 사용 가능 지점 도달**. Playwright로 전체 흐름 검증 완료)
- [x] 5. history-tab (합계 박스, 카테고리/사람 필터, 날짜별 그룹핑, 인라인 편집·삭제. Playwright로 편집/삭제 후 합계 재계산까지 검증 완료)
- [x] 6. fx-rates (fetch-rate Edge Function: frankfurter.app→open.er-api.com 폴백→최근값 폴백. 설정 탭 환율 목록/직접입력/지금조회, 예산 추가/삭제 UI. RecordTab 저장 시 캐시에 없는 날짜 자동 조회. Playwright + curl로 캐시/외부조회/CORS/직접입력 우선순위까지 전부 검증 완료)
- [ ] 6. fx-rates
- [ ] 7. image-parsing
- [ ] 8. pwa-offline
- [ ] 9. share-target
- [ ] 10. deploy

### 3단계에서 확정된 구현 세부사항
- `src/lib/supabase.ts`: `setTripCode()`로 모듈 레벨 변수를 갱신하면 `global.fetch` 래퍼가 매 요청에 `x-trip-code` 헤더를 붙인다.
- `src/context/TripContext.tsx`: 여행 로드, 참여자 이름 등록(people upsert + trip_members insert), 코드 전환을 담당하는 단일 컨텍스트.
- `people` 테이블은 RLS select도 열려있다(`people_select_open`, 마이그레이션 0002). 최초 등록 시 `.insert().select()`가 자기 자신을 못 읽어 401이 나는 문제를 select 정책 완화로 해결했다 — INSERT가 이미 열려있어 select만 막는 것은 실질적 보안 이득이 없다는 판단.
- URL 라우팅은 `/t/:code`를 쓰지 않는다. 코드는 폼 입력으로만 받는다 (4-1 참고). React Router는 여행 내부 탭 전환(`/`, `/history`, `/settings`)에만 쓰인다.

### 4단계에서 확정된 구현 세부사항
- `src/lib/parser.ts`, `src/lib/categories.ts`: preview.html의 `parseLine`/`guessCat`을 그대로 이식. 멤버 이름은 하드코딩 대신 `useTripMembers`로 조회한 활성 멤버 목록을 파라미터로 받는다.
- `src/lib/rates.ts`의 `resolveAmount`: 6-1에서 정한 대로 위안·원화 둘 다 입력 시 역산, 하나만 있으면 `rates` 캐시 조회까지만 하고 외부 API 호출은 하지 않는다. 캐시에도 없으면 `rate: null`을 반환하고 저장을 막는다.
- 데이터 접근은 `useTripMembers`/`useRates`/`useEntries`/`useBudgets` 훅으로 분리했다. 각자 `tripId`를 받아 독립적으로 조회하고, 화면(`RecordTab`, `TripLayout`)에서 조합해서 쓴다. `TripContext`는 세션(코드/이름/멤버 신원)만 담당하고 지출 데이터는 갖지 않는다.
- `src/lib/totals.ts`의 `computeTotals`: preview.html의 `totals()` 함수를 그대로 이식. 공금은 `member_id === null`인 entries, 개인 결제는 `trip_members.id` 기준으로 집계.

### 5단계에서 확정된 구현 세부사항
- `HistoryTab`의 카테고리/사람 필터는 SPEC 7장 요구사항이지만 preview.html 프로토타입엔 없던 기능이라 새로 설계해 추가했다. 사람 필터의 `null`은 "공금"을, `'ALL'`은 필터 없음을 의미하는 3상태(`string | null | 'ALL'`).
- 인라인 편집은 preview.html의 `editCard()`를 그대로 이식(제목/위안/원화/결제자 칩/날짜/삭제/취소/저장). 저장 시 `resolveAmount`로 재계산하므로 위안·원화 중 하나만 바꿔도 다른 쪽이 환율로 자동 갱신된다.

### 6단계에서 확정된 구현 세부사항
- `supabase/functions/fetch-rate`: `rates` 캐시 → frankfurter.app(해당 날짜) → open.er-api.com(최신값만) → 가장 최근 저장값 순으로 폴백. 클라이언트는 `x-trip-code` 헤더로 자기 여행인지 검증받는다(anon key로 직접 호출, service_role은 함수 내부에서만 사용).
- **CORS 이슈와 해결**: Edge Function 최초 배포판에 CORS 헤더가 없어 브라우저에서 preflight(OPTIONS)가 막혀 `fetchNow` 호출이 전부 조용히 실패했다(try/catch가 삼켜서 에러 UI 없이 그냥 환산 안 된 채 넘어감). `supabase/functions/_shared/cors.ts`에 공통 헤더를 두고 모든 Edge Function이 OPTIONS를 처리하고 응답에 `Access-Control-Allow-*`를 붙이도록 고쳤다. **새 Edge Function을 추가할 때마다 이 패턴을 빠뜨리지 말 것.**
- `.env`의 `VITE_SUPABASE_URL`은 끝에 슬래시를 붙이면 안 된다(`.../v1/fetch-rate` 대신 `...//v1/fetch-rate`가 되어버림). `src/lib/fetchRate.ts`에서 방어적으로 trailing slash를 제거하지만, `.env` 자체도 슬래시 없이 저장해야 한다.
- `RecordTab.handleSave`는 저장 전에 필요한 날짜 중 `ratesByDate`에 없는 것만 골라 `fetchNow`로 순차 자동 조회한 뒤 계산한다. 4단계 시점의 "환율 없으면 저장 차단" 제약(6-1)은 이 단계에서 해제됨.
- 설정 탭에 예산 추가/삭제 UI(`useBudgets`)와 환율 목록/직접입력/지금조회 UI를 함께 완성했다. 직접 입력이 외부 조회값을 덮어쓸 수 있다(SPEC 5장 우선순위 3번, "직접 적으면 그 값이 우선").

## 작업 순서 (커밋 단위)

1. **scaffold** — Vite+React+TS, 디자인 토큰/폰트 이식, 라우팅 스켈레톤
2. **schema** — Supabase 마이그레이션(trips/people/trip_members/budgets/entries/rates), RLS, create-trip Edge Function — *Supabase 프로젝트 필요*
3. **trip-entry** — 여행 코드 진입, localStorage, 참여자 이름 직접 입력
4. **mvp-record** — 정규식 텍스트 파서 + 편집 가능 미리보기 + 저장 (**MVP 최소 사용 가능 지점**)
5. **history-tab** — 내역 탭, 인라인 편집, 필터
6. **fx-rates** — 환율 우선순위 로직 + Edge Function 외부 API 조회 + 캐시
7. **image-parsing** — Gemini 이미지 파싱 Edge Function + 사진 UI + 텍스트 Gemini 폴백 — *Gemini API 키 필요*
8. **pwa-offline** — manifest, Service Worker, IndexedDB 큐, Realtime 구독
9. **share-target** — Android Web Share Target, iOS 안내
10. **deploy** — GitHub 퍼블릭 저장소, Cloudflare Pages 연동, GitHub Actions 핑 워크플로

4단계까지 MVP. 여행 전(2026-09-03) 목표는 7단계까지.

## 사용자 외부 작업 체크리스트

- [ ] GitHub 퍼블릭 저장소 생성 (1단계)
- [ ] Supabase 프로젝트 생성, URL/anon key 발급 (2단계 시작 전 필수)
- [ ] Gemini API 키 발급 — Google AI Studio (7단계 시작 전 필수)
- [ ] Cloudflare 계정 + Pages↔GitHub 연동 (10단계, 미리 해둬도 무방)
- [ ] 실제 카드사 해외결제 캡쳐 샘플 준비 (7단계 테스트용)
- [ ] 친구들에게 여행 코드 링크 공유 (배포 후 리허설)

## 코딩 컨벤션
- 커밋은 위 10단계와 1:1 대응시키되, 각 단계 내에서도 논리적으로 쪼갤 수 있으면 쪼갠다.
- `preview.html`은 참고용 프로토타입으로 유지하고 실제 구현에서 import하지 않는다. 디자인 토큰(CSS 변수)과 파싱 정규식 로직만 그대로 가져와 React 컴포넌트/TS 모듈로 재작성한다.
- 금액 표시는 항상 `숫자元 · ₩숫자` 형태 병기, `font-variant-numeric: tabular-nums` 유지.
