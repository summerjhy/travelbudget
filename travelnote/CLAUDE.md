# 비밀친구 관찰일지 (travelnote) — 작업 컨텍스트

여행 가계부(`travelbudget`, 저장소 루트)와 같은 저장소·같은 Supabase 프로젝트를 공유하지만 **완전히 독립된 앱**이다. 코드/세션/DB 테이블 전부 별도 네임스페이스(`journal_` 접두사, `x-note-code`/`x-member-id` 헤더)를 쓴다.

## 컨셉

여행 시작 시 참여자끼리 서로 모르게 비밀친구(마니또)를 제비뽑기하고, 여행 내내 자기 비밀친구를 관찰한 메모를 시간 기록과 함께 수시로 남긴다. 마지막 날 자기 비밀친구에게 모아둔 관찰일지를 전달한다(앱 내 전달 + 카톡 공유용 텍스트).

## 확정된 설계 결정

1. **저장소/DB**: `travelbudget/travelnote/` 안의 독립 앱. Supabase는 같은 프로젝트(`travel_budget_summer`)를 공유하되 테이블은 `journal_*`로 분리. 가계부의 `trips`/`people`/`entries` 등은 전혀 참조하지 않는다.
2. **진입 방식**: 가계부와 독립된 자체 8자리 코드 체계로 새로 진입. 같은 사람이어도 이름을 다시 입력한다.
3. **마니또 매칭**: 관리자가 버튼으로 수동 트리거. 더랑주먼트(자기 자신 제외 순환 순열, 무작위 순열 재시도 방식)를 `run-journal-matching` Edge Function이 service_role로 계산 — 클라이언트는 절대 매칭 결과를 만들거나 볼 수 없다.
4. **비밀 보장의 핵심 (RLS)**: `journal_secret_pairs`는 `observer_member_id = current_member_id()`(요청 헤더 `x-member-id`)일 때만 select 허용. `target_member_id` 기준 역방향 조회 정책은 아예 존재하지 않아 "누가 나를 관찰하는지"는 어떤 방법으로도 조회 불가능 — 실제 curl로 위조 시도까지 검증 완료(다른 사람 행세를 해도 자기 관찰 대상 외엔 절대 안 보임).
5. **관찰 대상 표시**: 이름 숨김, 익명 표시만("비밀친구를 관찰중이에요 👀").
6. **리마인더**: pg_cron(`journal-reminders`, 매분) + `send-journal-reminders` Edge Function. 앱이 완전히 종료된 상태에서도 정확한 시각에 와야 해서 클라이언트 setTimeout이 아니라 서버가 시각(Asia/Seoul 기준)을 체크해 발송한다. VAPID 키는 가계부 것 재사용, 발송 로직은 새 함수. 실제로 pg_cron이 1분마다 자동 호출해 `last_sent_at`을 갱신하는 것까지 프로덕션에서 확인했다.
7. **마지막날 발송**: `deliver-journal` Edge Function이 메모 전체를 시간순 텍스트로 조합해 `journal_deliveries`에 스냅샷 저장(이후 원본 메모를 고쳐도 이미 보낸 내용은 안 바뀜) + target에게 "비밀친구가 보냈어요" 푸시. 재요청해도 재발송하지 않고 그때 스냅샷을 그대로 돌려준다(`alreadyDelivered: true`) — 두 번 눌러도 알림이 중복 발송되지 않는다.
8. **발송 상태의 클라이언트 유지 문제**: `journal_deliveries`는 RLS가 `target_member_id` 기준으로만 select를 허용해서(받는 사람만 보이게 하려는 의도적 설계) 발송한 사람 자신은 이 테이블에서 자기가 보낸 걸 다시 못 읽는다. `DeliverTab`이 새로고침하면 "발송 전" 화면으로 돌아가버리는 버그가 있었는데, `deliver-journal`이 이미 보낸 경우 부작용 없이 그 텍스트를 돌려주는 걸 이용해 마운트 시 한 번 호출해 복원하는 방식으로 해결했다.
9. **오프라인 큐**: 가계부는 8단계에서야 넣었지만, 관찰일지는 메모를 수시로 남기는 용도라 **처음부터** idb 기반 오프라인 큐(`offlineQueue.ts`/`useOfflineSync.ts`)를 포함했다. 실제로 오프라인 저장 → 온라인 복귀 자동 동기화 → 서버 반영까지 Playwright(`context.setOffline`)로 검증 완료.
10. **텍스트 공유**: 가계부 15단계에서 배운 교훈(`.txt` 파일 공유는 카톡이 인코딩을 잘못 짐작해 깨짐) 그대로 적용 — `shareText.ts`는 파일 없이 `navigator.share({text})`만 시도하고 실패 시 클립보드로 폴백한다.
11. **디자인**: `.design/sample/` 레퍼런스(손그림일기 프로토타입, 토끼+다람쥐 캐릭터) 기반 크림 배경 + 코랄/파스텔블루/옐로우 톤. 가계부의 `--jade`/`--marigold` 토큰과는 완전히 별도의 CSS 변수 세트(`src/index.css`). 폰트는 `Gaegu`(타이틀)+`Gowun Dodum`(본문).
12. **관리자 인증**: 가계부와 동일 패턴(비밀번호는 메모리에만, `AdminGate`→`AdminMenu`→만들기/둘러보기/관리하기). 숨은 관리자 진입 코드는 가계부와 다른 값(`93529375`)을 쓴다 — 두 앱은 독립된 코드 체계라 겹치면 안 된다.

## RLS 검증 이력 (실제 프로덕션에서 curl로 확인)

- 헤더 없이 `journal_trips` 조회 → 빈 배열
- `x-note-code`만 있으면 그 여행/멤버 목록 조회 가능
- `x-member-id`로 본인 인증 시 `journal_secret_pairs`에서 **내가 관찰하는 대상만** 보이고, `target_member_id=eq.내ID`로 필터링해 역방향을 캐려는 시도는 항상 빈 결과
- `journal_notes` insert 시 `author_member_id`를 남으로 위조하면 `42501`(RLS 위반)으로 정확히 거부
- `journal_deliveries`는 발송한 사람은 못 보고 받는 사람만 조회 가능
- `admin-journal`/`run-journal-matching`/`create-journal-trip`은 틀린 비밀번호에 전부 401

## 알려진 함정 (재발 방지용)

- **`journal_people` select 정책 함정**: 최초 등록 시 `.insert().select()`가 방금 만든 자기 자신을 못 읽어 401이 났다. 원인은 `journal_trip_members` 연결이 아직 없는 시점이라 트립 경유 select 정책을 통과 못하는 것 — 가계부가 3단계에서 이미 겪은 문제(`0002_people_select_open.sql`)와 정확히 같은 함정이다. `insert`가 이미 열려있으면(`with check (true)`) `select`만 막는 건 실질적 보안 이득이 없으므로 함께 열었다(`0015_journal_people_select_open.sql`).
- **테이블 생성 순서**: `journal_people`의 select 정책이 `journal_trip_members`를 참조하는데 마이그레이션 안에서 테이블+정책을 한 번에 순서대로 작성하면 아직 안 만들어진 테이블을 참조해 실패한다. 테이블 전부를 먼저 만들고(`0013` 전반부) RLS 정책은 별도 스텝으로 나중에 붙이는 순서로 적용해야 한다.
- **pg_cron 스케줄은 삭제하면 안 된다**: 테스트 데이터 정리 중 실수로 `cron.unschedule`을 했다가, 이건 테스트 데이터가 아니라 실제 리마인더 프로덕션 인프라라는 걸 깨닫고 즉시 재등록했다. 정리 대상은 `journal_trips`/`journal_people`(테스트용 이름) 뿐이고 크론/함수/스키마는 영구 인프라다.

## 배포 (예정)

새 Cloudflare Pages 프로젝트를 별도로 만들 것(가계부 배포와 분리). Git 연동 시 반드시 "Pages" 탭으로 명시 생성(가계부 10단계에서 겪은 "Workers로 잘못 생성되는 함정" 재발 방지). Root directory를 `travelnote`로 설정. 환경변수(`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_VAPID_PUBLIC_KEY`)는 가계부와 같은 프로젝트 값 재사용.

## 진행 상황

- [x] 1. scaffold — Vite+React+TS, 디자인 토큰(코랄/파스텔), PWA manifest(share_target 제외), 아이콘 신규 제작, 라우팅 스켈레톤
- [x] 2. schema — `journal_*` 마이그레이션(트립/사람/멤버/비밀매칭/메모/발송기록/리마인더/구독) + RLS + 6개 Edge Function(`create-journal-trip`/`run-journal-matching`/`admin-journal`/`journal-push`/`send-journal-reminders`/`deliver-journal`) 실제 프로덕션 배포 및 curl/Playwright 전체 검증 완료
- [x] 3~7 통합 진행 — 코드/이름 입력, 홈(매칭 상태 안내), 기록(메모 작성+오프라인 큐), 내 메모(편집/삭제), 발송(카톡 공유+받은 메모함), 설정(리마인더+푸시) 전부 실제 Supabase에 연결해 E2E 검증 완료
- [x] 8. polish — 토끼(`Bunny`, 포즈 4종: wave/peek/wink/love)+다람쥐(`Squirrel`) SVG 캐릭터와 별/하트/구름 장식(`Decor.tsx`)을 새로 그려 홈(매칭 전/후)·발송(발송 전/빈 받은함) 카드에 적용. 첫 시도에서 팔이 뻗는 포즈(wave/love)가 viewBox 밖으로 잘리는 문제가 있어 좌표를 몸통 원(중심 60,78 반지름 42) 바깥에서 시작하도록 재계산하고 viewBox를 넓혀 해결 — Playwright로 실제 렌더링 확인 후 수정.
- [x] 9. deploy — GitHub `summerjhy/travelbudget` main에 커밋+푸시(같은 저장소, `travelnote/` 서브디렉토리) 후 Cloudflare Pages 신규 프로젝트(Root directory: `travelnote`) 연동 완료. **배포 URL: https://travelnote-31r.pages.dev/** — 실제 프로덕션에서 코드입력 화면 렌더링과 존재하지 않는 코드 입력 시 "존재하지 않는 코드에요" 에러(=환경변수로 실제 Supabase 연결 확인)까지 Playwright로 검증 완료.

**1~9단계 전부 완료.**

## 사용자 외부 작업 체크리스트

- [x] Cloudflare Pages 새 프로젝트 생성 + Git 연동 (Root directory: `travelnote`) — https://travelnote-31r.pages.dev/
- [ ] 관리자 비밀번호로 실제 여행 만들기 + 참여자 4명 접속 확인
- [ ] 실기기 iOS/Android 홈 화면 설치 + 알림 켜기 테스트
