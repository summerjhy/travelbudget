# 비밀친구 관찰일지 (travelnote) — 작업 컨텍스트

여행 가계부(`travelbudget`, 저장소 루트)와 같은 저장소·같은 Supabase 프로젝트를 공유하지만 **완전히 독립된 앱**이다. 코드/세션/DB 테이블 전부 별도 네임스페이스(`journal_` 접두사, `x-note-code`/`x-member-id` 헤더)를 쓴다.

## 컨셉

여행 시작 시 참여자끼리 서로 모르게 비밀친구(마니또)를 제비뽑기하고, 여행 내내 자기 비밀친구를 관찰한 메모를 시간 기록과 함께 수시로 남긴다. 마지막 날 자기 비밀친구에게 모아둔 관찰일지를 전달한다(앱 내 전달 + 카톡 공유용 텍스트).

## 확정된 설계 결정

1. **저장소/DB**: `travelbudget/travelnote/` 안의 독립 앱. Supabase는 같은 프로젝트(`travel_budget_summer`)를 공유하되 테이블은 `journal_*`로 분리. 가계부의 `trips`/`people`/`entries` 등은 전혀 참조하지 않는다.
2. **진입 방식**: 가계부와 독립된 자체 8자리 코드 체계로 새로 진입. 같은 사람이어도 이름을 다시 입력한다.
3. **마니또 매칭**: 관리자가 버튼으로 수동 트리거. 더랑주먼트(자기 자신 제외 순환 순열, 무작위 순열 재시도 방식)를 `run-journal-matching` Edge Function이 service_role로 계산 — 클라이언트는 절대 매칭 결과를 만들거나 볼 수 없다.
4. **비밀 보장의 핵심 (RLS)**: `journal_secret_pairs`는 `observer_member_id = current_member_id()`(요청 헤더 `x-member-id`)일 때만 select 허용. `target_member_id` 기준 역방향 조회 정책은 아예 존재하지 않아 "누가 나를 관찰하는지"는 어떤 방법으로도 조회 불가능 — 실제 curl로 위조 시도까지 검증 완료(다른 사람 행세를 해도 자기 관찰 대상 외엔 절대 안 보임).
5. **관찰 대상 표시 (초기 설계 오류 → 정정)**: 처음엔 "이름 숨김, 익명 표시만"으로 설계했으나, 이는 마니또 게임의 구조를 착각한 것이었다 — 비밀이어야 하는 건 "대상이 관찰당하는지/누가 관찰하는지 모른다"는 방향이지, "관찰자가 자기 대상이 누구인지 모른다"가 아니다(관찰자 본인이 대상을 모르면 애초에 관찰 자체가 불가능하다). 실사용 리허설에서 "내 비밀친구가 누구인지 알 수가 없다"는 피드백으로 발견해 즉시 정정했다. `useSecretTarget.ts`가 `journal_secret_pairs`를 `journal_trip_members`/`journal_people`와 조인해 이름을 가져오고, 홈 화면에 `SecretTargetReveal` 컴포넌트로 보여준다. 단, 옆 사람이 화면을 볼 수 있다는 추가 피드백을 반영해 상시 노출이 아니라 **버튼을 누르고 있는 동안만**(mouse/touchdown~up) 이름이 보이고 손을 떼면 즉시 다시 가려지는 방식(`.reveal-btn`)으로 만들었다 — 탭 토글 방식은 깜빡 잊고 안 끄면 노출 위험이 남는다.
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
- [x] 8. polish — 토끼(`Bunny`, 포즈: wave/peek/wink/love)+다람쥐(`Squirrel`) SVG 캐릭터와 별/하트/구름 장식(`Decor.tsx`). **팔/꼬리를 넣은 첫 버전은 얼굴 옆에 이상한 덩어리·그림자처럼 보인다는 사용자 피드백으로 전부 제거**하고 얼굴만 남긴 단순한 형태로 다시 그렸다 — 포즈 구분은 눈/입 표정만으로 한다.
- [x] 9. deploy — GitHub `summerjhy/travelbudget` main에 커밋+푸시(같은 저장소, `travelnote/` 서브디렉토리) 후 Cloudflare Pages 신규 프로젝트(Root directory: `travelnote`) 연동 완료. **배포 URL: https://travelnote-31r.pages.dev/** — 실제 프로덕션에서 코드입력 화면 렌더링과 존재하지 않는 코드 입력 시 "존재하지 않는 코드에요" 에러(=환경변수로 실제 Supabase 연결 확인)까지 Playwright로 검증 완료.
- [x] 10. (배포 후 리허설에서 발견) 관찰 대상 이름 노출 버그 수정 — 위 5번 항목 참고. `useSecretTarget.ts` + `SecretTargetReveal.tsx`(눌러서 확인, 손 떼면 가림) 추가, 일러스트 팔/꼬리 제거.
- [x] 11. (10단계 이후 추가) 실기기 리허설 피드백 반영 3건:
  - **상태바 아이콘이 네모로 보이는 문제**: 웹푸시 알림의 `icon`(트레이의 큰 컬러 아이콘)과 `badge`(상태바의 작은 흑백 실루엣)를 안드로이드가 다르게 렌더링하는데, `sw.ts`가 둘 다 배경까지 꽉 찬 불투명 `pwa-192x192.png`를 썼다. 배경 없이 실루엣만 있는 전용 `badge-96x96.png`(`scripts/badge-source.svg`)를 새로 만들어 `badge` 필드만 교체.
  - **매칭 완료 알림 추가**: `run-journal-matching`이 매칭 성공 후 활성 멤버 전원의 구독으로 "🎉 비밀친구가 정해졌어요 / 나의 비밀친구가 결정됐어요. 지금 바로 앱에 들어와서 확인해보세요!" 푸시를 보내도록 확장. 실패해도(구독 없음 등) 매칭 자체는 이미 성공했으니 에러로 만들지 않는다.
  - **발송 알림 문구 변경**: `deliver-journal`의 target 알림 문구를 "💌 관찰일지가 도착했어요 / 누군가 나에게 이번 여행 관찰일지를 보내왔어요. 지금 앱에 들어와서 확인해보세요!"로 교체.
  - **눌러서 확인 버튼 문구/레이아웃**: "눌러서 확인하기 (손 떼면 다시 가려져요)" 한 줄이 뜻이 안 와닿는다는 피드백으로 "내 비밀친구가 누군지 눌러서 확인하기" / "손 떼면 다시 가려져요" 두 줄, 가운데 정렬로 변경.
  - **"나를 관찰한 친구의 이름은?" 공개 기능**: 발송(deliver) 이후엔 서로 누군지 밝히는 게 게임의 마지막 재미 포인트이므로, "내가 받은 관찰일지" 박스 아래 버튼을 추가 — 누르면 팝업(색종이 애니메이션 `Confetti.tsx` 포함)으로 `journal_deliveries.observer_member_id`를 `journal_trip_members`/`journal_people`과 조인해 이름+이모지를 공개한다. 이 테이블들은 트립 코드만 알면 조회 가능한 공개 테이블(가계부 참여자 목록과 동일 설계)이라 별도 RLS 변경 없이 바로 구현 가능했다.

- [x] 12. (재매칭 리셋 누락 버그) 관리자가 이미 매칭된 여행을 다시 뽑을 때(`force`) `journal_secret_pairs`만 지우고 `journal_notes`/`journal_deliveries`는 그대로 남아있던 버그. 그대로 두면 예전 매칭 때 쓴 메모가 새 매칭에서도 남아 엉뚱한 사람에게 전달되거나, 예전 발송 기록 때문에 `deliver-journal`이 "이미 발송함"으로 오판한다. `run-journal-matching`의 force 분기에서 `journal_deliveries`→`journal_notes`→`journal_secret_pairs` 순서로 함께 지우도록 수정하고, `AdminConsole`의 재매칭 확인 문구에도 "메모와 발송 기록까지 전부 지워진다"는 경고를 추가했다.

- [x] 13. (실사용 중 발견) 메모가 조용히 사라지는 버그 — "발송 탭에서 텍스트 공유 후 기록 탭에서 메모를 추가해도 반영이 안 된다"는 리포트로 발견. 근본 원인은 공유 기능과 무관했다: `useNotes.addNote`와 `useOfflineSync.flushQueue`가 **진짜 오프라인/네트워크 실패**와 **서버가 실제로 거부한 요청(RLS 위반 등)**을 구분하지 않고 전부 "오프라인이니 나중에 재시도"로 취급했다. supabase-js는 RLS 위반도 예외를 던지지 않고 `{data:null, error}`로 정상 반환하므로(travelbudget 8단계에서 이미 겪은 함정과 동일), `flushQueue`의 `try/catch`만으로는 실패를 못 잡아 **실패한 요청도 성공으로 착각해 큐에서 지워버렸다** — 화면엔 저장된 것처럼 보이다가 새로고침하면 서버엔 없어서 조용히 사라지는 현상. `isNetworkError.ts`(travelbudget의 `isNetworkError`와 동일 패턴: `navigator.onLine` + 에러 메시지의 `failed to fetch`/`networkerror`/`load failed` 검사)를 추가해 진짜 네트워크 문제일 때만 큐잉하고, 그 외엔 사용자에게 실제 에러("저장에 실패했어요")를 보여주도록 고쳤다. `x-member-id` 헤더를 인위적으로 깨서 RLS 위반을 재현 → 수정 전엔 조용히 사라짐, 수정 후엔 정확히 에러 표시를 Playwright로 확인. 이 버그는 travelbudget의 `useOfflineSync.ts`에도 동일하게 존재하지만(원본을 그대로 복사해온 것이라) 이번 수정은 travelnote 쪽에만 적용했다 — travelbudget 쪽 수정은 별도 요청 필요.

- [x] 14. (13번 수정에도 남은 혼란 → 오프라인 큐 완전 제거) 13번 수정으로 "진짜 에러는 화면에 보여준다"까지는 고쳤지만, 실기기에서 실제로 겪어보니 **오프라인 저장 자체가 사용자에게 혼란**이었다 — 오프라인에서 메모를 쓰면 그 세션에선 "최근 메모"에 바로 보이지만, 새로고침하면 아직 서버에 동기화 전이라 안 보여서 "메모가 없어졌다"고 오인하기 쉬웠다(그 뒤 자동 동기화되면 다시 나타나지만, 그 사이 텀을 참여자가 이해하기 어렵다). 마니또 관찰 메모는 여행 가계부처럼 그 자리에서 반드시 기록해야 하는 데이터가 아니라 온라인 상태에서 몇 초 늦게 써도 무방하므로, **오프라인 큐 자체를 없애고 온라인 상태에서만 기록/수정/삭제 가능하게** 단순화했다. `useNotes`에서 `enqueueInsert` 등 큐 관련 로직을 전부 제거하고 즉시 온라인 요청만 하도록 바꿨고, `RecordTab`은 `navigator.onLine`을 실시간 구독해 오프라인이면 입력창/버튼을 비활성화하고 "오프라인 상태예요" 안내를 보여준다. `offlineQueue.ts`/`useOfflineSync.ts`/`isNetworkError.ts`와 `idb` 의존성을 전부 삭제했다 — 13번 항목의 "온라인이면 자동 동기화" 설명은 더 이상 유효하지 않다.

- [x] 15. (실사용 중 발견) 발송이 "그 순간 영구 고정"이라 그 이후 쓴 메모가 반영 안 되는 문제 — "11건 썼는데 발송은 3건만 반영된다"는 리포트로 발견. 실제 DB를 조회해 확인해보니 버그가 아니라 원래 설계(한 번 발송하면 그 시점 메모로 영구 고정)대로였다. 사용자와 상의해 **누를 때마다 그 시점까지의 메모 전체로 다시 갱신**하는 방식으로 설계를 변경 — `deliver-journal`이 `journal_deliveries`를 upsert하도록 바꾸고, 알림은 최초 발송 때만 보내도록(재발송마다 알림 스팸 방지) 했다. `DeliverTab`에 "그 사이에 쓴 메모까지 다시 발송하기" 버튼 추가.
- [x] 16. (15번 수정 중 발견한 더 심각한 버그) **발송 탭을 열기만 해도(버튼을 안 눌러도) 자동으로 발송되는 버그.** `DeliverTab`이 마운트 시 "이미 발송했는지" 복원하려고 `deliverJournal`을 그대로 호출했는데, 이 함수는 확인용이 아니라 실제로 upsert(발송)를 실행하는 함수였다 — 즉 참여자가 발송 탭을 구경만 해도 그 순간의 메모가 조용히 비밀친구에게 전달됐다. 이 버그는 15번 수정 전(스냅샷을 한 번만 만들던 시절)에도 존재했지만, upsert로 바꾸면서 "탭 열 때마다 매번 조용히 갱신"까지 될 뻔했다. `deliver-journal`에 `checkOnly` 플래그를 추가해 조회 전용 경로(아무것도 쓰지 않음)를 분리하고, `DeliverTab`은 마운트 시 `checkDelivered()`(checkOnly:true)만 부르고 실제 발송은 버튼 클릭(`deliverJournal`, checkOnly 없음)에서만 일어나도록 고쳤다. Playwright로 "탭을 두 번 열어도 발송 전 버튼이 그대로 남아있고, DB에 journal_deliveries가 생성 안 됨" → "버튼을 눌러야만 정확히 1건 생성됨"을 확인했다.

**1~16단계 전부 완료.**

## 사용자 외부 작업 체크리스트

- [x] Cloudflare Pages 새 프로젝트 생성 + Git 연동 (Root directory: `travelnote`) — https://travelnote-31r.pages.dev/
- [ ] 관리자 비밀번호로 실제 여행 만들기 + 참여자 4명 접속 확인
- [ ] 실기기 iOS/Android 홈 화면 설치 + 알림 켜기 테스트
