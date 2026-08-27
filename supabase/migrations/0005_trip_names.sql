-- ------------------------------------------------------------
-- trip_names — 홈 화면에 뿌릴 "여행 이름만" 담는 공개 목록
--
-- trips 테이블의 RLS 는 그대로 둔다. 거기에는 코드/날짜/목적지/통화가
-- 같이 있어서 select 를 열면 이름만 골라 노출할 수가 없다.
-- 그래서 이름만 담는 테이블을 따로 두고, 이 테이블만 공개한다.
--
-- 노출되는 것: 여행 이름, 만든 순서.
-- 노출되지 않는 것: 참여 코드, 날짜, 목적지, 통화, 예산, 지출, 참여자.
-- 즉 목록을 봐도 들어갈 수는 없다 (들어가려면 코드를 알아야 한다).
-- ------------------------------------------------------------

create table if not exists public.trip_names (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.trip_names is
  '홈 화면 공개 목록용. 여행 이름만 담는다 — 코드/날짜/목적지는 절대 넣지 말 것.';
comment on column public.trip_names.trip_id is
  'trips 참조. 여행이 지워지면 목록에서도 같이 사라진다.';

alter table public.trip_names enable row level security;

-- 누구나 읽을 수 있다. 이 테이블에는 이름 말고 볼 게 없다.
create policy "trip_names_select_open" on public.trip_names
  for select
  using (true);

-- 쓰기는 service_role(create-trip Edge Function)만. anon 은 INSERT/UPDATE/DELETE 정책이
-- 없으므로 막힌다 — 아무나 목록을 더럽히지 못하게 한다.

create index if not exists trip_names_created_at_idx on public.trip_names (created_at desc);

-- 이미 있는 여행들을 목록에 채워 넣는다.
insert into public.trip_names (trip_id, name, created_at)
select t.id, t.name, t.created_at from public.trips t
on conflict (trip_id) do nothing;
