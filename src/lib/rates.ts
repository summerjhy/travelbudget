import { BASE_CURRENCY } from './tripCurrency'

/** 날짜 → 통화 → 환율(1 통화당 원화). */
export type RateTable = Record<string, Record<string, number>>

export interface ResolvedAmount {
  krw: number
  /** 외화 금액 (entries.cny 컬럼). currency 가 KRW 면 krw 와 같다. */
  cny: number
  rate: number | null
}

export function rateFor(rates: RateTable, date: string, currency: string): number | null {
  if (currency === BASE_CURRENCY) return 1
  return rates[date]?.[currency] ?? null
}

/** 그 통화로 저장된 값 중 가장 최근 날짜의 환율. 미리보기 환산과 잔여 예산 표시에 쓴다. */
export function latestRateFor(rates: RateTable, currency: string | null): number {
  if (!currency) return 0
  if (currency === BASE_CURRENCY) return 1
  const dates = Object.keys(rates)
    .filter((d) => rates[d]?.[currency] !== undefined)
    .sort()
  return dates.length ? rates[dates[dates.length - 1]][currency] : 0
}

/**
 * 외화/원화 중 입력된 값과 그 날짜·통화의 환율로 나머지 금액을 계산한다.
 * 둘 다 들어오면 실제 청구 환율을 역산해서 쓴다 (SPEC 5장 우선순위 1번).
 * 환율을 모르고 한쪽만 입력됐으면 계산 불가(rate: null)로 돌려준다.
 */
export function resolveAmount(
  input: { krw?: number; cny?: number },
  date: string,
  currency: string,
  rates: RateTable,
): ResolvedAmount {
  const krwIn = input.krw ?? 0
  const cnyIn = input.cny ?? 0

  // 원화로 낸 건이면 환산할 게 없다. 외화 칸에도 같은 값을 넣어 합계가 어긋나지 않게 한다.
  if (currency === BASE_CURRENCY) {
    const amount = Math.round(krwIn || cnyIn)
    return { krw: amount, cny: amount, rate: 1 }
  }

  if (krwIn > 0 && cnyIn > 0) {
    const rate = krwIn / cnyIn
    return { krw: Math.round(krwIn), cny: Math.round(cnyIn * 100) / 100, rate: Math.round(rate * 100) / 100 }
  }

  const cachedRate = rateFor(rates, date, currency)
  if (cachedRate === null) {
    return { krw: Math.round(krwIn), cny: Math.round(cnyIn * 100) / 100, rate: null }
  }

  if (cnyIn > 0 && !krwIn) {
    return {
      krw: Math.round(cnyIn * cachedRate),
      cny: Math.round(cnyIn * 100) / 100,
      rate: cachedRate,
    }
  }
  if (krwIn > 0 && !cnyIn) {
    return {
      krw: Math.round(krwIn),
      cny: Math.round((krwIn / cachedRate) * 100) / 100,
      rate: cachedRate,
    }
  }

  return { krw: 0, cny: 0, rate: cachedRate }
}
