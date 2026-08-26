import type { Trip } from './types'

/** 이 앱의 기준 통화. entries.krw / budgets.amount 는 항상 이 통화다. */
export const BASE_CURRENCY = 'KRW'

/**
 * 여행에서 고를 수 있는 통화 목록. 외화가 앞, 원화가 맨 뒤.
 *
 * `trips.spend_currencies` 에 원화가 없어도(예전 여행은 `['CNY']`) 원화는 항상 넣는다.
 * 해외에서도 원화로 결제하는 건이 있기 때문이다.
 */
export function tripCurrencies(trip: Trip | null | undefined): string[] {
  const listed = (trip?.spend_currencies ?? []).filter(Boolean)
  const foreign = listed.filter((c) => c !== BASE_CURRENCY)
  return [...new Set([...foreign, BASE_CURRENCY])]
}

/** 여행의 외화들 (원화 제외). 환율 조회 대상이기도 하다. */
export function foreignCurrencies(trip: Trip | null | undefined): string[] {
  return tripCurrencies(trip).filter((c) => c !== BASE_CURRENCY)
}

/**
 * 기본으로 잡히는 통화 — 그 여행에서 주로 쓰는 돈.
 * 목적지 나라 통화가 `spend_currencies` 앞쪽에 오므로 그 첫 번째를 쓴다.
 * 외화가 아예 없는(국내) 여행이면 원화.
 */
export function defaultCurrency(trip: Trip | null | undefined): string {
  return foreignCurrencies(trip)[0] ?? BASE_CURRENCY
}

/**
 * 합계·잔여를 원화와 나란히 병기할 수 있는 통화. 외화가 정확히 하나일 때만 가능하다.
 * 외화가 둘 이상이면 서로 다른 통화를 더한 값은 뜻이 없으므로 null (원화만 보여준다).
 */
export function summaryCurrency(trip: Trip | null | undefined): string | null {
  const foreign = foreignCurrencies(trip)
  return foreign.length === 1 ? foreign[0] : null
}
