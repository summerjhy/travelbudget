-- ============================================================
-- 여행 가계부 초기 스키마
-- 인증 없음. 클라이언트는 매 요청에 x-trip-code 헤더를 보내고,
-- RLS는 이 헤더 값과 trips.code가 일치하는 행만 노출한다.
-- ============================================================

create extension if not exists moddatetime with schema extensions;

-- 요청 헤더에서 현재 trip code를 읽는 헬퍼.
-- 헤더가 없거나 파싱 실패하면 빈 문자열(어떤 코드와도 매치되지 않음).
create or replace function public.current_trip_code()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.headers', true)::json->>'x-trip-code',
    ''
  );
$$;

-- ------------------------------------------------------------
-- trips
-- ------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  start_date date not null,
  end_date date,
  destinations text[] not null default array[]::text[],
  base_currency text not null default 'KRW',
  spend_currencies text[] not null default array['CNY'],
  created_at timestamptz not null default now()
);

comment on column public.trips.code is '참여 코드. 관리자가 직접 지정하는 숫자 8자리.';
comment on column public.trips.destinations is '여행 목적지 목록 (예: ["중국 상하이", "중국 항저우"]). 복수 선택 가능.';
comment on column public.trips.spend_currencies is '여행 중 사용하는 통화 목록. 복수 선택 가능 (예: 여러 나라 경유).';

alter table public.trips enable row level security;

create policy "trips_select_by_code" on public.trips
  for select
  using (code = public.current_trip_code());

-- insert 정책 없음: 여행 생성은 anon/authenticated로 불가능.
-- 관리자 비밀번호를 검증하는 Edge Function(create-trip)이 service_role로만 생성한다.

create policy "trips_update_by_code" on public.trips
  for update
  using (code = public.current_trip_code())
  with check (code = public.current_trip_code());

-- ------------------------------------------------------------
-- people (전역 인물 마스터, 여행에 종속되지 않음)
-- ------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint people_name_length check (char_length(name) between 1 and 10)
);

comment on column public.people.name is '참여자가 최초 접속 시 직접 입력하는 이름. 10자 이하 제한.';

alter table public.people enable row level security;

-- people 자체는 trip_id가 없어 직접 격리할 수 없으므로,
-- trip_members를 통해 현재 코드의 여행에 연결된 사람만 노출한다.
create policy "people_select_via_trip_members" on public.people
  for select
  using (
    exists (
      select 1
      from public.trip_members tm
      join public.trips t on t.id = tm.trip_id
      where tm.person_id = people.id
        and t.code = public.current_trip_code()
    )
  );

-- people insert는 의도적으로 열어둠: 이름 문자열만 담는 저위험 테이블이고,
-- 설정 탭에서 새 참여자를 등록할 때 아직 trip_members 연결이 없는 시점에
-- INSERT해야 하므로 trip_code로 사전 검증할 수 없다.
create policy "people_insert_open" on public.people
  for insert
  with check (true);

create policy "people_update_via_trip_members" on public.people
  for update
  using (
    exists (
      select 1
      from public.trip_members tm
      join public.trips t on t.id = tm.trip_id
      where tm.person_id = people.id
        and t.code = public.current_trip_code()
    )
  );

-- ------------------------------------------------------------
-- trip_members (여행별 참여 조인 테이블, 소프트 삭제)
-- ------------------------------------------------------------
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (trip_id, person_id)
);

comment on column public.trip_members.active is 'false면 이 여행에서 비활성화(소프트 삭제). entries 참조 무결성을 위해 하드 삭제하지 않음.';

alter table public.trip_members enable row level security;

create policy "trip_members_select_by_trip_code" on public.trip_members
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "trip_members_insert_by_trip_code" on public.trip_members
  for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "trip_members_update_by_trip_code" on public.trip_members
  for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.code = public.current_trip_code()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.code = public.current_trip_code()
    )
  );

-- ------------------------------------------------------------
-- budgets (예산은 단일 값이 아니라 항목 리스트)
-- ------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  amount numeric not null,
  memo text,
  created_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "budgets_select_by_trip_code" on public.budgets
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = budgets.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "budgets_insert_by_trip_code" on public.budgets
  for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = budgets.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "budgets_update_by_trip_code" on public.budgets
  for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = budgets.trip_id
        and t.code = public.current_trip_code()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = budgets.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "budgets_delete_by_trip_code" on public.budgets
  for delete
  using (
    exists (
      select 1 from public.trips t
      where t.id = budgets.trip_id
        and t.code = public.current_trip_code()
    )
  );

-- ------------------------------------------------------------
-- entries (지출)
-- ------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  title text not null,
  category text not null,
  member_id uuid references public.trip_members(id) on delete set null,
  krw numeric not null,
  cny numeric not null,
  rate numeric,
  source text not null default 'manual',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_source_check check (source in ('text', 'image', 'manual'))
);

comment on column public.entries.member_id is 'null이면 공금. trip_members.id를 참조 (people.id 아님).';

alter table public.entries enable row level security;

create policy "entries_select_by_trip_code" on public.entries
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = entries.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "entries_insert_by_trip_code" on public.entries
  for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = entries.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "entries_update_by_trip_code" on public.entries
  for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = entries.trip_id
        and t.code = public.current_trip_code()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = entries.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "entries_delete_by_trip_code" on public.entries
  for delete
  using (
    exists (
      select 1 from public.trips t
      where t.id = entries.trip_id
        and t.code = public.current_trip_code()
    )
  );

create trigger entries_set_updated_at
  before update on public.entries
  for each row
  execute function extensions.moddatetime('updated_at');

-- ------------------------------------------------------------
-- rates (날짜별 환율 캐시)
-- ------------------------------------------------------------
create table public.rates (
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  rate numeric not null,
  primary key (trip_id, date)
);

alter table public.rates enable row level security;

create policy "rates_select_by_trip_code" on public.rates
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = rates.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "rates_insert_by_trip_code" on public.rates
  for insert
  with check (
    exists (
      select 1 from public.trips t
      where t.id = rates.trip_id
        and t.code = public.current_trip_code()
    )
  );

create policy "rates_update_by_trip_code" on public.rates
  for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = rates.trip_id
        and t.code = public.current_trip_code()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = rates.trip_id
        and t.code = public.current_trip_code()
    )
  );

-- ------------------------------------------------------------
-- 인덱스
-- ------------------------------------------------------------
create index entries_trip_id_date_idx on public.entries (trip_id, date desc);
create index entries_member_id_idx on public.entries (member_id);
create index trip_members_trip_id_idx on public.trip_members (trip_id);
create index budgets_trip_id_idx on public.budgets (trip_id);
