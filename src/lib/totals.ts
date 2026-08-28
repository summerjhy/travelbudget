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
  /** 예산 총액을 외화로 환산한 값. summaryCurrency 가 null(외화 둘 이상)이면 0. */
  budgetCny: number
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

  // member_id 가 있으면 개인 지출이다. 그 사람이 members 에 아직 없더라도
  // (목록이 늦게 로드됐거나 비활성화됐더라도) 절대 공금으로 넘기지 않는다.
  // 예전에는 fund 로 흘려보내서 예산 게이지가 개인 지출까지 먹었다.
  const person: MoneyTotal = { krw: 0, cny: 0, n: 0 }

  for (const e of entries) {
    const inCurrency = !!currency && entryCurrency(e) === currency
    if (e.member_id === null) {
      fund.krw += Number(e.krw)
      if (inCurrency) fund.cny += Number(e.cny)
      fund.n += 1
      continue
    }
    person.krw += Number(e.krw)
    if (inCurrency) person.cny += Number(e.cny)
    person.n += 1

    // 목록에 있는 멤버만 per-member 칸에 쌓는다. 없으면 개인 합계에만 들어간다.
    const bucket = perMember[e.member_id]
    if (bucket) {
      bucket.krw += Number(e.krw)
      if (inCurrency) bucket.cny += Number(e.cny)
      bucket.n += 1
    }
  }

  // 예산과 잔여는 공금만 본다. 개인 지출은 각자 돈이라 공금 예산과 무관하다.
  const remain = budget - fund.krw
  const personKrw = person.krw
  const personCny = person.cny

  return {
    fund,
    perMember,
    budget,
    budgetCny: currency && latestRate ? budget / latestRate : 0,
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
