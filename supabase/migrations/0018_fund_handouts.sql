-- ------------------------------------------------------------
-- 공금 나눠주기 / 돌려받기
--
-- 여행 중에 총무가 공금 일부를 멤버에게 미리 보내고 그 돈으로 결제하게 하는
-- 일이 흔하다. 원화 계좌이체일 수도 있고, ATM 에서 뽑은 현지 지폐를 비상금으로
-- 나눠주거나 트래블카드의 외화를 그대로 송금하는 경우도 있다.
--
-- 지금까지는 이걸 기록할 데가 없어서 정산이 어긋났다. 율이 70만원을 미리 받아
-- 그 돈으로 결제하면 앱은 "율이 자기 돈 705,261원을 썼다"고 보고, 정산 방향이
-- 통째로 뒤집혔다 (혜연이 484,267원을 내야 한다고 나왔지만 실제로는 215,733원을
-- 받아야 했다).
--
-- 이건 지출도 예산도 아니다. 공금이 **누구 손에 들려 있는지**가 바뀔 뿐이라
-- 잔여 예산은 변하지 않는다. 그래서 별도 테이블로 둔다.
--
-- 금액 표현은 budgets 와 같은 모양이다 (amount = 원화 환산액, 외화로 건넸으면
-- original_amount 와 rate 에 원본을 남긴다). 미리 환전한 주머니에서 나간
-- 외화라면 rate 는 그 주머니의 환전 환율이다 — 실제로 치른 값이라야 정산이 맞다.
-- ------------------------------------------------------------

create table if not exists public.fund_handouts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  direction text not null default 'out',
  amount numeric not null,
  currency text not null default 'KRW',
  original_amount numeric,
  rate numeric,
  date date not null,
  memo text,
  created_at timestamptz not null default now(),
  constraint fund_handouts_direction_check check (direction in ('out', 'in'))
);

comment on table public.fund_handouts is
  '공금을 멤버에게 미리 건네거나(out) 되돌려받은(in) 기록. 지출이 아니라 공금의 이동이라 잔여 예산에는 영향이 없고, 최종 정산에서만 반영된다.';
comment on column public.fund_handouts.member_id is
  '상대방 trip_members.id. direction=out 이면 받은 사람, in 이면 돌려준 사람.';
comment on column public.fund_handouts.amount is
  '원화 환산액. 정산은 항상 이 값으로 한다.';
comment on column public.fund_handouts.rate is
  '외화로 건넨 경우 적용 환율. 미리 환전해둔 주머니에서 나갔다면 그 주머니의 환전 환율(실제로 치른 값).';

create index if not exists fund_handouts_trip_id_idx on public.fund_handouts (trip_id);

alter table public.fund_handouts enable row level security;

create policy "fund_handouts_select_by_trip_code" on public.fund_handouts
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = fund_handouts.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "fund_handouts_insert_by_trip_code" on public.fund_handouts
  for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = fund_handouts.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "fund_handouts_update_by_trip_code" on public.fund_handouts
  for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = fund_handouts.trip_id
        and t.code = public.current_trip_code()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = fund_handouts.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "fund_handouts_delete_by_trip_code" on public.fund_handouts
  for delete
  using (
    exists (
      select 1 from public.trips t
      where t.id = fund_handouts.trip_id
        and t.code = public.current_trip_code()
    )
  );
