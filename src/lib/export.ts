import type { Entry, Trip } from './types'
import type { MemberWithName } from './useTripMembers'
import { entryCurrency } from './totals'
import { paymentLabel } from './payment'
import { BASE_CURRENCY } from './tripCurrency'
import { foreign, won } from './format'

export interface ExportRow extends Entry {
  pending?: boolean
}

interface Ctx {
  trip: Trip
  members: MemberWithName[]
}

function memberName(members: MemberWithName[], id: string | null): string {
  if (!id) return '공금'
  return members.find((m) => m.id === id)?.personName ?? '(빠진 참여자)'
}

/** CSV 한 칸. 쉼표·따옴표·줄바꿈이 들어가면 따옴표로 감싸고 내부 따옴표는 두 번 쓴다. */
function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.split('"').join('""') + '"' : s
}

/** 엑셀이 UTF-8 로 인식하게 하는 BOM. 없으면 한글이 전부 깨진다. */
const BOM = '\uFEFF'

const CSV_HEADER = [
  '날짜', '내역', '분류', '공금/개인', '결제자', '결제수단',
  '외화금액', '통화', '원화금액', '적용환율',
]

/**
 * 엑셀에서 열 CSV.
 *
 * 맨 앞에 BOM 을 붙인다 — 이게 없으면 엑셀이 UTF-8 로 안 읽어서
 * 한글이 전부 깨진다.
 */
export function toCsv(entries: ExportRow[], ctx: Ctx): string {
  const lines = [CSV_HEADER.map(cell).join(',')]
  for (const e of entries) {
    const cur = entryCurrency(e)
    lines.push([
      cell(e.date),
      cell(e.title),
      cell(e.category),
      cell(e.member_id ? '개인' : '공금'),
      cell(e.paid_by ? memberName(ctx.members, e.paid_by) : ''),
      cell(paymentLabel(e.payment_method)),
      // 원화 결제 건은 외화 칸을 비운다 — 같은 금액을 두 번 적으면 합계를 낼 때 헷갈린다.
      cell(cur === BASE_CURRENCY ? '' : e.cny),
      cell(cur === BASE_CURRENCY ? '' : cur),
      cell(e.krw),
      cell(cur === BASE_CURRENCY || e.rate === null ? '' : e.rate),
    ].join(','))
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

/** 카톡에 붙여넣기 좋은 사람이 읽는 형식. 날짜별로 묶고 맨 끝에 합계. */
export function toText(entries: ExportRow[], ctx: Ctx): string {
  const out: string[] = []
  const range = ctx.trip.end_date && ctx.trip.end_date !== ctx.trip.start_date
    ? `${ctx.trip.start_date} ~ ${ctx.trip.end_date}`
    : ctx.trip.start_date
  out.push(`${ctx.trip.name} (${range})`)
  if (ctx.trip.destinations.length) out.push(ctx.trip.destinations.join(' · '))
  out.push('')

  const byDate = new Map<string, ExportRow[]>()
  for (const e of entries) {
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }

  for (const date of [...byDate.keys()].sort()) {
    const rows = byDate.get(date)!
    const dayKrw = rows.reduce((s, e) => s + Number(e.krw), 0)
    out.push(`[${date}]  ${won(dayKrw)}`)
    for (const e of rows) {
      const cur = entryCurrency(e)
      const amount = cur === BASE_CURRENCY ? won(e.krw) : `${foreign(e.cny, cur)} · ${won(e.krw)}`
      const who = e.member_id ? memberName(ctx.members, e.member_id) : '공금'
      out.push(`  ${e.title}  ${amount}  (${who} · ${paymentLabel(e.payment_method)})`)
    }
    out.push('')
  }

  const total = entries.reduce((s, e) => s + Number(e.krw), 0)
  const fund = entries.filter((e) => !e.member_id).reduce((s, e) => s + Number(e.krw), 0)
  out.push('─────────────')
  out.push(`합계  ${won(total)}  (${entries.length}건)`)
  out.push(`공금  ${won(fund)}`)
  for (const m of ctx.members) {
    const mine = entries.filter((e) => e.member_id === m.id).reduce((s, e) => s + Number(e.krw), 0)
    if (mine > 0) out.push(`${m.personName}  ${won(mine)}`)
  }
  return out.join('\n')
}

/** 파일명에 못 쓰는 글자를 걷어낸다. */
export function exportFileName(trip: Trip, ext: string): string {
  const safe = trip.name.replace(/[\\/:*?"<>|]/g, '').trim() || '여행가계부'
  return `${safe}_${trip.start_date}.${ext}`
}

export type DeliverResult = 'download' | 'share' | 'clipboard' | 'manual'

/**
 * 만든 파일을 사용자에게 건넨다.
 *
 * iOS 홈 화면 앱(standalone)은 <a download> 가 동작하지 않는다. 그래서
 * 다운로드 -> 공유 시트 -> 클립보드 순으로 내려간다. 전부 막히면 'manual'
 * 을 돌려주고 호출부가 화면에 내용을 띄워 직접 복사하게 한다.
 */
export async function deliver(
  content: string,
  fileName: string,
  mime: string,
): Promise<DeliverResult> {
  const file = new File([content], fileName, { type: mime })

  // iOS 홈 화면 앱은 다운로드가 막혀 있으니 공유 시트를 먼저 시도한다.
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)

  if (standalone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'share'
    } catch (err) {
      // 사용자가 공유 시트를 닫은 것뿐이면 다른 경로로 넘어가지 않는다.
      if (err instanceof DOMException && err.name === 'AbortError') return 'share'
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 클릭 직후 revoke 하면 사파리에서 저장이 실패한다.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'download'
  } catch {
    /* 아래로 */
  }

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'share'
    } catch {
      /* 아래로 */
    }
  }

  try {
    await navigator.clipboard.writeText(content)
    return 'clipboard'
  } catch {
    return 'manual'
  }
}
