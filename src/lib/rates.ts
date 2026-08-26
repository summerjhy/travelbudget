export interface ResolvedAmount {
  krw: number
  cny: number
  rate: number | null
}

/**
 * 위안/원화 중 입력된 값과 그 날짜의 캐시 환율(ratesByDate)로 나머지 금액을 계산한다.
 * 4단계(MVP) 범위: 외부 API 조회는 하지 않는다. rates에 값이 없고 한쪽만
 * 입력됐다면 계산 불가(rate: null, 입력되지 않은 쪽은 0)로 반환한다.
 */
export function resolveAmount(
  input: { krw?: number; cny?: number },
  date: string,
  ratesByDate: Record<string, number>,
): ResolvedAmount {
  const krwIn = input.krw ?? 0
  const cnyIn = input.cny ?? 0

  if (krwIn > 0 && cnyIn > 0) {
    const rate = krwIn / cnyIn
    return { krw: Math.round(krwIn), cny: Math.round(cnyIn * 100) / 100, rate: Math.round(rate * 100) / 100 }
  }

  const cachedRate = ratesByDate[date] ?? null
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
