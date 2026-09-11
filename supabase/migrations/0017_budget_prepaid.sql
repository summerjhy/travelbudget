-- ------------------------------------------------------------
-- 외화 예산의 두 가지 성격
--
-- 0006 은 외화 예산을 전부 "미리 환전한 돈"으로 봤다. 환전 시점 환율(rate)을
-- 박고 amount(원화 환산액)를 고정했다. 그런데 외화로 잡는 예산에는 성격이
-- 다른 두 가지가 섞여 있다.
--
--   1. 미리 환전한 경우 (prepaid = true)
--      이미 환전이 끝나 현금/트래블카드에 그 외화가 들어있다. 시세가 어떻게
--      변하든 지갑의 외화 금액도, 그걸 사느라 치른 원화도 변하지 않는다.
--
--   2. 실시간 환율로 결제되는 경우 (prepaid = false)
--      계좌 연동 카드나 신용카드처럼 결제할 때마다 그날 환율로 환산된다.
--      "이만큼 쓰겠다"는 외화 한도만 정해둔 것이라, 원화 환산액은 시세를
--      따라 계속 달라진다.
--
-- 두 경우 모두 **외화 금액(original_amount)이 진짜**이고, 원화를 어떤 환율로
-- 보여줄지만 다르다. prepaid 면 rate(환전 환율), 아니면 그날 시세를 쓴다.
--
-- 기존 외화 예산 행은 전부 1번(환전한 금액과 환율을 적어 넣은 것)이므로
-- 기본값 true 로 그대로 유지된다. 원화 예산에는 의미가 없는 값이다.
-- ------------------------------------------------------------

alter table public.budgets
  add column if not exists prepaid boolean not null default true;

comment on column public.budgets.prepaid is
  '외화 예산일 때만 의미가 있다. true = 미리 환전해둔 돈(rate 로 원화 고정), false = 실시간 환율로 결제되는 한도(원화는 그날 시세로 환산).';
comment on column public.budgets.rate is
  '환전 시점 환율 (1 currency 당 원화). prepaid = false 면 비어 있고 그날 시세를 쓴다.';
comment on column public.budgets.amount is
  '원화 환산액. prepaid = true 면 original_amount * rate 로 고정된 값이고, false 면 입력 당시 시세로 계산한 참고용 스냅샷이라 화면에서는 그날 시세로 다시 환산한다.';
