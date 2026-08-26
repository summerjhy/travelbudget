import { useMemo, useState } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { resolveAmount } from '../lib/rates'
import { computeTotals } from '../lib/totals'
import { CATEGORIES } from '../lib/categories'
import { Pair } from '../components/Pair'
import type { Entry } from '../lib/types'

function latestRate(ratesByDate: Record<string, number>): number {
  const keys = Object.keys(ratesByDate).sort()
  return keys.length ? ratesByDate[keys[keys.length - 1]] : 0
}

interface Draft {
  title: string
  cny: string
  krw: string
  memberId: string | null
  date: string
}

export function HistoryTab() {
  const { trip } = useTrip()
  const { members } = useTripMembers(trip?.id)
  const { ratesByDate } = useRates(trip?.id)
  const { entries, updateEntry, removeEntry } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string | null | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totals = computeTotals(entries, members, budgetTotal, latestRate(ratesByDate))
  const categories = useMemo(() => CATEGORIES.map(([name]) => name).concat('기타'), [])

  const filtered = entries.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false
    if (memberFilter === 'ALL') return true
    if (memberFilter === null) return e.member_id === null
    return e.member_id === memberFilter
  })

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of filtered) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  function openEdit(e: Entry) {
    setEditingId(e.id)
    setDraft({
      title: e.title,
      cny: String(e.cny),
      krw: String(e.krw),
      memberId: e.member_id,
      date: e.date,
    })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  async function saveEdit() {
    if (!editingId || !draft) return
    const cny = parseFloat(draft.cny) || 0
    const krw = parseFloat(draft.krw) || 0
    const resolved = resolveAmount({ krw, cny }, draft.date, ratesByDate)
    if (!resolved.krw && !resolved.cny) {
      setError('금액을 입력해주세요.')
      return
    }
    const result = await updateEntry(editingId, {
      title: draft.title,
      member_id: draft.memberId,
      date: draft.date,
      krw: resolved.krw,
      cny: resolved.cny,
      rate: resolved.rate,
    })
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    setEditingId(null)
    setDraft(null)
  }

  async function deleteEntry() {
    if (!editingId) return
    if (!confirm('이 기록을 지울까요?')) return
    const result = await removeEntry(editingId)
    setEditingId(null)
    setDraft(null)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
  }

  const impliedRate =
    draft && parseFloat(draft.krw) > 0 && parseFloat(draft.cny) > 0
      ? parseFloat(draft.krw) / parseFloat(draft.cny)
      : null

  return (
    <section className="pad">
      <div className="sec first">합계</div>
      <div className="box">
        <div className="tr"><span className="k">공금 · {totals.fund.n}건</span><span className="v"><Pair cny={totals.fund.cny} krw={totals.fund.krw} /></span></div>
        <div className="tr"><span className="k">개인 합계</span><span className="v"><Pair cny={totals.personCny} krw={totals.personKrw} /></span></div>
        <div className="tr"><span className="k">예산 사용률</span><span className="v">{totals.pct.toFixed(1)}%</span></div>
        <div className="tr"><span className="k">잔여 예산</span><span className="v" style={{ fontWeight: 600 }}><Pair cny={totals.remainCny} krw={totals.remain} /></span></div>
      </div>

      <div className="sec">필터</div>
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={'chip' + (categoryFilter === null ? ' on' : '')} onClick={() => setCategoryFilter(null)}>전체</button>
        {categories.map((c) => (
          <button key={c} className={'chip' + (categoryFilter === c ? ' on' : '')} onClick={() => setCategoryFilter(c)}>{c}</button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (memberFilter === 'ALL' ? ' on' : '')} onClick={() => setMemberFilter('ALL')}>전체</button>
        <button className={'chip' + (memberFilter === null ? ' on' : '')} onClick={() => setMemberFilter(null)}>공금</button>
        {members.map((m) => (
          <button key={m.id} className={'chip' + (memberFilter === m.id ? ' on' : '')} onClick={() => setMemberFilter(m.id)}>{m.personName}</button>
        ))}
      </div>

      <div className="sec">전체 내역 · {filtered.length}건</div>
      <p className="note" style={{ margin: '-4px 0 10px' }}>항목을 누르면 이름 · 금액 · 날짜를 고칠 수 있어요.</p>

      {error && <p className="err">{error}</p>}

      {filtered.length === 0 && (
        <div className="empty">아직 기록이 없어요.<br />기록 탭에서 첫 지출을 남겨보세요.</div>
      )}

      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="sec">{date.slice(5).replace('-', '/')}</div>
          {items.map((e) => {
            if (e.id === editingId && draft) {
              return (
                <div className="prev edit" key={e.id}>
                  <div className="l1">
                    <input
                      value={draft.title}
                      placeholder="내역"
                      onChange={(ev) => setDraft({ ...draft, title: ev.target.value })}
                    />
                  </div>
                  <div className="money">
                    <label>
                      <input inputMode="decimal" value={draft.cny} onChange={(ev) => setDraft({ ...draft, cny: ev.target.value })} />
                      <span>元</span>
                    </label>
                    <label>
                      <input inputMode="numeric" value={draft.krw} onChange={(ev) => setDraft({ ...draft, krw: ev.target.value })} />
                      <span>원</span>
                    </label>
                  </div>
                  <p className="note" style={{ margin: '0 0 9px' }}>
                    {impliedRate ? `적용환율 ${impliedRate.toFixed(2)} · 한쪽을 비우면 자동 환산돼요` : '한쪽만 채우면 저장할 때 환율로 자동 환산돼요'}
                  </p>
                  <div className="chips">
                    <button className={'chip' + (draft.memberId === null ? ' on' : '')} onClick={() => setDraft({ ...draft, memberId: null })}>공금</button>
                    {members.map((m) => (
                      <button key={m.id} className={'chip' + (draft.memberId === m.id ? ' on' : '')} onClick={() => setDraft({ ...draft, memberId: m.id })}>
                        {m.personName}
                      </button>
                    ))}
                  </div>
                  <div className="editrow">
                    <input className="inp" type="date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} style={{ flex: 1 }} />
                  </div>
                  <div className="editrow">
                    <button className="btn warn sm" style={{ flex: '0 0 26%' }} onClick={deleteEntry}>삭제</button>
                    <button className="btn quiet sm" style={{ flex: '0 0 26%' }} onClick={cancelEdit}>취소</button>
                    <button className="btn sm" onClick={saveEdit}>저장</button>
                  </div>
                </div>
              )
            }

            const memberName = e.member_id ? members.find((m) => m.id === e.member_id)?.personName ?? '개인' : '공금'
            return (
              <div className="item" key={e.id} onClick={() => openEdit(e)}>
                <div className="body">
                  <div className="top">
                    <span className="name">{e.title}</span>
                    <Pair cny={e.cny} krw={e.krw} />
                  </div>
                  <div className="meta">
                    {e.date.slice(5).replace('-', '/')} · {e.category} ·{' '}
                    <span style={{ color: e.member_id ? 'var(--marigold)' : 'var(--jade)' }}>{memberName}</span>
                  </div>
                </div>
                <button className="x" onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}>수정</button>
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ height: 30 }} />
    </section>
  )
}
