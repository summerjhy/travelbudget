-- ============================================================
-- 발송 허용 스위치 + 다 같이 동시 공개
-- ============================================================

-- 1) 발송 허용 스위치. 관리자가 설정 탭에서 켜기 전까지는 참여자가
--    "발송하기"를 눌러도 deliver-journal이 거부한다. 기본값 false — 기존
--    여행도 관리자가 켜야 발송된다(이미 발송된 건은 그대로 남는다).
alter table public.journal_trips
  add column delivery_open boolean not null default false;

comment on column public.journal_trips.delivery_open is '발송 허용 여부(관리자 스위치). false면 deliver-journal이 발송을 거부.';

-- 2) 코드만 알면 journal_trips를 직접 고칠 수 있던 정책을 없앤다. 클라이언트는
--    이 테이블을 update하지 않고(수정은 전부 admin-journal이 service_role로),
--    이 정책이 남아있으면 참여자가 REST로 delivery_open/revealed_at/guide_steps를
--    직접 바꿔 관리자 스위치를 우회할 수 있다.
drop policy if exists "journal_trips_update_by_code" on public.journal_trips;

-- 3) 다 같이 동시 공개. 공개 시점은 기존 journal_trips.revealed_at(관리자가
--    "공개" 스위치를 켠 시각, null이면 공개 전)으로 판단한다.
--
--    예전엔 받은 사람이 journal_deliveries.observer_member_id를 직접 읽고 그
--    id로 이름을 찾아 "각자 받은 순간" 공개됐다. 버튼만 막아서는 REST로 이
--    컬럼을 바로 읽어 우회할 수 있으므로, observer_member_id 컬럼 조회 권한을
--    클라이언트에서 빼고 이름은 공개 이후에만 답하는 함수로만 돌려준다.
revoke select on public.journal_deliveries from anon, authenticated;
grant select (id, trip_id, target_member_id, body, delivered_at)
  on public.journal_deliveries to anon, authenticated;

create or replace function public.journal_reveal_observer()
returns table (name text, emoji text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, tm.emoji
  from public.journal_deliveries d
  join public.journal_trips t on t.id = d.trip_id
  join public.journal_trip_members tm on tm.id = d.observer_member_id
  join public.journal_people p on p.id = tm.person_id
  where d.target_member_id = public.current_member_id()
    and t.code = public.current_note_code()
    and t.revealed_at is not null
$$;

comment on function public.journal_reveal_observer() is '나를 관찰한 친구(이름+이모지). 관리자가 공개(revealed_at)하기 전엔 빈 결과.';

revoke all on function public.journal_reveal_observer() from public;
grant execute on function public.journal_reveal_observer() to anon, authenticated;
