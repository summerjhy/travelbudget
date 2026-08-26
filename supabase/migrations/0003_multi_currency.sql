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

-- ------------------------------------------------------------
-- 옛 fetch-rate 가 남긴 잘못된 환율 정리
--
-- 이전 fetch-rate 는 여행 통화와 무관하게 `from=CNY` 로 하드코딩돼 있었다.
-- 그래서 위안을 쓰지 않는 여행에도 위안 환율이 저장됐다 (실제로 대만(TWD)
-- 여행에 205 짜리 위안 환율 두 건이 들어가 있었다. 실제 TWD 는 약 43 이다).
--
-- 위에서 currency 기본값을 'CNY' 로 채우면 그 행들이 "위안 환율"로 굳는다.
-- 그 여행이 쓰지 않는 통화의 환율은 애초에 틀린 값이므로 지운다.
-- rates 는 날짜별 조회 캐시일 뿐 다른 테이블이 참조하지 않아 지워도 안전하고,
-- 필요하면 설정 탭에서 다시 조회하면 된다.
--
-- 새 DB 에 처음부터 적용하면 해당 행이 없어 아무것도 지우지 않는다.
-- ------------------------------------------------------------
delete from public.rates r
using public.trips t
where t.id = r.trip_id
  and r.currency <> all (t.spend_currencies)
  and r.currency <> 'KRW';
