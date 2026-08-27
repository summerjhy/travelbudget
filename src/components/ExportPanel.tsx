import { useMemo, useState } from 'react'
import type { Trip } from '../lib/types'
import type { MemberWithName } from '../lib/useTripMembers'
import type { PendingEntry } from '../lib/useEntries'
import { deliver, exportFileName, toCsv, toText, type DeliverResult } from '../lib/export'
import { won } from '../lib/format'

interface Props {
  trip: Trip
  members: MemberWithName[]
  entries: PendingEntry[]
}

const RESULT_MESSAGE: Record<DeliverResult, string> = {
  download: '파일을 내려받았어요.',
  share: '공유 시트로 보냈어요.',
  clipboard: '클립보드에 복사했어요. 원하는 곳에 붙여넣으세요.',
  manual: '',
}

/**
 * 내역 내보내기.
 *
 * 날짜별로 골라서 뽑을 수 있다. 여행 중에 "어제까지만 정산" 같은 게
 * 자주 필요해서 전체/날짜별 둘 다 둔다.
 */
export function ExportPanel({ trip, members, entries }: Props) {
  // 날짜별 건수·합계. 최근 날짜가 위로 온다.
  const days = useMemo(() => {
    const map = new Map<string, { n: number; krw: number }>()
    for (const e of entries) {
      const d = map.get(e.date) ?? { n: 0, krw: 0 }
      d.n += 1
      d.krw += Number(e.krw)
      map.set(e.date, d)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entries])

  // null 이면 전체. Set 이면 고른 날짜만.
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  const selected = useMemo(
    () => (picked === null ? entries : entries.filter((e) => picked.has(e.date))),
    [entries, picked],
  )
  const selectedKrw = selected.reduce((s, e) => s + Number(e.krw), 0)

  function toggleDay(date: string) {
    setMessage(null)
    setFallbackText(null)
    setPicked((prev) => {
      // '전체'에서 하나를 끄면 그 날짜만 빠진 상태가 되어야 한다.
      const base = prev === null ? new Set(days.map(([d]) => d)) : new Set(prev)
      if (base.has(date)) base.delete(date)
      else base.add(date)
      return base
    })
  }

  function pickAll() {
    setMessage(null)
    setFallbackText(null)
    setPicked(null)
  }

  const isOn = (date: string) => picked === null || picked.has(date)

  async function run(kind: 'csv' | 'txt') {
    if (!selected.length) {
      setMessage('내보낼 내역이 없어요. 날짜를 골라주세요.')
      return
    }
    setBusy(true)
    setMessage(null)
    setFallbackText(null)

    // 파일 안에서는 날짜 오름차순이 읽기 좋다.
    const rows = [...selected].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const ctx = { trip, members }
    const content = kind === 'csv' ? toCsv(rows, ctx) : toText(rows, ctx)
    const mime = kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'

    const result = await deliver(content, exportFileName(trip, kind), mime)
    setBusy(false)

    if (result === 'manual') {
      setMessage('파일로 못 내보냈어요. 아래 내용을 직접 복사해주세요.')
      setFallbackText(content)
      return
    }
    setMessage(RESULT_MESSAGE[result])
  }

  return (
    <>
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={'chip' + (picked === null ? ' on' : '')} onClick={pickAll}>
          전체 {entries.length}건
        </button>
        {days.map(([date, d]) => (
          <button
            key={date}
            className={'chip' + (isOn(date) ? ' on' : '')}
            onClick={() => toggleDay(date)}
            title={`${date} · ${d.n}건 · ${won(d.krw)}`}
          >
            {date.slice(5).replace('-', '/')} · {d.n}
          </button>
        ))}
      </div>

      <p className="note" style={{ marginBottom: 9 }}>
        고른 내역 <b>{selected.length}건</b> · {won(selectedKrw)}
        {picked !== null && ' (날짜를 눌러 켜고 끌 수 있어요)'}
      </p>

      <div className="row2">
        <button className="btn ghost" onClick={() => run('csv')} disabled={busy || !selected.length}>
          📊 엑셀(CSV)
        </button>
        <button className="btn ghost" onClick={() => run('txt')} disabled={busy || !selected.length}>
          📝 텍스트
        </button>
      </div>

      {message && <p className="note" style={{ marginTop: 9, color: 'var(--jade)' }}>{message}</p>}

      {fallbackText && (
        <textarea
          className="ta"
          readOnly
          value={fallbackText}
          onFocus={(e) => e.currentTarget.select()}
          style={{ marginTop: 9, minHeight: 160, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
        />
      )}
    </>
  )
}
