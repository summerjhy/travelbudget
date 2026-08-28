import type { Entry } from './types'
import type { MemberWithName } from './useTripMembers'

export interface DailyFundTotal {
  date: string
  krw: number
  n: number
}

export interface CategoryFundTotal {
  category: string
  krw: number
  n: number
}

export interface BudgetAnalysis {
  budget: number
  fund: number
  fundN: number
  /** fund - budget. 양수면 초과, 음수면 잔여. */
  diff: number
  /** diff / n. 안내 문구 표시용(실제 이체 계산은 net 쪽에서 한다). */
  perMemberAdjustment: number
}

export interface PersonalExpense {
  memberId: string
  name: string
  krw: number
  n: number
}

export interface PayerSummary {
  memberId: string
  name: string
  paidTotal: number
  paidTotalN: number
  /** paidTotal 중 본인 개인경비를 본인이 낸 부분을 뺀 나머지(공금 결제 + 남의 개인경비 대신 결제). */
  otherBurdenPaid: number
  otherBurdenPaidN: number
}

export interface SettlementTransfer {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export interface SettlementResult {
  memberCount: number
  fundByDate: DailyFundTotal[]
  fundByCategory: CategoryFundTotal[]
  budgetAnalysis: BudgetAnalysis
  personalExpenses: PersonalExpense[]
  payerSummaries: PayerSummary[]
  transfers: SettlementTransfer[]
  warnings: string[]
}

const EMPTY_RESULT: SettlementResult = {
  memberCount: 0,
  fundByDate: [],
  fundByCategory: [],
  budgetAnalysis: { budget: 0, fund: 0, fundN: 0, diff: 0, perMemberAdjustment: 0 },
  personalExpenses: [],
  payerSummaries: [],
  transfers: [],
  warnings: ['참여자가 없어서 정산할 수 없어요.'],
}

/**
 * 최종 정산 계산.
 *
 * 핵심 공식(CLAUDE.md 14단계 이후 정산 기능 설계 참고):
 *   fair(P)    = personal(P) + fund/n           // 정당히 부담할 몫
 *   paidRaw(P) = paid_by === P 인 entry 합       // 실제로 결제한 총액
 *   net(P)     = fair(P) - paidRaw(P) - budget/n + (총무면 budget)
 *
 * fund(공금 실사용액)와 budget(예산 총액)은 서로 다른 자금 흐름이라 절대
 * 하나의 항으로 섞지 않는다 — 섞으면 sum(net)이 0이 되지 않는다(검증 완료).
 * net > 0 이면 빚(더 내야 함), net < 0 이면 채권(돌려받아야 함).
 */
export function computeSettlement(
  entries: Entry[],
  members: MemberWithName[],
  budget: number,
  treasurerId: string | null,
): SettlementResult {
  const n = members.length
  if (n === 0) return EMPTY_RESULT

  const warnings: string[] = []
  const memberIds = new Set(members.map((m) => m.id))

  // ---- 1. 공금 총액 (일자별 / 카테고리별) ----
  const fundEntries = entries.filter((e) => e.member_id === null)
  const fund = fundEntries.reduce((s, e) => s + Number(e.krw), 0)

  const byDate = new Map<string, { krw: number; n: number }>()
  for (const e of fundEntries) {
    const d = byDate.get(e.date) ?? { krw: 0, n: 0 }
    d.krw += Number(e.krw)
    d.n += 1
    byDate.set(e.date, d)
  }
  const fundByDate: DailyFundTotal[] = [...byDate.entries()]
    .map(([date, v]) => ({ date, krw: v.krw, n: v.n }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const byCategory = new Map<string, { krw: number; n: number }>()
  for (const e of fundEntries) {
    const c = byCategory.get(e.category) ?? { krw: 0, n: 0 }
    c.krw += Number(e.krw)
    c.n += 1
    byCategory.set(e.category, c)
  }
  const fundByCategory: CategoryFundTotal[] = [...byCategory.entries()]
    .map(([category, v]) => ({ category, krw: v.krw, n: v.n }))
    .sort((a, b) => b.krw - a.krw)

  // ---- 2. 예산 대비 분석 ----
  const diff = fund - budget
  const budgetAnalysis: BudgetAnalysis = {
    budget,
    fund,
    fundN: fundEntries.length,
    diff,
    perMemberAdjustment: diff / n,
  }
  if (budget === 0) warnings.push('예산이 아직 등록되지 않았어요. 전액이 초과로 표시돼요.')
  if (!treasurerId) {
    warnings.push('모임통장 관리자가 지정되지 않아 예산 잔여/초과분은 정산에 반영되지 않았어요.')
  }

  // ---- 3. 개인경비 지출 현황 ----
  const personal = new Map<string, number>()
  const personalN = new Map<string, number>()
  for (const e of entries) {
    if (e.member_id === null) continue
    personal.set(e.member_id, (personal.get(e.member_id) ?? 0) + Number(e.krw))
    personalN.set(e.member_id, (personalN.get(e.member_id) ?? 0) + 1)
    if (!memberIds.has(e.member_id)) {
      // 비활성/탈퇴 멤버 몫 지출. 참고 정보로만 남기고 이체 계산에는 못 들어간다
      // (활성 멤버만 이체 주체가 되므로 — Edge Case).
    }
  }
  const personalExpenses: PersonalExpense[] = members.map((m) => ({
    memberId: m.id,
    name: m.displayName,
    krw: personal.get(m.id) ?? 0,
    n: personalN.get(m.id) ?? 0,
  }))
  const unassignedPersonal = [...personal.entries()]
    .filter(([id]) => !memberIds.has(id))
    .reduce((s, [, v]) => s + v, 0)
  if (unassignedPersonal > 0) {
    warnings.push(`이미 빠진 참여자 몫으로 남아있는 개인경비 ${Math.round(unassignedPersonal).toLocaleString('ko-KR')}원은 정산에서 제외했어요.`)
  }

  // ---- 4. 결제자별 총액 ----
  const paidTotal = new Map<string, number>()
  const paidTotalN = new Map<string, number>()
  const selfSharePaid = new Map<string, number>()
  const selfSharePaidN = new Map<string, number>()
  let unassignedPaid = 0
  let unassignedPaidN = 0

  for (const e of entries) {
    if (e.paid_by === null) {
      unassignedPaid += Number(e.krw)
      unassignedPaidN += 1
      continue
    }
    if (!memberIds.has(e.paid_by)) {
      unassignedPaid += Number(e.krw)
      unassignedPaidN += 1
      continue
    }
    paidTotal.set(e.paid_by, (paidTotal.get(e.paid_by) ?? 0) + Number(e.krw))
    paidTotalN.set(e.paid_by, (paidTotalN.get(e.paid_by) ?? 0) + 1)
    if (e.member_id === e.paid_by) {
      selfSharePaid.set(e.paid_by, (selfSharePaid.get(e.paid_by) ?? 0) + Number(e.krw))
      selfSharePaidN.set(e.paid_by, (selfSharePaidN.get(e.paid_by) ?? 0) + 1)
    }
  }

  const payerSummaries: PayerSummary[] = members.map((m) => {
    const total = paidTotal.get(m.id) ?? 0
    const totalN = paidTotalN.get(m.id) ?? 0
    const self = selfSharePaid.get(m.id) ?? 0
    const selfN = selfSharePaidN.get(m.id) ?? 0
    return {
      memberId: m.id,
      name: m.displayName,
      paidTotal: total,
      paidTotalN: totalN,
      otherBurdenPaid: total - self,
      otherBurdenPaidN: totalN - selfN,
    }
  })

  if (unassignedPaid > 0) {
    warnings.push(
      `결제자가 지정되지 않았거나 이미 빠진 참여자가 결제한 내역 ${unassignedPaidN}건, 총 ${Math.round(unassignedPaid).toLocaleString('ko-KR')}원은 정산에서 제외했어요.`,
    )
  }

  // ---- net 계산 ----
  const rawNet = members.map((m) => {
    const fair = (personal.get(m.id) ?? 0) + fund / n
    const paidRaw = paidTotal.get(m.id) ?? 0
    let v = fair - paidRaw - budget / n
    if (treasurerId && m.id === treasurerId) v += budget
    return { id: m.id, name: m.displayName, sort: m.sort, value: v }
  })

  // 반올림 오차 보정: 정수로 반올림한 뒤 합이 0이 아니면 가장 큰 채권자(절대값 기준)에게 몰아준다.
  const rounded = rawNet.map((x) => ({ ...x, value: Math.round(x.value) }))
  const sum = rounded.reduce((s, x) => s + x.value, 0)
  if (sum !== 0 && rounded.length > 0) {
    const target = rounded.reduce((best, x) => (Math.abs(x.value) > Math.abs(best.value) ? x : best), rounded[0])
    target.value -= sum
  }

  // ---- 5. 그리디 최소송금 매칭 ----
  const debtors = rounded
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value || a.sort - b.sort)
    .map((x) => ({ ...x }))
  const creditors = rounded
    .filter((x) => x.value < 0)
    .sort((a, b) => a.value - b.value || a.sort - b.sort)
    .map((x) => ({ ...x, value: -x.value }))

  const transfers: SettlementTransfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].value, creditors[j].value)
    if (pay > 0) {
      transfers.push({
        from: debtors[i].id,
        fromName: debtors[i].name,
        to: creditors[j].id,
        toName: creditors[j].name,
        amount: pay,
      })
    }
    debtors[i].value -= pay
    creditors[j].value -= pay
    if (debtors[i].value <= 0) i += 1
    if (creditors[j].value <= 0) j += 1
  }

  return {
    memberCount: n,
    fundByDate,
    fundByCategory,
    budgetAnalysis,
    personalExpenses,
    payerSummaries,
    transfers,
    warnings,
  }
}

