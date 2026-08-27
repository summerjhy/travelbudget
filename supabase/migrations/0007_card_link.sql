-- ------------------------------------------------------------
-- CODEF 카드 승인내역 연동
--
-- 관리자 본인 카드만 연동한다. connectedId 는 카드사 계정에 접근할 수 있는
-- 자격증명이므로 anon 이 절대 읽지 못하게 한다 — RLS 에 정책을 하나도 두지
-- 않아서 service_role(Edge Function)만 접근 가능하다.
--
-- 카드사 로그인 비밀번호는 저장하지 않는다. CODEF 에 등록할 때 한 번 쓰고
-- connectedId 만 받아 보관한다.
-- ------------------------------------------------------------

create table if not exists public.card_links (
  id uuid primary key default gen_random_uuid(),
  -- 여행에 묶지 않는다. 카드는 사람에게 속하고 여행마다 다시 등록할 이유가 없다.
  label text not null,
  organization text not null,
  connected_id text not null,
  created_at timestamptz not null default now(),
  unique (organization, connected_id)
);

comment on table public.card_links is
  'CODEF connectedId 보관. service_role 전용 — RLS 정책이 없어 anon 은 읽지도 쓰지도 못한다.';
comment on column public.card_links.organization is 'CODEF 기관코드 (카드사).';
comment on column public.card_links.connected_id is
  '카드사 계정 접근 자격증명. 절대 클라이언트로 내보내지 말 것.';

alter table public.card_links enable row level security;
-- 정책 없음 = anon/authenticated 모두 차단. service_role 만 우회한다.

-- ------------------------------------------------------------
-- 이미 불러온 승인건을 다시 넣지 않기 위한 표식
--
-- CODEF 승인번호(resApprovalNo)로 중복을 막는다. 캡쳐로 먼저 넣은 건과
-- 겹치는 것까지는 막지 못하지만(승인번호를 캡쳐에서 못 읽으므로),
-- 같은 내역을 두 번 불러오는 것은 확실히 막는다.
-- ------------------------------------------------------------
alter table public.entries
  add column if not exists approval_no text;

comment on column public.entries.approval_no is
  'CODEF 승인번호. 카드 연동으로 들어온 건에만 있다. 같은 건 재입력 방지용.';

create unique index if not exists entries_trip_approval_uniq
  on public.entries (trip_id, approval_no)
  where approval_no is not null;
