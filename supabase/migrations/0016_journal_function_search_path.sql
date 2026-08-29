-- linter 경고(function_search_path_mutable) 해소: 관찰일지 전용 함수는
-- search_path를 고정한다. 가계부의 current_trip_code()는 기존 함수라
-- 이 마이그레이션 스코프 밖이다(건드리지 않음).

create or replace function public.current_note_code()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    current_setting('request.headers', true)::json->>'x-note-code',
    ''
  );
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true)::json->>'x-member-id', '')::uuid;
$$;
