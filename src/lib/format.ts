import { currencyNeedsSpace, currencySuffix } from './currencies'

export function won(n: number | null | undefined): string {
  return '₩' + Math.round(n || 0).toLocaleString('ko-KR')
}

/**
 * 외화 금액. 통화 코드는 여행마다 다르므로(trips.spend_currencies) 반드시 넘겨야 한다.
 * `380元`, `380 TWD` 처럼 통화별 표기로 찍는다.
 */
export function foreign(n: number | null | undefined, code: string): string {
  const num = (Math.round((n || 0) * 100) / 100).toLocaleString('ko-KR', {
    maximumFractionDigits: 2,
  })
  return num + (currencyNeedsSpace(code) ? ' ' : '') + currencySuffix(code)
}
