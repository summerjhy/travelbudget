-- ------------------------------------------------------------
-- 결제수단 · 결제자
--
-- member_id 와 paid_by 는 뜻이 다르다:
--   member_id : 회계 성격. null 이면 공금, 값이 있으면 그 사람 개인 지출.
--   paid_by   : 실제로 그 자리에서 돈을 낸 사람.
-- "공금인데 카드는 소영이 긁었다" 같은 경우를 표현하려면 둘 다 필요하다.
--
-- paid_by 는 nullable 이다. 이 컬럼이 생기기 전 기록은 누가 냈는지 알 수 없고,
-- 억지로 채우면 없는 사실을 지어내는 셈이라 null 로 두고 화면에서 '-' 로 보여준다.
-- ------------------------------------------------------------

alter table public.entries
  add column if not exists payment_method text not null default 'cash';

alter table public.entries
  add column if not exists paid_by uuid references public.trip_members(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entries_payment_method_check'
  ) then
    alter table public.entries
      add constraint entries_payment_method_check
      check (payment_method in ('cash', 'credit', 'travel'));
  end if;
end $$;

comment on column public.entries.payment_method is
  '결제수단: cash(현금) / credit(신용카드) / travel(트래블카드).';
comment on column public.entries.paid_by is
  '실제로 돈을 낸 사람 (trip_members.id). member_id 와 다르다 — member_id 는 공금/개인 회계 구분이고 이건 결제자다. 옛 기록은 알 수 없어 null.';

create index if not exists entries_paid_by_idx on public.entries (paid_by);
