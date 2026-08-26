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

### 7. GitHub 저장소 공개 범위
**퍼블릭 저장소**로 한다. 코드에 개인정보 없음, API 키는 `.env`로 분리되어 커밋되지 않으므로 프라이빗일 이유가 없고, Cloudflare Pages Free 연동도 더 단순해짐.

## 작업 순서 (커밋 단위)

1. **scaffold** — Vite+React+TS, 디자인 토큰/폰트 이식, 라우팅 스켈레톤(`/t/:code`)
2. **schema** — Supabase 마이그레이션(trips/people/trip_members/budgets/entries/rates), RLS, 시드 — *Supabase 프로젝트 필요*
3. **trip-entry** — 여행 코드 진입, localStorage, 참여자 선택("누구세요")
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
