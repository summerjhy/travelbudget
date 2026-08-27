-- ------------------------------------------------------------
-- 여행 시간대 + 홈 화면 여행 목록 뷰
--
-- "오늘이 며칠인가" 는 여행 목적지의 시간대로 판정한다. 기기 로컬 시간대를
-- 쓰면 사람마다 다른 날짜가 찍히고(누구는 폰을 현지로 바꾸고 누구는 아님),
-- 한국 시각 고정도 답이 아니다 — 멕시코(KST-15h)에서 현지 점심에 기록하면
-- 한국은 이미 다음 날이라 여행 첫날 지출이 둘째 날로 넘어간다.
--
-- 클라이언트는 destinations.ts 의 나라별 tz 로 계산하고, 서버는 이 컬럼을
-- 쓴다. 같은 값을 두 군데서 유도하지 않도록 여행 생성 시 한 번 정해 박아둔다.
-- ------------------------------------------------------------

alter table public.trips
  add column if not exists tz text not null default 'Asia/Seoul';

comment on column public.trips.tz is
  'IANA 시간대. 목적지 나라에서 정해진다. "오늘" 판정 기준 — 오프셋이 아니라 존 이름이라 서머타임이 자동 반영된다.';

-- ------------------------------------------------------------
-- trip_list — 홈 화면 공개 목록 (이름 + 진행 상태)
--
-- trip_names 는 이름만 담아 날짜가 없다. 상태를 나누려면 날짜가 필요한데
-- 그걸 공개하고 싶지는 않으므로, 뷰에서 trips 를 읽어 phase 만 계산해
-- 내보낸다. 시작일·종료일·코드는 뷰 결과에 들어가지 않는다.
--
-- security_invoker 를 켜지 않아 뷰 소유자 권한으로 trips 를 읽는다.
-- 즉 anon 이 trips 를 직접 못 읽어도 이 뷰로는 상태만 볼 수 있다.
-- ------------------------------------------------------------
create or replace view public.trip_list as
select
  tn.trip_id,
  tn.name,
  tn.created_at,
  case
    when (current_timestamp at time zone t.tz)::date < t.start_date then 'upcoming'
    when (current_timestamp at time zone t.tz)::date > coalesce(t.end_date, t.start_date) then 'ended'
    else 'ongoing'
  end as phase
from public.trip_names tn
join public.trips t on t.id = tn.trip_id;

comment on view public.trip_list is
  '홈 화면 여행 목록. 이름과 진행 상태만 — 날짜·코드는 노출하지 않는다.';

grant select on public.trip_list to anon, authenticated;
