import type { Budget, Entry } from './types'
import type { MemberWithName } from './useTripMembers'
import type { RateTable } from './rates'
import { latestRateFor } from './rates'
import { BASE_CURRENCY } from './tripCurrency'

export interface MoneyTotal {
  krw: number
  /** 외화 합계. summaryCurrency 가 null(외화 둘 이상)이면 0으로 둔다. */
  cny: number
  n: number
}

/**
 * 통화별 공금 주머니.
 *
 * 외화 예산은 **외화 금액이 진짜**다. 원화는 그걸 어떤 환율로 보여주느냐일 뿐이라
 * (prepaid 면 환전 환율, 아니면 그날 시세) 잔여도 외화에서 외화를 빼서 낸다.
 * 예전처럼 원화 잔여를 시세로 되나누면 지갑에 없는 숫자가 나온다 —
 * 45.38 에 환전한 15,425 TWD 가 시세 40 일 때 17,499 TWD 로 보이던 문제.
 */
export interface Pot {
  currency: string
  /** 외화 예산 총액. 원화 주머니면 0. */
  budgetForeign: number
  budgetKrw: number
  spentForeign: number
  spentKrw: number
  remainForeign: number
  remainKrw: number
  pct: number
  /** 미리 환전해둔 현금인지. 표시 문구에만 쓴다. */
  prepaid: boolean
}

export interface Totals {
  fund: MoneyTotal
  perMember: Record<string, MoneyTotal>
  pots: Pot[]
  budget: number
  /** 예산 총액을 외화로 본 값. summaryCurrency 주머니의 외화 예산이다. */
  budgetCny: number
  remain: number
  remainCny: number
  pct: number
  personKrw: number
  personCny: number
}

/** currency 컬럼이 생기기 전(마이그레이션 0003) 행은 전부 위안이었다. */
export function entryCurrency(e: Pick<Entry, 'currency'>): string {
  return e.currency ?? 'CNY'
}

/** 0017 이전 외화 예산은 전부 "미리 환전한 금액과 환율"을 적어 넣은 것이다. */
export function isPrepaid(b: Pick<Budget, 'prepaid'>): boolean {
  return b.prepaid ?? true
}

/**
 * 이 예산 한 건의 1 통화당 원화.
 * 미리 환전했으면 그때 환율로 고정, 아니면 그날 시세를 따라간다.
 */
function krwPerUnit(b: Budget, rates: RateTable): number {
  const cur = b.currency ?? BASE_CURRENCY
  if (cur === BASE_CURRENCY) return 1
  if (isPrepaid(b)) return Number(b.rate) || 0
  return latestRateFor(rates, cur)
}

/** 예산 총액(원화). 실시간 환율 예산은 그날 시세로 다시 환산한다. */
export function budgetTotalKrw(budgets: Budget[], rates: RateTable): number {
  let sum = 0
  for (const b of budgets) {
    const cur = b.currency ?? BASE_CURRENCY
    if (cur === BASE_CURRENCY || b.original_amount === null) {
      sum += Number(b.amount)
      continue
    }
    const rate = krwPerUnit(b, rates)
    // 시세를 아직 한 번도 못 받아왔으면 저장해둔 스냅샷으로 버틴다.
    sum += rate > 0 ? Number(b.original_amount) * rate : Number(b.amount)
  }
  return Math.round(sum)
}

/**
 * 합계와 통화별 주머니를 낸다.
 *
 * 공금 지출은 그 통화 주머니가 있으면 외화 원금 그대로 거기서 빠지고,
 * 없으면 원화 주머니에서 entries.krw 만큼 빠진다. 두 번째 규칙 덕분에
 * 예산이 전부 원화인 기존 여행은 지금까지와 똑같이 동작한다.
 *
 * @param currency 원화 옆에 병기할 외화 (tripCurrency.summaryCurrency). 둘 이상이면 null.
 */
export function computeTotals(
  entries: Entry[],
  members: MemberWithName[],
  budgets: Budget[],
  rates: RateTable,
  currency: string | null,
): Totals {
  const fund: MoneyTotal = { krw: 0, cny: 0, n: 0 }
  const perMember: Record<string, MoneyTotal> = {}
  for (const m of members) perMember[m.id] = { krw: 0, cny: 0, n: 0 }

  // member_id 가 있으면 개인 지출이다. 그 사람이 members 에 아직 없더라도
  // (목록이 늦게 로드됐거나 비활성화됐더라도) 절대 공금으로 넘기지 않는다.
  const person: MoneyTotal = { krw: 0, cny: 0, n: 0 }

  // --- 주머니 만들기
  interface Acc {
    currency: string
    budgetForeign: number
    budgetKrw: number
    spentForeign: number
    spentKrw: number
    prepaid: boolean
    rateSum: number
    rateWeight: number
  }
  const acc = new Map<string, Acc>()
  const get = (cur: string): Acc => {
    let a = acc.get(cur)
    if (!a) {
      a = { currency: cur, budgetForeign: 0, budgetKrw: 0, spentForeign: 0, spentKrw: 0, prepaid: true, rateSum: 0, rateWeight: 0 }
      acc.set(cur, a)
    }
    return a
  }

  for (const b of budgets) {
    const cur = b.currency ?? BASE_CURRENCY
    const a = get(cur)
    if (cur === BASE_CURRENCY || b.original_amount === null) {
      a.budgetKrw += Number(b.amount)
      continue
    }
    const amount = Number(b.original_amount)
    const rate = krwPerUnit(b, rates)
    a.budgetForeign += amount
    a.budgetKrw += rate > 0 ? amount * rate : Number(b.amount)
    // 여러 번 나눠 환전했으면 가중평균 환율을 쓴다.
    if (rate > 0) {
      a.rateSum += amount * rate
      a.rateWeight += amount
    }
    if (!isPrepaid(b)) a.prepaid = false
  }

  // --- 지출 나누기
  for (const e of entries) {
    const inCurrency = !!currency && entryCurrency(e) === currency
    if (e.member_id === null) {
      fund.krw += Number(e.krw)
      if (inCurrency) fund.cny += Number(e.cny)
      fund.n += 1

      const cur = entryCurrency(e)
      const pot = acc.get(cur)
      if (pot && pot.budgetForeign > 0) {
        pot.spentForeign += Number(e.cny)
        pot.spentKrw += Number(e.krw)
      } else {
        const krwPot = get(BASE_CURRENCY)
        krwPot.spentKrw += Number(e.krw)
      }
      continue
    }
    person.krw += Number(e.krw)
    if (inCurrency) person.cny += Number(e.cny)
    person.n += 1

    const bucket = perMember[e.member_id]
    if (bucket) {
      bucket.krw += Number(e.krw)
      if (inCurrency) bucket.cny += Number(e.cny)
      bucket.n += 1
    }
  }

  const pots: Pot[] = [...acc.values()]
    .map((a) => {
      const isForeign = a.currency !== BASE_CURRENCY && a.budgetForeign > 0
      const avgRate = a.rateWeight > 0 ? a.rateSum / a.rateWeight : 0
      const remainForeign = a.budgetForeign - a.spentForeign
      return {
        currency: a.currency,
        budgetForeign: a.budgetForeign,
        budgetKrw: Math.round(a.budgetKrw),
        spentForeign: a.spentForeign,
        spentKrw: Math.round(a.spentKrw),
        remainForeign,
        // 외화 주머니의 잔여 원화는 남은 외화를 그 주머니 환율로 되돌린 값이다.
        // 결제건마다 카드사 환율이 달라도 지갑 현금과 어긋나지 않는다.
        remainKrw: isForeign ? Math.round(remainForeign * avgRate) : Math.round(a.budgetKrw - a.spentKrw),
        pct: a.budgetForeign > 0
          ? (a.spentForeign / a.budgetForeign) * 100
          : a.budgetKrw > 0 ? (a.spentKrw / a.budgetKrw) * 100 : 0,
        prepaid: a.prepaid,
      }
    })
    // 빈 원화 주머니는 숨긴다 (외화만 쓰는 여행에서 0원짜리 줄이 뜨지 않도록).
    .filter((p) => p.budgetKrw !== 0 || p.spentKrw !== 0 || p.budgetForeign !== 0)
    // 외화를 앞에, 원화를 뒤에 — 여행지 돈이 먼저 보이는 게 자연스럽다.
    .sort((a, b) => (a.currency === BASE_CURRENCY ? 1 : 0) - (b.currency === BASE_CURRENCY ? 1 : 0))

  const budget = pots.reduce((sum, p) => sum + p.budgetKrw, 0)
  const remain = pots.reduce((sum, p) => sum + p.remainKrw, 0)
  const summaryPot = currency ? pots.find((p) => p.currency === currency) : undefined

  return {
    fund,
    perMember,
    pots,
    budget,
    budgetCny: summaryPot?.budgetForeign ?? 0,
    remain,
    remainCny: summaryPot?.remainForeign ?? 0,
    pct: budget ? (fund.krw / budget) * 100 : 0,
    personKrw: person.krw,
    personCny: person.cny,
  }
}
