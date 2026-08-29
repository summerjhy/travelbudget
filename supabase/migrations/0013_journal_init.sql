-- ============================================================
-- 비밀친구 관찰일지(travelnote) 초기 스키마
--
-- travelbudget과 같은 Supabase 프로젝트를 공유하지만 완전히 별도의
-- 테이블(journal_ 접두사)과 코드 체계를 쓴다. travelbudget의
-- trips/people/trip_members/entries 등은 이 마이그레이션에서 전혀
-- 건드리지 않는다.
--
-- 인증 없음. 클라이언트는 매 요청에 x-note-code(+ 본인 신원 확인이
-- 필요한 곳은 x-member-id) 헤더를 보내고, RLS가 이 값으로 행을 거른다.
-- travelbudget의 x-trip-code / current_trip_code() 패턴과 동일하다.
-- ============================================================

-- 요청 헤더에서 현재 관찰일지 코드를 읽는 헬퍼.
create or replace function public.current_note_code()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.headers', true)::json->>'x-note-code',
    ''
  );
$$;

-- 요청 헤더에서 "지금 접속한 나 자신"의 trip_member id를 읽는 헬퍼.
-- journal_secret_pairs에서 "내가 관찰하는 대상"만 보이고 "누가 나를
-- 관찰하는지"는 절대 안 보이게 하려면 이 값이 필요하다.
create or replace function public.current_member_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json->>'x-member-id', '')::uuid;
$$;

-- ------------------------------------------------------------
-- journal_trips
-- ------------------------------------------------------------
create table public.journal_trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  start_date date,
  end_date date,
  -- 제비뽑기 실행 시각. null이면 아직 매칭 전.
  matched_at timestamptz,
  -- 전체 공개(마지막날) 시각. 현재는 기록용, 발송 자체는 개인별로 이뤄진다.
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.journal_trips.code is '참여 코드. 관리자가 직접 지정하는 숫자 8자리. travelbudget의 여행 코드와는 독립된 별도 체계.';

alter table public.journal_trips enable row level security;

create policy "journal_trips_select_by_code" on public.journal_trips
  for select
  using (code = public.current_note_code());

-- insert 정책 없음: 생성은 create-journal-trip Edge Function이 service_role로만 한다.

create policy "journal_trips_update_by_code" on public.journal_trips
  for update
  using (code = public.current_note_code())
  with check (code = public.current_note_code());

-- ------------------------------------------------------------
-- journal_people (전역 인물 마스터, travelbudget의 people과 동일한 발상이나 별도 테이블)
-- ------------------------------------------------------------
create table public.journal_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint journal_people_name_length check (char_length(name) between 1 and 10)
);

alter table public.journal_people enable row level security;

-- travelbudget의 people_select_open(마이그레이션 0002)과 동일한 이유로
-- select도 열어둔다: 최초 등록 시 .insert().select()가 방금 넣은 자기
-- 자신을 못 읽는 문제(아직 journal_trip_members 연결이 없어 트립 기반
-- select 정책을 통과 못함)가 있고, insert가 이미 열려있어 select만
-- 막는 건 실질적 보안 이득이 없다.
create policy "journal_people_select_open" on public.journal_people
  for select
  using (true);

-- travelbudget과 같은 이유로 insert는 열어둔다: 최초 등록 시점엔 아직
-- journal_trip_members 연결이 없어 trip_code로 사전 검증할 수 없다.
create policy "journal_people_insert_open" on public.journal_people
  for insert
  with check (true);

create policy "journal_people_update_via_members" on public.journal_people
  for update
  using (
    exists (
      select 1
      from public.journal_trip_members tm
      join public.journal_trips t on t.id = tm.trip_id
      where tm.person_id = journal_people.id
        and t.code = public.current_note_code()
    )
  );

-- ------------------------------------------------------------
-- journal_trip_members (여행별 참여 조인 테이블, 소프트 삭제)
-- ------------------------------------------------------------
create table public.journal_trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.journal_trips(id) on delete cascade,
  person_id uuid not null references public.journal_people(id) on delete cascade,
  emoji text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trip_id, person_id)
);

alter table public.journal_trip_members enable row level security;

create policy "journal_trip_members_select_by_code" on public.journal_trip_members
  for select
  using (
    exists (
      select 1 from public.journal_trips t
      where t.id = journal_trip_members.trip_id
        and t.code = public.current_note_code()
    )
  );

create policy "journal_trip_members_insert_by_code" on public.journal_trip_members
  for insert
  with check (
    exists (
      select 1 from public.journal_trips t
      where t.id = journal_trip_members.trip_id
        and t.code = public.current_note_code()
    )
  );

create policy "journal_trip_members_update_by_code" on public.journal_trip_members
  for update
  using (
    exists (
      select 1 from public.journal_trips t
      where t.id = journal_trip_members.trip_id
        and t.code = public.current_note_code()
    )
  )
  with check (
    exists (
      select 1 from public.journal_trips t
      where t.id = journal_trip_members.trip_id
        and t.code = public.current_note_code()
    )
  );

-- ------------------------------------------------------------
-- journal_secret_pairs (매칭 결과)
--
-- "observer"가 "target"을 관찰한다. 핵심 보안 요구사항: 내가 누구를
-- 관찰하는지는 보이되, 누가 나를 관찰하는지는 절대 안 보여야 한다.
-- 그래서 select 정책이 "observer_member_id = 나 자신"일 때만 허용하고,
-- target 쪽(역방향) 매칭 조건은 아예 정책에 없다 — 즉 target_member_id로
-- 필터링해 "누가 나를 뽑았는지" 알아내는 조회는 항상 빈 결과만 받는다.
--
-- INSERT는 정책 없음: run-journal-matching Edge Function이 관리자
-- 비밀번호를 확인한 뒤 service_role로만 채운다. 클라이언트가 직접 짝을
-- 정하거나 훔쳐볼 방법을 원천적으로 막는다.
-- ------------------------------------------------------------
create table public.journal_secret_pairs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.journal_trips(id) on delete cascade,
  observer_member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  target_member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, observer_member_id),
  constraint journal_secret_pairs_no_self check (observer_member_id <> target_member_id)
);

alter table public.journal_secret_pairs enable row level security;

create policy "journal_secret_pairs_select_own_only" on public.journal_secret_pairs
  for select
  using (
    observer_member_id = public.current_member_id()
    and exists (
      select 1 from public.journal_trips t
      where t.id = journal_secret_pairs.trip_id
        and t.code = public.current_note_code()
    )
  );

-- ------------------------------------------------------------
-- journal_notes (관찰 메모)
-- ------------------------------------------------------------
create table public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.journal_trips(id) on delete cascade,
  author_member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  body text not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint journal_notes_body_not_empty check (char_length(trim(body)) > 0)
);

comment on column public.journal_notes.observed_at is '메모가 관찰한 순간(작성 시각). 화면에 "8월29일 오전8시30분" 식으로 보여주는 값.';

alter table public.journal_notes enable row level security;

-- 본인이 쓴 메모만 조회/수정/삭제할 수 있다. 마지막날 상대에게 넘겨주는
-- 것은 deliver-journal Edge Function이 service_role로 스냅샷을 만들어
-- 처리하므로, 이 테이블의 RLS는 "작성자 본인만"으로 단순하게 유지한다.
create policy "journal_notes_select_own" on public.journal_notes
  for select
  using (
    author_member_id = public.current_member_id()
    and exists (
      select 1 from public.journal_trips t
      where t.id = journal_notes.trip_id
        and t.code = public.current_note_code()
    )
  );

create policy "journal_notes_insert_own" on public.journal_notes
  for insert
  with check (
    author_member_id = public.current_member_id()
    and exists (
      select 1 from public.journal_trips t
      where t.id = journal_notes.trip_id
        and t.code = public.current_note_code()
    )
  );

create policy "journal_notes_update_own" on public.journal_notes
  for update
  using (author_member_id = public.current_member_id())
  with check (author_member_id = public.current_member_id());

create policy "journal_notes_delete_own" on public.journal_notes
  for delete
  using (author_member_id = public.current_member_id());

-- ------------------------------------------------------------
-- journal_deliveries (마지막날 발송 스냅샷)
--
-- 발송 시점의 메모 전체를 텍스트로 스냅샷 떠서 저장한다. author가 발송
-- 이후 메모를 고치거나 지워도 이미 받은 내용은 바뀌지 않아야 하기 때문.
-- INSERT/UPDATE 정책 없음: deliver-journal Edge Function이 service_role로만 쓴다.
-- target(받는 사람)은 자기가 받은 것만 조회할 수 있다.
-- ------------------------------------------------------------
create table public.journal_deliveries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.journal_trips(id) on delete cascade,
  observer_member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  target_member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  body text not null,
  delivered_at timestamptz not null default now(),
  unique (trip_id, observer_member_id)
);

alter table public.journal_deliveries enable row level security;

create policy "journal_deliveries_select_received" on public.journal_deliveries
  for select
  using (
    target_member_id = public.current_member_id()
    and exists (
      select 1 from public.journal_trips t
      where t.id = journal_deliveries.trip_id
        and t.code = public.current_note_code()
    )
  );

-- ------------------------------------------------------------
-- journal_reminders (개인별 알림 설정)
-- ------------------------------------------------------------
create table public.journal_reminders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.journal_trips(id) on delete cascade,
  member_id uuid not null unique references public.journal_trip_members(id) on delete cascade,
  enabled boolean not null default true,
  start_hour int not null default 9 check (start_hour between 0 and 23),
  end_hour int not null default 22 check (end_hour between 0 and 23),
  interval_minutes int not null default 120 check (interval_minutes >= 15),
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.journal_reminders enable row level security;

-- 본인 설정만 보고 고칠 수 있다. send-journal-reminders(발송 크론)는
-- service_role로 전체를 읽으므로 이 정책의 영향을 받지 않는다.
create policy "journal_reminders_select_own" on public.journal_reminders
  for select
  using (member_id = public.current_member_id());

create policy "journal_reminders_insert_own" on public.journal_reminders
  for insert
  with check (member_id = public.current_member_id());

create policy "journal_reminders_update_own" on public.journal_reminders
  for update
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

-- ------------------------------------------------------------
-- journal_push_subscriptions (멤버별 웹푸시 구독 — travelbudget의
-- push_subscriptions와 달리 참여자마다 여러 건 존재)
-- ------------------------------------------------------------
create table public.journal_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.journal_trip_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.journal_push_subscriptions enable row level security;

-- travelbudget의 push_subscriptions와 동일한 이유로 정책을 하나도 두지
-- 않는다: 클라이언트가 직접 읽거나 쓰면 안 되고, 등록/발송 모두 Edge
-- Function이 service_role로만 처리한다.

-- ------------------------------------------------------------
-- 인덱스
-- ------------------------------------------------------------
create index journal_trip_members_trip_id_idx on public.journal_trip_members (trip_id);
create index journal_notes_trip_author_idx on public.journal_notes (trip_id, author_member_id, observed_at desc);
create index journal_secret_pairs_trip_idx on public.journal_secret_pairs (trip_id);
create index journal_push_subscriptions_member_idx on public.journal_push_subscriptions (member_id);
