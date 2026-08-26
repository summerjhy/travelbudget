import type { Entry } from './types'
import type { MemberWithName } from './useTripMembers'

export interface MoneyTotal {
  krw: number
  /** 외화 합계. summaryCurrency 가 null(외화 둘 이상)이면 0으로 둔다. */
  cny: number
  n: number
}

export interface Totals {
  fund: MoneyTotal
  perMember: Record<string, MoneyTotal>
  budget: number
  remain: number
  remainCny: number
  pct: number
  personKrw: number
  personCny: number
}

/**
 * 합계는 언제나 원화 기준이다. 원화와 나란히 병기할 외화 합계는 여행의 외화가
 * 정확히 하나일 때만 계산한다 — 통화가 섞여 있으면 서로 다른 돈을 더한 수가 되어버린다.
 *
 * @param currency 병기할 외화 (tripCurrency.summaryCurrency). 둘 이상이면 null.
 * @param latestRate 그 외화의 최근 환율. 잔여 예산을 외화로 환산할 때 쓴다.
 */
export function computeTotals(
  entries: Entry[],
  members: MemberWithName[],
  budget: number,
  currency: string | null,
  latestRate: number,
): Totals {
  const fund: MoneyTotal = { krw: 0, cny: 0, n: 0 }
  const perMember: Record<string, MoneyTotal> = {}
  for (const m of members) perMember[m.id] = { krw: 0, cny: 0, n: 0 }

  for (const e of entries) {
    const bucket = e.member_id && perMember[e.member_id] ? perMember[e.member_id] : fund
    bucket.krw += Number(e.krw)
    if (currency && entryCurrency(e) === currency) bucket.cny += Number(e.cny)
    bucket.n += 1
  }

  const remain = budget - fund.krw
  const personKrw = members.reduce((sum, m) => sum + (perMember[m.id]?.krw ?? 0), 0)
  const personCny = members.reduce((sum, m) => sum + (perMember[m.id]?.cny ?? 0), 0)

  return {
    fund,
    perMember,
    budget,
    remain,
    remainCny: currency && latestRate ? remain / latestRate : 0,
    pct: budget ? (fund.krw / budget) * 100 : 0,
    personKrw,
    personCny,
  }
}

/** currency 컬럼이 생기기 전(마이그레이션 0003) 행은 전부 위안이었다. */
export function entryCurrency(e: Pick<Entry, 'currency'>): string {
  return e.currency ?? 'CNY'
}
