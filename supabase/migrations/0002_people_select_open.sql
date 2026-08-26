-- people_select_via_trip_members는 이름을 새로 등록한 직후(아직 trip_members에
-- 연결되기 전) INSERT ... SELECT 응답을 막아 401을 유발했다.
-- people은 이름 문자열만 담는 저위험 테이블이라 select도 열어둔다.
-- (INSERT가 이미 열려있어 select만 막는 것은 실질적 보안 이득이 없다.)

drop policy if exists "people_select_via_trip_members" on public.people;

create policy "people_select_open" on public.people
  for select
  using (true);
