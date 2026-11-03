-- 홈 화면 "어떻게 쓰나요?" 안내 단계를 코드(여행)별로 관리자가 직접 정한다.
-- null이면 클라이언트 기본 3단계(DEFAULT_GUIDE_STEPS)를 보여준다.
-- 수정은 admin-journal Edge Function(관리자 비밀번호 확인 후 service_role)으로만 한다.

alter table public.journal_trips
  add column guide_steps text[];

alter table public.journal_trips
  add constraint journal_trips_guide_steps_max5
  check (guide_steps is null or cardinality(guide_steps) between 1 and 5);

comment on column public.journal_trips.guide_steps is '홈 화면 "어떻게 쓰나요?" 단계(최대 5개). null이면 기본 안내.';
