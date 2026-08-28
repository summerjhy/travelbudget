import type { Trip } from './types'
import type { SettlementResult } from './settlement'
import { cell, BOM } from './export'
import { won } from './format'

interface Ctx {
  trip: Trip
}

/** 최종 정산하기 결과를 엑셀에서 열 CSV로. 섹션별 소형 표를 빈 줄로 이어붙인다. */
export function settlementToCsv(result: SettlementResult, ctx: Ctx): string {
  const lines: string[] = []
  lines.push(cell(`${ctx.trip.name} 최종 정산`))
  lines.push('')

  lines.push('[공금 일자별 사용액]')
  lines.push(['날짜', '금액', '건수'].map(cell).join(','))
  for (const d of result.fundByDate) lines.push([d.date, d.krw, d.n].map(cell).join(','))
  lines.push('')

  lines.push('[공금 카테고리별 사용액]')
  lines.push(['카테고리', '금액', '건수'].map(cell).join(','))
  for (const c of result.fundByCategory) lines.push([c.category, c.krw, c.n].map(cell).join(','))
  lines.push('')

  lines.push('[예산 대비 공금사용현황]')
  lines.push(['총 예산', '총 공금 사용액', '건수', '초과(+)/잔여(-)', '인당 초과/잔여'].map(cell).join(','))
  lines.push(
    [
      result.budgetAnalysis.budget,
      result.budgetAnalysis.fund,
      result.budgetAnalysis.fundN,
      result.budgetAnalysis.diff,
      Math.round(result.budgetAnalysis.perMemberAdjustment),
    ].map(cell).join(','),
  )
  lines.push('')

  lines.push('[개인경비 지출 현황]')
  lines.push(['참여자', '금액', '건수'].map(cell).join(','))
  for (const p of result.personalExpenses) lines.push([p.name, p.krw, p.n].map(cell).join(','))
  lines.push('')

  lines.push('[결제자별 총액]')
  lines.push(['결제자', '결제 총액', '건수', '예산초과분&개인경비 결제금액', '건수'].map(cell).join(','))
  for (const p of result.payerSummaries) {
    lines.push([p.name, p.paidTotal, p.paidTotalN, p.otherBurdenPaid, p.otherBurdenPaidN].map(cell).join(','))
  }
  lines.push('')

  lines.push('[정산 안내: 이체할 금액]')
  lines.push(['받는 사람', '보내는 사람', '금액'].map(cell).join(','))
  for (const t of result.transfers) lines.push([t.toName, t.fromName, t.amount].map(cell).join(','))

  if (result.warnings.length) {
    lines.push('')
    lines.push('[안내]')
    for (const w of result.warnings) lines.push(cell(w))
  }

  return BOM + lines.join('\r\n') + '\r\n'
}

/** 최종 정산하기 결과를 카톡에 붙여넣기 좋은 텍스트로. */
export function settlementToText(result: SettlementResult, ctx: Ctx): string {
  const out: string[] = []
  out.push(`${ctx.trip.name} 최종 정산`)
  out.push('')

  out.push(`1. 공금 사용 총액 (총 ${result.budgetAnalysis.fundN}건)`)
  out.push(`합계 ${won(result.budgetAnalysis.fund)}`)
  out.push('· 일자별')
  for (const d of result.fundByDate) out.push(`  ${d.date}  ${won(d.krw)} (${d.n}건)`)
  out.push('· 카테고리별')
  for (const c of result.fundByCategory) out.push(`  ${c.category}  ${won(c.krw)} (${c.n}건)`)
  out.push('')

  out.push('2. 예산 대비 공금사용현황 분석')
  out.push(`총 예산  ${won(result.budgetAnalysis.budget)}`)
  out.push(`총 공금 사용액  ${won(result.budgetAnalysis.fund)} (${result.budgetAnalysis.fundN}건)`)
  const diff = result.budgetAnalysis.diff
  const perHead = result.budgetAnalysis.perMemberAdjustment
  if (diff > 0) {
    out.push(`초과 예산  ${won(diff)} (인당 ${won(perHead)} 추가 부담)`)
  } else if (diff < 0) {
    out.push(`잔여 예산  ${won(-diff)} (인당 ${won(-perHead)} 환급)`)
  } else {
    out.push('예산을 딱 맞춰 썼어요.')
  }
  out.push('')

  out.push('3. 개인경비 지출 현황 분석')
  for (const p of result.personalExpenses) {
    out.push(`${p.name} : ${won(p.krw)} (총 ${p.n}건)`)
  }
  out.push('')

  out.push('4. 결제자별 총액')
  for (const p of result.payerSummaries) {
    out.push(`${p.name} : ${won(p.paidTotal)} (총 ${p.paidTotalN}건)`)
    out.push(`  └ 예산 초과분 & 개인경비 금액 결제금액 : ${won(p.otherBurdenPaid)} (총 ${p.otherBurdenPaidN}건)`)
  }
  out.push('')

  out.push('5. 예산 초과분 및 개인경비 결제건 정산 안내')
  const byReceiver = new Map<string, { toName: string; items: { fromName: string; amount: number }[] }>()
  for (const t of result.transfers) {
    const g = byReceiver.get(t.to) ?? { toName: t.toName, items: [] }
    g.items.push({ fromName: t.fromName, amount: t.amount })
    byReceiver.set(t.to, g)
  }
  if (byReceiver.size === 0) {
    out.push('이체할 금액이 없어요.')
  } else {
    for (const g of byReceiver.values()) {
      out.push(`${g.toName}에게 각각 아래 금액을 이체해주세요 ❤️`)
      for (const item of g.items) out.push(`  ${item.fromName} : ${won(item.amount)}`)
    }
  }

  if (result.warnings.length) {
    out.push('')
    out.push('─────────────')
    for (const w of result.warnings) out.push(`※ ${w}`)
  }

  return out.join('\n')
}

/** 파일명에 못 쓰는 글자를 걷어낸다. */
export function settlementFileName(trip: Trip, ext: string): string {
  const safe = trip.name.replace(/[\\/:*?"<>|]/g, '').trim() || '여행가계부'
  return `${safe}_정산_${trip.start_date}.${ext}`
}
