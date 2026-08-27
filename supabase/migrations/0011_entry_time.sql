-- ------------------------------------------------------------
-- 입력 시각 (타임라인)
--
-- entries.date 는 날짜만 갖고 있어 하루 안에서 몇 시에 썼는지는 알 수 없었다.
-- created_at 은 실제 지출 시각과 다를 수 있다 — 오프라인 큐에 쌓였다가
-- 나중에 온라인 복귀 시 동기화되면 created_at 은 동기화된 시각이 된다.
-- 그래서 클라이언트가 저장하는 순간 여행 목적지 시간대 기준으로 직접
-- 채우는 별도 컬럼을 둔다. 초는 필요 없어 'HH:MM' 문자열로만 저장한다.
--
-- nullable: 이 컬럼이 생기기 전 기록은 시각을 알 수 없어 null 이고,
-- 화면에서는 시각 없이 날짜만 보여준다(옛 통화 null 처리와 같은 방식).
-- ------------------------------------------------------------

alter table public.entries
  add column if not exists time text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_time_format_check'
  ) then
    alter table public.entries
      add constraint entries_time_format_check
      check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end $$;

comment on column public.entries.time is
  '입력 시각(현지 시간, HH:MM). 여행 목적지 시간대 기준으로 클라이언트가 저장 시점에 채운다. 옛 행은 null.';
