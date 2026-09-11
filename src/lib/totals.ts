import type { Budget, Entry } from './types'
import type { MemberWithName } from './useTripMembers'
import { BASE_CURRENCY } from './tripCurrency'

export interface MoneyTotal {
  krw: number
  /** 외화 합계. summaryCurrency 가 null(외화 둘 이상)이면 0으로 둔다. */
  cny: number
  n: number
}

/**
 * 통화별 공금 주머니. 이미 환전해둔 돈이라 금액은 그 통화로 고정이고,
 * 잔여를 낼 때 환율을 쓰지 않는다.
 */
export interface Pot {
  currency: string
  budget: number
  spent: number
  remain: number
  pct: number
}

export interface Totals {
  fund: MoneyTotal
  perMember: Record<string, MoneyTotal>
  pots: Pot[]
  personKrw: number
  personCny: number
}

/** currency 컬럼이 생기기 전(마이그레이션 0003) 행은 전부 위안이었다. */
export function entryCurrency(e: Pick<Entry, 'currency'>): string {
  return e.currency ?? 'CNY'
}

/** currency 컬럼이 생기기 전(마이그레이션 0004) 예산은 전부 원화였다. */
export function budgetCurrency(b: Pick<Budget, 'currency'>): string {
  return b.currency ?? BASE_CURRENCY
}

/**
 * 공금 지출이 어느 주머니에서 빠지는지.
 *
 * 그 통화 주머니가 있으면 원금 그대로 거기서 빠진다. 없으면 원화 주머니에서
 * `entries.krw`(저장 시점 환율로 이미 환산된 값)만큼 빠진다 — 예산이 전부 원화인
 * 기존 여행은 이 두 번째 경로를 타서 지금까지와 똑같이 동작한다.
 */
function drawFrom(e: Entry, budgetByCurrency: Record<string, number>): { currency: string; amount: number } {
  const c = entryCurrency(e)
  if (budgetByCurrency[c] !== undefined) return { currency: c, amount: Number(e.cny) }
  return { currency: BASE_CURRENCY, amount: Number(e.krw) }
}

/**
 * 합계와 주머니별 잔여를 낸다.
 *
 * 개인 결제 합계(`perMember`)와 공금 합계(`fund`)는 원화 기준이고, 외화는 여행의
 * 외화가 정확히 하나일 때만 병기한다 — 섞여 있으면 서로 다른 돈을 더한 수가 된다.
 *
 * @param summaryCurrency 병기할 외화 (tripCurrency.summaryCurrency). 둘 이상이면 null.
 */
export function computeTotals(
  entries: Entry[],
  members: MemberWithName[],
  budgets: Pick<Budget, 'amount' | 'currency'>[],
  summaryCurrency: string | null,
): Totals {
  const fund: MoneyTotal = { krw: 0, cny: 0, n: 0 }
  const perMember: Record<string, MoneyTotal> = {}
  for (const m of members) perMember[m.id] = { krw: 0, cny: 0, n: 0 }

  const budgetByCurrency: Record<string, number> = {}
  for (const b of budgets) {
    const c = budgetCurrency(b)
    budgetByCurrency[c] = (budgetByCurrency[c] ?? 0) + Number(b.amount)
  }

  const spentByCurrency: Record<string, number> = {}
  for (const e of entries) {
    const bucket = e.member_id && perMember[e.member_id] ? perMember[e.member_id] : fund
    bucket.krw += Number(e.krw)
    if (summaryCurrency && entryCurrency(e) === summaryCurrency) bucket.cny += Number(e.cny)
    bucket.n += 1

    // 주머니를 축내는 건 공금 지출뿐이다. 개인 결제는 각자 돈이라 예산과 무관하다.
    if (e.member_id && perMember[e.member_id]) continue
    const draw = drawFrom(e, budgetByCurrency)
    spentByCurrency[draw.currency] = (spentByCurrency[draw.currency] ?? 0) + draw.amount
  }

  const currencies = [...new Set([...Object.keys(budgetByCurrency), ...Object.keys(spentByCurrency)])]
  // 외화 주머니를 앞에, 원화를 맨 뒤에 — 화면에서 여행지 돈이 먼저 보이는 게 자연스럽다.
  currencies.sort((a, b) => (a === BASE_CURRENCY ? 1 : 0) - (b === BASE_CURRENCY ? 1 : 0))

  const pots: Pot[] = currencies.map((currency) => {
    const budget = budgetByCurrency[currency] ?? 0
    const spent = spentByCurrency[currency] ?? 0
    return { currency, budget, spent, remain: budget - spent, pct: budget ? (spent / budget) * 100 : 0 }
  })

  return {
    fund,
    perMember,
    pots,
    personKrw: members.reduce((sum, m) => sum + (perMember[m.id]?.krw ?? 0), 0),
    personCny: members.reduce((sum, m) => sum + (perMember[m.id]?.cny ?? 0), 0),
  }
}
