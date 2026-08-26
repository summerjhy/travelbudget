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

### 2. 정산 기능 — SPEC 12장 열린 결정 해소
별도의 "누가 누구에게 얼마" 정산 계산 로직은 넣지 않는다. 기존 화면(개인 결제 합계, per-member 표시)으로 충분하다고 판단. 정산이 필요해지면 여행 후 별도 요청으로 추가.

### 3. 텍스트 파싱 하이브리드 — SPEC 6-2 적용 시점
SPEC.md는 "정규식 우선, 실패한 줄만 Gemini로"를 원칙으로 명시하지만, Gemini 연동(Edge Function + API 키)은 **7단계(이미지 파싱)에서 텍스트 폴백과 함께 구현**한다. MVP(4단계)는 `preview.html`의 정규식 파서 로직만 이식하고, 파싱 실패 줄은 직접입력 폼으로 유도한다.

### 4. Supabase 인증
SPEC.md 원안대로 anon key를 클라이언트에 노출하고 RLS로 trip_code 일치를 강제한다 (Edge Function 경유 방식 아님). Edge Function은 Gemini 호출·환율 외부 API 호출처럼 시크릿 키가 필요한 경우에만 사용.

### 5. Gemini 할당량 초과 처리
분당 10회/일 1500회 초과로 Gemini 호출이 실패하면 재시도 로직 없이 즉시 에러를 반환하고, 사용자에게 "직접입력으로 전환" 안내만 띄운다.

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
