# 여행 가계부 PWA

친구들과의 여행 중 공금·개인 결제를 기록하는 PWA. 자세한 스펙은 [SPEC.md](SPEC.md), 작업 컨텍스트/결정사항은 [CLAUDE.md](CLAUDE.md) 참고.

## 개발

```bash
npm install
cp .env.example .env   # Supabase URL/anon key 채우기
npm run dev
```

## Supabase 설정

`supabase/migrations/`의 SQL을 순서대로 적용하고, `supabase/functions/`의 Edge Function을 배포한다.
각 Edge Function은 아래 시크릿이 필요하다(Supabase 대시보드 → Edge Functions → Manage secrets):

| 시크릿 | 필요한 함수 | 비고 |
|---|---|---|
| `ADMIN_PASSWORD` | create-trip | 여행 생성 시 검증하는 관리자 비밀번호 |
| `GEMINI_API_KEY` | parse-image | [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급 |
| `GEMINI_MODEL` (선택) | parse-image | 기본값 `gemini-flash-latest` |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 런타임에 자동 주입되므로 별도 등록 불필요.

## 배포 (Cloudflare Pages)

1. GitHub 저장소를 퍼블릭으로 생성하고 이 프로젝트를 푸시한다.
2. Cloudflare 대시보드 → Workers & Pages → **Create → Pages → Connect to Git**으로 저장소 연결.
3. 빌드 설정: Framework preset `Vite`, Build command `npm run build`, Build output directory `dist`.
4. Cloudflare Pages 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록(Production/Preview 모두).
5. `main` 브랜치 푸시 시 자동 배포된다.

## GitHub Actions

`.github/workflows/supabase-ping.yml`이 매일 1회 Supabase에 가벼운 조회를 보내 무료 프로젝트가 7일 비활성으로
일시정지되는 것을 막는다. 저장소 Settings → Secrets and variables → Actions에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를
등록해야 동작한다.
