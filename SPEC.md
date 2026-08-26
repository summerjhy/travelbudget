# 여행 가계부 PWA — 프로젝트 스펙

> 이 문서를 Claude Code 프로젝트 루트에 `SPEC.md`로 두고 작업을 시작하세요.
> 기존 프로토타입(`preview.html`)이 디자인·기능 레퍼런스입니다. 디자인 토큰과 화면 구성은 그대로 계승합니다.

---

## 0. 한 줄 요약

친구 4명이 중국 여행 중 공금과 개인 결제를 기록하는 PWA. 카드 결제 캡쳐를 첨부하면 자동으로 금액·가맹점·환율을 읽어 기록한다. 사용자는 앱 설치나 회원가입 없이 링크 하나로 쓴다.

---

## 1. 제약 조건 (중요)

- **전부 무료 티어로 운영.** 유료 결제 없음. 신용카드 등록 없이 시작 가능한 서비스만 사용.
- **친구들은 계정을 만들지 않는다.** 로그인 벽이 있으면 실패한 설계다.
- **아이폰 2명 / 갤럭시 2명.** 두 플랫폼 모두 홈 화면 설치가 되어야 한다.
- **이동 중에 한 손으로 입력.** 입력 단계를 최소화한다. 표 채우기 방식 금지.
- 여행 기간: 2026년 9월 3일 시작. 그 전에 완성되어야 함.

---

## 2. 기술 스택

| 레이어 | 선택 | 이유 / 무료 한도 |
|---|---|---|
| 프론트 | React + Vite + TypeScript, PWA (vite-plugin-pwa) | 설치형 앱 경험, 오프라인 입력 |
| 저장소 / CI | GitHub (프라이빗 저장소) | 무료. 버전 관리, 오프사이트 백업, Pages 자동 배포, Actions 크론 |
| 호스팅 | Cloudflare Pages (GitHub 연동) | 무료, 대역폭 제한 없음. main 푸시하면 자동 배포 |
| DB / 실시간 | Supabase (Postgres + Realtime) | 무료 플랜: 프로젝트 2개, DB 500MB, 파일 1GB, Realtime 메시지 200만건, Edge Function 50만회. 카드 등록 불필요 |
| 이미지 파싱 | Gemini 3 Flash (Google AI Studio) | 무료 티어 유지 중(Flash 계열만). 분당 10회 / 일 1,500회. 여행 규모에 충분 |
| 파싱 실행 위치 | Supabase Edge Function | API 키를 클라이언트에 노출하지 않기 위해 필수 |
| 환율 | frankfurter.app → 실패 시 open.er-api.com | 무료, 키 불필요 |

### 반드시 확인할 것
- Gemini 무료 티어는 **Flash / Flash-Lite 계열만** 해당한다. Pro 계열은 2026년 4월부터 유료 전용이므로 사용하지 말 것.
- Gemini **무료 티어 입력은 구글의 모델 개선에 사용될 수 있다.** 카드 결제 캡쳐를 보내므로, 프롬프트에서 카드번호·계좌번호는 추출하지 말라고 명시하고, 이미지를 서버에 저장하지 않는다(파싱 후 즉시 폐기). 이 사실을 앱 내 안내 문구로 노출한다.
- Supabase 무료 프로젝트는 **DB 활동이 7일간 없으면 일시정지**되고 깨어나는 데 약 30초가 걸린다. 여행 중에는 매일 쓰므로 무관하지만, 여행 전후 공백에 대비해 GitHub Actions로 하루 1회 가벼운 select를 날리는 핑 워크플로를 함께 만들 것.
- Supabase 파일 업로드 최대 50MB. 이미지는 어차피 저장하지 않으므로 문제 없음.

---

## 3. 인증 설계 — 계정 없이 쓰기

Supabase Auth를 쓰지 않는다. 대신 **여행 코드(trip code)** 방식:

- 여행 하나 = `trips` 레코드 하나. 생성 시 8~10자 랜덤 코드 발급 (예: `sh26-k4m9`)
- 앱 URL은 `https<span>://</span>앱주소/t/sh26-k4m9` 형태. 이 링크를 아는 사람이 곧 참여자.
- 코드는 localStorage에 저장 → 두 번째 방문부터는 바로 열림
- RLS 정책: 모든 테이블은 `trip_code`로 격리. anon 키로 `trip_code`가 일치하는 행만 select/insert/update/delete 가능하게 정책 작성
- **주의**: anon 키는 클라이언트에 노출된다. RLS를 코드 일치 조건으로 반드시 걸어야 다른 여행 데이터가 새지 않는다. 코드는 추측 불가능하게 충분히 길게.
- 참여자 식별: 최초 진입 시 "누구세요?" 한 번 물어보고(소영/민정/유리/혜연 중 선택) localStorage에 저장. 이후 입력 시 기본 결제자로 사용.

---

## 4. 데이터 모델

```sql
-- trips
id            uuid pk
code          text unique not null      -- 참여 코드
name          text not null             -- '상하이 2026'
start_date    date not null
base_currency text not null default 'KRW'
spend_currency text not null default 'CNY'
created_at    timestamptz default now()

-- members (여행별 참여자)
id       uuid pk
trip_id  uuid fk
name     text not null                  -- 소영 / 민정 / 유리 / 혜연
sort     int

-- budgets (예산은 단일 값이 아니라 항목 리스트)
id       uuid pk
trip_id  uuid fk
date     date not null
amount   numeric not null               -- 원화
memo     text                           -- '초기 예산', '둘째날 추가'
created_at timestamptz

-- entries (지출)
id         uuid pk
trip_id    uuid fk
date       date not null
title      text not null
category   text not null                -- 식사/카페/교통/숙소/관광/술/쇼핑/기타
member_id  uuid null fk                 -- null이면 공금
krw        numeric not null
cny        numeric not null
rate       numeric                      -- 이 건에 적용된 1위안당 원화
source     text                         -- 'text' | 'image' | 'manual'
created_by text                         -- 입력한 사람 이름
created_at timestamptz
updated_at timestamptz

-- rates (날짜별 환율 캐시)
trip_id  uuid fk
date     date
rate     numeric
pk (trip_id, date)
```

기본 시드: 예산 1,200,000원 / 시작일 2026-09-03 / 멤버 소영·민정·유리·혜연.

---

## 5. 환율 규칙

우선순위대로 적용한다.

1. 캡쳐나 텍스트에서 **적용환율이 직접 읽힌 경우** → 그 값
2. 위안·원화가 **둘 다 입력된 경우** → `rate = krw / cny` (실제 청구 환율. 카드 명세서와 정확히 맞추는 용도)
3. `rates` 테이블에 **그 날짜 값이 있는 경우** → 재사용
4. 없으면 **외부 API를 그 날짜에 한 번만 조회**하고 `rates`에 저장
5. 조회 실패 시 → 가장 최근 저장 환율

계산: `krw = cny × rate`, `cny = krw ÷ rate`.
**저장 시점에 양쪽 금액을 모두 확정 저장한다.** 나중에 환율이 바뀌어도 과거 기록은 변하지 않는다.
UI에 "시장 중간환율이라 카드 청구액과 1~2% 차이날 수 있음"을 한 줄 안내.

---

## 6. 입력 방식 — 여기가 이 앱의 핵심

세 가지 경로를 모두 지원하되, 사진이 1순위다.

### 6-1. 사진 (최우선)
- 갤러리 선택 또는 카메라 촬영
- 여러 장 동시 선택 지원 (최대 5장)
- 클라이언트에서 긴 변 1600px로 리사이즈 + JPEG 0.8 압축 후 전송 (토큰 절약, 속도)
- Edge Function → Gemini 3 Flash → 구조화 JSON
- **안드로이드는 Web Share Target 등록.** manifest에 `share_target`을 선언해서 스크린샷 공유 시트에서 이 앱을 바로 고를 수 있게 한다. 이게 되면 "캡쳐 → 공유 → 끝"이라 입력 마찰이 사실상 0이 된다.
- **iOS는 Share Target 미지원.** 앱 안에서 사진 선택으로 대체. 이 차이를 안내 문구로 명시할 것.

### 6-2. 텍스트
자유 입력. 여러 줄 동시 처리.
```
훠궈 380
택시 45 소영
마사지 198 혜연
숙소 240000원
9/5 아침 62
```
규칙:
- 멤버 이름이 포함되면 그 사람 **개인 결제**, 없으면 **공금**
- 숫자만 있으면 위안, `원`/`₩`/`KRW`가 붙으면 원화
- 단위 없는 숫자가 10,000 이상이면 원화로 추정
- `9/5` 형태 접두사는 날짜로 해석
- 가맹점/내역 키워드로 카테고리 자동 추정
- 정규식 우선 처리, 실패한 줄만 Gemini로 보내는 하이브리드가 이상적 (무료 쿼터 절약)

### 6-3. 직접 입력
파싱이 실패하거나 네트워크가 없을 때의 폴백. 금액·통화·결제자·날짜·분류 폼.

### 공통: 확인 단계
파싱 결과는 **저장 전에 반드시 편집 가능한 미리보기**로 보여준다. 금액, 통화, 결제자, 제목을 탭으로 바로 고칠 수 있어야 한다. 자동 인식은 틀릴 수 있고, 틀린 채로 저장되면 나중에 찾기 어렵다.

---

## 7. 화면

### 기록 탭
- 상단 헤더: 여행 이름 / 잔여 예산 (원화 크게 + 위안 환산 병기) / 사용률 게이지
- 입력 영역: 사진 버튼, 텍스트 입력, 읽어들이기
- 파싱 미리보기 → 저장
- 저장 직후 **이번 사용금액** 세로 표: 이름 / 일자 / 원화 / 위안화 / 공금여부
- **공금 외 지출내역 (누적)**: 소영·민정·유리·혜연 각각 금액
- **잔여 예산**: 예산 총액 / 공금 사용 / 잔여

### 내역 탭
- 합계 박스: 공금(건수), 개인 합계, 예산 사용률, 잔여
- 전체 내역 리스트. **항목 탭 → 인라인 편집** (제목 / 위안 / 원화 / 결제자 / 날짜 / 삭제)
- 날짜별 그룹핑, 카테고리 필터, 사람 필터
- 금액은 항상 `468元 · ₩89,388` 형태로 **위안과 원화를 같은 크기로 병기**

### 설정 탭
- 예산 항목 리스트 + 추가/삭제 (여행 중 공금 추가 대응)
- 시작일, 여행 이름
- 날짜별 환율 목록 + 직접 입력 + 지금 조회
- 홈 화면 설치 안내 (iOS/Android 각각)
- 백업: 텍스트 복사 / CSV 다운로드 / 구글 시트 내보내기(선택)
- 참여 링크 공유 버튼 (Web Share API)

---

## 8. 오프라인 · 동기화

중국에서 네트워크가 불안정할 수 있다.

- Service Worker로 앱 셸 캐싱
- 입력은 IndexedDB에 먼저 쓰고 큐잉 → 온라인 복귀 시 Supabase에 반영
- Supabase Realtime 구독으로 다른 사람 입력이 즉시 반영되게 (폴링 대신)
- 충돌은 last-write-wins, 단 삭제는 tombstone으로 처리

---

## 9. 디자인

`preview.html`의 토큰을 그대로 계승한다.

```
--paper   #EDEFE7   배경
--card    #F8F9F3   카드
--ink     #1B2620   본문
--soft    #5B6A61   보조 텍스트
--jade    #2A6B5C   주색 (헤더, 주요 버튼)
--marigold #C98A1E  강조 (개인 결제, 탭 인디케이터)
--rose    #A4505E   경고 / 초과
--line    rgba(27,38,32,.13)
```

- 표제: Gowun Batang 700
- 본문: IBM Plex Sans KR
- 숫자: IBM Plex Mono, `font-variant-numeric: tabular-nums` 필수
- 모바일 우선. 최대 폭 560px 중앙 정렬
- 헤더 하단의 점선 티어 패턴은 유지 (시각적 시그니처)

---

## 10. 작업 순서

1. Vite + React + TS 스캐폴딩, PWA 플러그인, 디자인 토큰 이식
2. Supabase 프로젝트 생성, 스키마 마이그레이션, RLS 정책
3. 여행 코드 라우팅 + 참여자 선택
4. 텍스트 파서(정규식) + 미리보기 + 저장 → **이 시점에 이미 쓸 수 있는 상태여야 함**
5. 내역 탭 + 인라인 편집
6. 환율 로직 (Edge Function)
7. Gemini 이미지 파싱 (Edge Function) + 사진 첨부 UI
8. PWA manifest, Service Worker, 오프라인 큐
9. Android Share Target
10. GitHub 저장소 연결 → Cloudflare Pages 자동 배포 + GitHub Actions 핑 워크플로

4번까지가 최소 사용 가능 버전(MVP). 여행 전에 7번까지는 끝내는 걸 목표로 한다.

---

## 11. 테스트해야 할 것

- 실제 한국 카드사 앱의 해외 결제 상세 캡쳐 (여러 카드사)로 파싱 정확도 확인
- 위안·원화가 동시에 표시된 캡쳐에서 환율 역산이 맞는지
- 오프라인에서 입력 후 온라인 복귀 시 동기화
- iOS Safari / Android Chrome 각각에서 홈 화면 설치
- 두 사람이 동시에 입력했을 때 Realtime 반영
- 예산을 중간에 추가했을 때 잔여·사용률 재계산

---

## 12. 열려 있는 결정

- 사진 원본을 아예 저장하지 않을지, 아니면 Supabase Storage에 임시 보관 후 N일 뒤 자동 삭제할지 → 기본은 저장 안 함
- 정산(누가 누구에게 얼마) 기능을 넣을지 → 현재는 공금 방식이라 불필요. 여행 후 개인 결제분 정산이 필요하면 추가
- 여러 여행을 관리할지, 이번 한 번만 쓸지 → 스키마는 다중 여행을 지원하게 잡아둠
