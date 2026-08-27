-- ------------------------------------------------------------
-- 예산을 외화로도 넣을 수 있게
--
-- 트래블카드에 미리 환전해두는 경우가 많다. "3만 TWD를 43.42에 환전했다"
-- 처럼 환전 시점의 금액·환율로 예산이 잡히므로, 나중에 시세가 움직여도
-- 예산은 변하면 안 된다. entries 와 똑같이 통화와 적용환율을 같이 박는다.
--
-- amount 는 지금까지처럼 "원화 환산액"으로 유지한다. 이렇게 하면
-- 예산 합계(useBudgets.total)와 잔여 계산이 손댈 필요 없이 그대로 맞는다.
-- 외화로 입력한 경우 amount = round(original_amount * rate) 로 채운다.
--
-- 예산은 여러 통화를 섞어 넣어도 하나의 원화 모집합이다. 지갑을 나누지
-- 않는다 — 현금이든 트래블카드든 여행 동안 쓸 총액은 하나이기 때문이다.
-- ------------------------------------------------------------

alter table public.budgets
  add column if not exists currency text not null default 'KRW';

alter table public.budgets
  add column if not exists original_amount numeric;

alter table public.budgets
  add column if not exists rate numeric;

comment on column public.budgets.amount is
  '원화 환산액. 외화로 넣었으면 original_amount * rate 를 반올림한 값. 합계·잔여는 항상 이 값으로 낸다.';
comment on column public.budgets.currency is
  '입력할 때 쓴 통화. KRW 면 original_amount/rate 는 비어 있다.';
comment on column public.budgets.original_amount is
  '입력한 그대로의 외화 금액 (예: 30000 TWD). 화면에 되돌려 보여주기 위한 값.';
comment on column public.budgets.rate is
  '환전 시점 환율 (1 currency 당 원화). 이 값으로 고정돼 시세가 변해도 예산은 그대로다.';

-- 기존 행은 전부 원화로 넣은 것이다.
update public.budgets set currency = 'KRW' where currency is null;
