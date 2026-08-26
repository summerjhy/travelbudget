import type { Entry } from './types'
import type { MemberWithName } from './useTripMembers'

export interface MoneyTotal {
  krw: number
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

export function computeTotals(entries: Entry[], members: MemberWithName[], budget: number, latestRate: number): Totals {
  const fund: MoneyTotal = { krw: 0, cny: 0, n: 0 }
  const perMember: Record<string, MoneyTotal> = {}
  for (const m of members) perMember[m.id] = { krw: 0, cny: 0, n: 0 }

  for (const e of entries) {
    const bucket = e.member_id && perMember[e.member_id] ? perMember[e.member_id] : fund
    bucket.krw += Number(e.krw)
    bucket.cny += Number(e.cny)
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
    remainCny: latestRate ? remain / latestRate : 0,
    pct: budget ? (fund.krw / budget) * 100 : 0,
    personKrw,
    personCny,
  }
}
