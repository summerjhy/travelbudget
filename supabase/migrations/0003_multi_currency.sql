-- ------------------------------------------------------------
-- 여러 통화를 쓰는 여행 지원
--
-- 지금까지는 "외화 = 위안" 전제였다. entries.cny 는 외화 금액을 담고 있었지만
-- 어느 통화인지는 어디에도 없었고, rates 는 (trip_id, date) 하나당 환율 하나만
-- 가질 수 있어서 한 여행에서 두 나라를 도는 경우를 표현할 수 없었다.
--
-- 두 테이블에 currency 를 추가한다. 기존 행은 전부 위안이었으므로 기본값 'CNY'
-- 로 그대로 채워지고, 기존 여행의 동작은 달라지지 않는다.
--
-- NOTE: entries.cny 는 컬럼 이름만 남긴다. 실제 의미는 "entries.currency 통화로
-- 표시한 금액"이다. 이름을 바꾸면 배포 중인 클라이언트(오프라인 큐에 쌓인 항목
-- 포함)가 깨지므로 이름은 두고 주석으로 뜻을 박아둔다.
-- ------------------------------------------------------------

alter table public.entries
  add column if not exists currency text not null default 'CNY';

comment on column public.entries.cny is
  '외화 금액. 어느 통화인지는 entries.currency 를 봐야 한다 (이름은 위안만 쓰던 시절의 잔재).';
comment on column public.entries.currency is
  '외화 금액(cny 컬럼)의 통화 코드. 원화로 낸 건이면 KRW 이고 이때 cny = krw.';
comment on column public.entries.rate is
  '이 건에 적용된 환율. 1 currency 당 원화.';

-- rates: (trip_id, date) → (trip_id, date, currency) 로 기본키 확장
alter table public.rates
  add column if not exists currency text not null default 'CNY';

alter table public.rates drop constraint if exists rates_pkey;
alter table public.rates add primary key (trip_id, date, currency);

comment on column public.rates.rate is '1 currency 당 원화.';
