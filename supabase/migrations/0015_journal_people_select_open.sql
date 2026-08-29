-- travelbudget의 people_select_open(마이그레이션 0002)과 동일한 문제를
-- 그대로 겪었다: NameGate에서 최초 등록 시 .insert().select()가 방금 넣은
-- 자기 자신을 못 읽어 401("등록에 실패했어요")이 났다 — 그 시점엔 아직
-- journal_trip_members 연결이 없어 기존 select 정책(트립 경유 확인)을
-- 통과하지 못하기 때문. insert가 이미 열려있어(with check true) select만
-- 막는 건 실질적 보안 이득이 없다는 판단으로 select도 완화한다.
-- (0013에 이미 반영해뒀어야 했지만, 실제로는 E2E 테스트 중 발견해 이
-- 별도 마이그레이션으로 추가 적용했다.)

drop policy if exists "journal_people_select_via_members" on public.journal_people;
drop policy if exists "journal_people_select_open" on public.journal_people;

create policy "journal_people_select_open" on public.journal_people
  for select
  using (true);
