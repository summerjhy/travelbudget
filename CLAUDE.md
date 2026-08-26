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

### 6-2. 실시간 반영 — Realtime 대신 폴링 (SPEC 8장 변경)
SPEC 8장은 "Supabase Realtime 구독으로 다른 사람 입력이 즉시 반영"을 명시했지만, RLS를 `x-trip-code` 커스텀 헤더 기반(4-1)으로 설계한 결과 **Realtime(WebSocket) 구독에서는 이 RLS가 동작하지 않는다** — 브라우저의 WebSocket 핸드셰이크는 임의의 커스텀 헤더를 보내지 못하므로 `current_setting('request.headers')`가 항상 비어 정책이 거부된다(REST 요청에서는 정상 동작, Realtime에서만 실패). 이는 8단계에서 실제로 검증 시도하다 발견한 사실이다.

대안으로 Realtime 대신 짧은 간격(10~15초) 폴링으로 대체한다. REST 기반이라 기존 RLS를 그대로 쓸 수 있고, 친구 4명 규모에서는 체감상 "거의 즉시"로 충분하다. RLS를 JWT 기반으로 전면 재설계하는 방안은 검토했으나 2단계 스키마/인증 구조를 다시 바꿔야 하는 큰 변경이라 채택하지 않음.

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
- [x] 7. image-parsing (parse-image Edge Function: gemini-flash-latest 별칭, 여러 장 병렬 처리(Promise.allSettled), 503 1회 재시도, 429/기타 실패는 그 장만 null. 클라이언트 리사이즈(1600px/JPEG 0.8) + RecordTab 사진 업로드 UI. 실제 카드사 캡쳐로 정확도 검증 완료)
- [x] 8. pwa-offline (vite-plugin-pwa manifest+SW, 테마에 맞는 아이콘 신규 제작, IndexedDB 오프라인 큐(idb)로 entries insert/update/delete 큐잉, online 이벤트 시 자동 flush, 12초 폴링으로 Realtime 대체(6-2 참고). Playwright로 오프라인 저장→온라인 자동 동기화→중복 없음까지 검증 완료)
- [x] 9. share-target (Android Web Share Target Level 2 — POST/multipart/form-data/params.files로 manifest 구성, injectManifest 모드로 전환해 커스텀 SW(src/sw.ts)가 /share-target POST를 가로채 IndexedDB에 저장 후 리다이렉트, 클라이언트는 ?share-target=1을 감지해 자동으로 사진 분석 트리거. 설정 탭에 iOS/Android 홈 화면 설치 + 캡쳐 공유 방식 차이 안내 추가. Playwright로 SW 라우트 응답/IndexedDB 저장/자동 분석 트리거까지 검증 완료. 단, 실제 안드로이드 OS 공유 시트 자체는 브라우저 자동화로 재현 불가하므로 실기기 테스트 필요)
- [x] 10. deploy (GitHub 퍼블릭 저장소 https://github.com/summerjhy/travelbudget 생성 및 푸시. Cloudflare Pages 연동 및 배포 성공: https://travelbudget-dgv.pages.dev/ — 실제 프로덕션에서 코드입력→Supabase 조회→이름입력까지 Playwright로 검증 완료. GitHub Actions 핑 워크플로 추가. **10단계 전체 완료**)
- [x] 11. (10단계 이후 추가) create-trip UI — 배포 직후 "실제 사용자가 새 여행을 만들 화면이 없다"는 것을 뒤늦게 발견. CodeGate에 "관리자이신가요? 새 여행 만들기" 링크를 추가하고, 관리자 비밀번호+코드+이름+시작일/종료일+목적지(복수, 칩 추가/삭제)+통화(복수, 칩 토글) 입력 폼(`CreateTripForm`)을 만들어 기존 `create-trip` Edge Function과 연결했다. 생성 성공 시 자동으로 `connectTrip`을 호출해 곧바로 그 여행으로 진입한다. Playwright로 잘못된 비밀번호 거부와 정상 생성(목적지/통화 복수 저장 확인) 둘 다 검증 완료.

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

### 7단계에서 확정된 구현 세부사항
- **모델**: `GEMINI_MODEL` 환경변수로 override 가능, 기본값은 `gemini-flash-latest` — Google 공식 별칭으로 항상 최신 Flash 계열로 자동 전환되어 무료 티어("Flash/Flash-Lite만 무료") 조건과 모델 폐기 주기를 코드 수정 없이 계속 만족시킨다.
- **응답 시간**: Gemini 호출은 실측 30~40초/장 걸린다. 이는 모델 자체의 지연이라 코드로 줄일 수 없다.
- **503 vs 429 처리 분리**: 503(일시적 과부하, 실측 3번 중 1번꼴로 발생)은 2초 대기 후 1회만 재시도한다. 429(할당량 초과)는 재시도하지 않고 그 사진만 실패(`null`) 처리한다 — SPEC 5번 방침("즉시 에러, 재시도 없음")은 429에만 적용되고 503에는 적용하지 않기로 사용자와 합의.
- **여러 장 처리 방식**: 순차가 아니라 `Promise.allSettled`로 병렬 전송한다. 사진 5장을 순차로 하면 5×35초가 걸리지만 병렬이면 가장 느린 한 장 시간(+503 재시도 시 최대 +2초)만큼만 걸린다. 실측: 3장 순차 대비 병렬이 약 40% 단축(105초→60초). 한 장이 429/503/파싱실패로 null이 나와도 다른 장의 결과는 그대로 유지된다(요구사항: "그 사진만 실패, 나머지는 계속 진행").
- **디버깅 교훈**: Edge Function 응답이 `results: [null]`로 오는 게 항상 버그는 아니다 — `function_logs`(콘솔 로그, `function_edge_logs`와 다른 소스)를 봐야 Gemini의 실제 503/429 원인 메시지가 보인다. curl/스크립트로 같은 요청을 반복하면 재현되지 않을 수 있다(비결정적 서비스 상태이므로 3회 이상 반복 테스트로 확인할 것).
- `prompt.ts`의 시스템 프롬프트는 카드번호/계좌번호를 응답에 절대 포함하지 말라는 지침을 명시하고, Edge Function은 이미지를 저장하지 않고 파싱 후 즉시 폐기한다(SPEC 6-1 준수). 실제 하나은행 UPI 해외결제 캡쳐로 가맹점명/원화/외화/통화 4개 필드 모두 정확히 추출됨을 확인(카드번호는 응답에 없음).

### 8단계에서 확정된 구현 세부사항
- **아이콘 신규 제작**: create-vite 기본 템플릿의 보라색 아이콘은 프로젝트 테마와 무관해 `--jade`/`--marigold` 색상을 쓴 카드 모양 아이콘을 SVG로 새로 그리고 sharp로 192/512/512(maskable)/apple-touch-icon PNG를 생성했다. `favicon.svg`도 교체.
- **Realtime → 폴링 전환 (6-2 참고)**: `x-trip-code` 커스텀 헤더 RLS가 WebSocket에서는 동작하지 않아 Realtime을 포기하고 `usePolling`(12초 간격, 탭이 보이고 온라인일 때만)으로 대체했다. `TripLayout`/`RecordTab`/`HistoryTab`이 각자 독립적으로 폴링하는 중복이 있지만, 동시접속 4명 규모에서는 무료 티어 대역폭(월 5GB)에 전혀 부담이 안 되어 그대로 둔다(리팩터링은 나중에 필요해지면).
- **오프라인 감지의 함정**: supabase-js는 네트워크가 끊겨도 throw하지 않고 `{data: null, error}`로 정상 반환한다 — `try/catch`만으로는 오프라인을 감지할 수 없다. `isNetworkError()`가 `navigator.onLine`과 에러 메시지(`failed to fetch` 등)를 함께 봐서 판단한다. 이 함정 때문에 처음 구현에서는 오프라인 저장이 전부 "저장에 실패했어요"로 잘못 처리됐었다.
- **오프라인 시 환율 처리**: 캐시에 없는 새 날짜를 오프라인에서 입력하면 `fetch-rate` 호출이 실패하므로, `latestRate(ratesByDate)`(가장 최근 캐시값)를 임시로 적용해 저장은 막지 않는다. 온라인 복귀 후 정확한 환율이 필요하면 내역 탭에서 재조정 가능.
- **로컬id → 서버id 문제**: 오프라인 큐 항목은 `crypto.randomUUID()`로 임시 로컬id를 부여하는데, 온라인 동기화 후 서버가 새 id를 발급하므로 둘이 일치하지 않는다. "이번 사용금액" 카드는 저장 시점의 id 목록만 들고 있다가 `entries`에서 그때그때 찾아 렌더링하는 방식으로 단순화했다 — 동기화되면 로컬id를 못 찾아 카드가 조용히 사라진다(의도된 동작, 별도 매핑 테이블 없음).
- **폴링/오프라인 동기화 후 pending 중복 집계 버그**: `useEntries.refresh()`가 기본적으로 로컬 pending 항목을 유지하는데, 오프라인 큐를 전부 flush한 직후에도 이 로직을 그대로 쓰면 서버 데이터(방금 반영됨)와 로컬 pending이 이중 집계된다. `refresh({ clearPending: true })` 옵션을 추가해 `useOfflineSync`가 큐를 전부 비웠을 때만 pending을 버리도록 구분했다.

### 9단계에서 확정된 구현 세부사항
- **generateSW → injectManifest 전환**: 8단계까지는 `vite-plugin-pwa`의 기본 `generateSW` 모드(워크박스 설정을 선언만 하면 SW를 자동 생성)를 썼지만, share target은 `/share-target` POST 요청을 직접 가로채 IndexedDB에 쓰는 커스텀 fetch 핸들러가 필요해 `strategies: 'injectManifest'` + `src/sw.ts`(직접 작성한 서비스워커)로 전환했다. 8단계에서 `workbox.runtimeCaching`으로 선언했던 REST/폰트 캐싱 정책은 `injectManifest`에서는 자동 생성되지 않으므로 `src/sw.ts`에 `registerRoute`로 직접 옮겨 적었다.
- **manifest `share_target`은 파일 공유 형식이어야 한다**: 처음에는 `method: 'GET'` + `params.{title,text}`(텍스트 공유용)로 잘못 선언했었다. SPEC이 요구하는 건 스크린샷(이미지) 공유이므로 `method: 'POST'`, `enctype: 'multipart/form-data'`, `params.files: [{name, accept}]`가 필요하다(Web Share Target API Level 2).
- **로컬id와 마찬가지로 파일 전달도 IndexedDB를 거친다**: 서비스워커의 fetch 핸들러는 응답으로 값을 반환할 뿐 클라이언트 JS 컨텍스트와 직접 통신할 수 없으므로, 받은 File들을 `travelbudget-share`라는 별도 IndexedDB(오프라인 큐와는 다른 DB)에 `pending` 키로 저장하고 `/?share-target=1`로 303 리다이렉트한다. React 앱은 마운트 시 이 쿼리 파라미터를 보고 `consumeSharedFiles()`로 꺼낸 뒤 즉시 `history.replaceState`로 URL을 정리하고 `RecordTab`의 사진 분석 파이프라인(`processPhotos`)에 그대로 흘려보낸다.
- **테스트 한계**: 실제 안드로이드 공유 시트(다른 앱에서 "공유" 버튼 → 앱 목록에 이 PWA가 뜨는 것)는 OS 레벨 통합이라 헤드리스 브라우저 자동화로 재현할 수 없다. 대신 `<form method=POST enctype=multipart/form-data>` 제출로 실제 공유가 발생시키는 것과 동일한 요청을 만들어 SW 라우트→IndexedDB 저장→클라이언트 자동 트리거까지의 배관을 검증했다. 실기기(설치된 PWA에서 실제 공유 시트 사용)로 최종 확인이 필요하다.

### 10단계에서 확정된 구현 세부사항 — Cloudflare Pages 배포 시행착오
- **GitHub CLI 설치/인증**: 이 개발 환경에 `gh`가 없어 `winget install GitHub.cli`로 설치하고, 브라우저 로그인이 불가능한 비대화형 세션이라 `gh auth login --web`의 디바이스 코드 플로우(사용자가 https://github.com/login/device 에서 코드 입력)로 인증했다. 첫 로그인은 `repo` 스코프만 받았는데, `.github/workflows/*.yml` 파일을 푸시하려면 `workflow` 스코프가 별도로 필요해 `gh auth refresh -s workflow`로 한 번 더 디바이스 코드 인증을 거쳤다.
- **로컬 브랜치명 master → main으로 통일**: GitHub 기본값과 맞추기 위해 `git branch -m master main` 후 푸시.
- **Cloudflare Pages의 "Deploy command"는 최신 UI의 함정이다**: Cloudflare가 Workers/Pages를 통합하면서, Git 연동으로 새 프로젝트를 만들면 "Create a Worker" 흐름을 타고 Deploy command에 `npx wrangler deploy`(Workers용 명령)가 기본값으로 들어간다. 정적 SPA인 이 프로젝트에는 맞지 않아 `npx wrangler pages deploy dist --project-name=travelbudget`로 고쳐야 했다(프로젝트명 인자 없이 `wrangler pages deploy dist`만 쓰면 비대화형 CI에서 "Missing Pages project name" 에러가 남).
- **그래도 실패한다면 애초에 리소스 타입이 잘못 만들어진 것이다**: Deploy command를 고쳐도 "API 토큰 인증 오류(code 10000)"와 "The Pages project does not exist" 에러가 연달아 났다. 근본 원인은 Cloudflare가 Git 연동 시 이 프로젝트 자체를 **Workers 타입 리소스**로 생성해버린 것 — Pages 프로젝트가 애초에 존재하지 않으니 `wrangler pages deploy`가 아무리 정확해도 실패한다. **해결책은 설정을 고치는 게 아니라 프로젝트를 삭제하고 Workers & Pages 생성 화면에서 명시적으로 "Pages" 탭(Workers 탭이 아니라)을 선택해 처음부터 다시 만드는 것**이었다. 순수 Pages로 만들면 Deploy command 입력란 자체가 없거나 불필요해진다.
- **최종 배포 URL**: https://travelbudget-dgv.pages.dev/ — Cloudflare가 자동 생성한 `<project-name>-<random>.pages.dev` 형식. 커스텀 도메인 연결은 하지 않음(여행 중 임시 사용 목적이라 불필요 판단).

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

4단계까지 MVP. 여행 전(2026-09-03) 목표는 7단계까지였으나, **2026-08-27 기준 1~10단계 전부 완료 및 배포까지 마침** (https://travelbudget-dgv.pages.dev/). 여행 전까지 남은 기간은 실기기(iOS/Android) 테스트, 참여자 4명 온보딩, 실제 결제 캡쳐로 파싱 정확도 재검증에 활용.

## 사용자 외부 작업 체크리스트

- [x] GitHub 퍼블릭 저장소 생성 — https://github.com/summerjhy/travelbudget
- [x] Supabase 프로젝트 생성, URL/anon key 발급 — travel_budget_summer (qyufjajkgttffilluygm)
- [x] Gemini API 키 발급 — Google AI Studio, Edge Function 시크릿으로 등록 완료
- [x] Cloudflare 계정 + Pages↔GitHub 연동 — https://travelbudget-dgv.pages.dev/ 배포 완료
- [x] 실제 카드사 해외결제 캡쳐 샘플 준비 — 하나은행 UPI 캡쳐로 파싱 정확도 검증 완료(7단계)
- [ ] GitHub Actions Secrets에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록 — supabase-ping.yml 워크플로 동작에 필요 (저장소 Settings → Secrets and variables → Actions)
- [ ] 친구들에게 여행 코드(`20260903`) 공유 — 배포 후 리허설
- [ ] 실기기(iOS Safari, Android Chrome) 홈 화면 설치 테스트
- [ ] 실기기 Android에서 실제 공유 시트로 카드 캡쳐 → 이 앱 자동 분석 테스트 (9단계, 헤드리스 환경에서 검증 불가했던 부분)

## 코딩 컨벤션
- 커밋은 위 10단계와 1:1 대응시키되, 각 단계 내에서도 논리적으로 쪼갤 수 있으면 쪼갠다.
- `preview.html`은 참고용 프로토타입으로 유지하고 실제 구현에서 import하지 않는다. 디자인 토큰(CSS 변수)과 파싱 정규식 로직만 그대로 가져와 React 컴포넌트/TS 모듈로 재작성한다.
- 금액 표시는 항상 `숫자元 · ₩숫자` 형태 병기, `font-variant-numeric: tabular-nums` 유지.
