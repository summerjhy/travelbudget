-- ------------------------------------------------------------
-- 모임통장 관리자 (총무)
--
-- "최종 정산하기" 기능은 예산 잔여/초과분을 인당 이체 리스트에 통합해
-- 보여준다. 그러려면 그 잔여/초과분(모임통장 실물)을 누가 들고 있는지
-- 알아야 이체 방향이 정해진다. 지정하지 않으면 예산 잔여/초과는
-- 정산 계산에서 빠지고 화면에 안내만 뜬다.
-- ------------------------------------------------------------

alter table public.trips
  add column if not exists treasurer_member_id uuid references public.trip_members(id) on delete set null;

comment on column public.trips.treasurer_member_id is
  '모임통장(공금) 관리자. 최종 정산 시 예산 잔여/초과분의 이체 방향 기준점.';
