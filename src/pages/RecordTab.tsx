import { useState } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries, type NewEntryInput } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { parseText, type ParsedEntry } from '../lib/parser'
import { resolveAmount } from '../lib/rates'
import { computeTotals } from '../lib/totals'
import { won, yuan } from '../lib/format'
import { Pair } from '../components/Pair'
import type { Entry } from '../lib/types'

interface PreviewItem extends ParsedEntry {
  memberId: string | null
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function latestRate(ratesByDate: Record<string, number>): number {
  const keys = Object.keys(ratesByDate).sort()
  return keys.length ? ratesByDate[keys[keys.length - 1]] : 0
}

export function RecordTab() {
  const { trip, personName } = useTrip()
  const { members } = useTripMembers(trip?.id)
  const { ratesByDate } = useRates(trip?.id)
  const { entries, addEntries } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)

  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Entry[] | null>(null)

  const memberNames = members.map((m) => m.personName)
  const totals = computeTotals(entries, members, budgetTotal, latestRate(ratesByDate))

  function handleParse() {
    setError(null)
    const year = trip?.start_date.slice(0, 4) ?? String(new Date().getFullYear())
    const parsed = parseText(text, memberNames, year)
    if (!parsed.length) {
      setError('금액을 못 찾았어요. 숫자를 포함해서 적어 주세요.')
      setPreview([])
      return
    }
    setPreview(
      parsed.map((p) => ({
        ...p,
        memberId: members.find((m) => m.personName === p.personName)?.id ?? null,
        date: p.date ?? (trip && trip.start_date > todayDate() ? trip.start_date : todayDate()),
      })),
    )
  }

  function handleClear() {
    setText('')
    setPreview([])
    setError(null)
  }

  function updatePreviewItem(index: number, patch: Partial<PreviewItem>) {
    setPreview((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function removePreviewItem(index: number) {
    setPreview((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!trip) return
    setSaving(true)
    setError(null)

    const items: NewEntryInput[] = []
    for (const p of preview) {
      if (!(p.amount > 0)) continue
      const date = p.date ?? todayDate()
      const resolved = resolveAmount(
        { krw: p.currency === 'KRW' ? p.amount : undefined, cny: p.currency === 'CNY' ? p.amount : undefined },
        date,
        ratesByDate,
      )
      if (!resolved.krw && !resolved.cny) continue
      items.push({
        date,
        title: p.title,
        category: p.category,
        member_id: p.memberId,
        krw: resolved.krw,
        cny: resolved.cny,
        rate: resolved.rate,
        source: 'text',
        created_by: personName,
      })
    }

    if (!items.length) {
      setSaving(false)
      setError('환율 정보가 없어서 저장할 수 없어요. 설정 탭에서 환율을 먼저 입력해주세요.')
      return
    }

    const result = await addEntries(items)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    setLastSaved(result.inserted ?? null)
    setPreview([])
    setText('')
  }

  return (
    <section className="pad">
      <textarea
        className="ta"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'쓴 만큼 한 줄씩 적으세요.\n\n훠궈 380\n택시 45 소영\n마사지 198 혜연\n숙소 240000원'}
      />
      <div className="row2" style={{ marginTop: 10 }}>
        <button className="btn quiet" style={{ flex: '0 0 32%' }} onClick={handleClear}>지우기</button>
        <button className="btn" onClick={handleParse}>읽어들이기</button>
      </div>
      <p className="note" style={{ marginTop: 9 }}>
        이름을 안 적으면 <b>공금</b>, {memberNames.join(' · ') || '참여자'} 중 하나를 적으면 그 사람 개인 결제로 들어가요.
        숫자만 적으면 위안, <b>원</b>을 붙이면 원화로 읽어요.
      </p>

      {preview.length > 0 && (
        <div>
          <div className="sec">확인하고 저장</div>
          {preview.map((p, i) => {
            const other =
              p.currency === 'CNY'
                ? won(p.amount * latestRate(ratesByDate))
                : yuan(latestRate(ratesByDate) ? p.amount / latestRate(ratesByDate) : 0)
            return (
              <div className="prev" key={i}>
                <div className="l1">
                  <input value={p.title} onChange={(e) => updatePreviewItem(i, { title: e.target.value })} />
                  <input
                    className="n"
                    inputMode="decimal"
                    value={p.amount}
                    onChange={(e) => updatePreviewItem(i, { amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="chips">
                  {(['CNY', 'KRW'] as const).map((c) => (
                    <button
                      key={c}
                      className={'chip' + (p.currency === c ? ' on' : '')}
                      onClick={() => updatePreviewItem(i, { currency: c })}
                    >
                      {c === 'CNY' ? '元' : '원'}
                    </button>
                  ))}
                  <span className="note" style={{ marginLeft: 2 }}>≈ {other}</span>
                  <button className="chip" style={{ marginLeft: 'auto' }} onClick={() => removePreviewItem(i)}>빼기</button>
                </div>
                <div className="chips" style={{ marginTop: 7 }}>
                  <button
                    className={'chip' + (p.memberId === null ? ' on' : '')}
                    onClick={() => updatePreviewItem(i, { memberId: null, personName: null })}
                  >
                    공금
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className={'chip' + (p.memberId === m.id ? ' on' : '')}
                      onClick={() => updatePreviewItem(i, { memberId: m.id, personName: m.personName })}
                    >
                      {m.personName}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}

      {error && <p className="err">{error}</p>}

      {lastSaved && lastSaved.length > 0 && (
        <div>
          <div className="sec">이번 사용금액</div>
          {lastSaved.map((e) => (
            <div className="box" style={{ marginBottom: 8 }} key={e.id}>
              <div className="tr"><span className="k">이름</span><span className="v txt">{e.title}</span></div>
              <div className="tr"><span className="k">일자</span><span className="v">{e.date}</span></div>
              <div className="tr"><span className="k">원화</span><span className="v">{won(e.krw)}</span></div>
              <div className="tr"><span className="k">위안화</span><span className="v">{yuan(e.cny)}</span></div>
              <div className="tr">
                <span className="k">공금여부</span>
                <span className="v txt">
                  <span className={'badge ' + (e.member_id ? 'self' : 'fund')}>
                    {e.member_id ? '개인' : '공금'}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sec">공금 외 지출내역 (누적)</div>
      <div className="box">
        {members.map((m) => (
          <div className="tr" key={m.id}>
            <span className="k">{m.personName}</span>
            <span className="v"><Pair cny={totals.perMember[m.id]?.cny ?? 0} krw={totals.perMember[m.id]?.krw ?? 0} /></span>
          </div>
        ))}
      </div>

      <div className="sec">잔여 예산</div>
      <div className="box">
        <div className="tr"><span className="k">예산 총액</span><span className="v">{won(totals.budget)}</span></div>
        <div className="tr"><span className="k">공금 사용</span><span className="v"><Pair cny={totals.fund.cny} krw={totals.fund.krw} /></span></div>
        <div className="tr">
          <span className="k">잔여</span>
          <span className="v" style={{ fontWeight: 600, color: totals.remain < 0 ? 'var(--rose)' : 'var(--jade)' }}>
            <Pair cny={totals.remainCny} krw={totals.remain} />
          </span>
        </div>
      </div>
      <div style={{ height: 30 }} />
    </section>
  )
}
