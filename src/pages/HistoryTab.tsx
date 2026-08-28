import { useMemo, useState } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries, type PendingEntry } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { latestRateFor, rateFor, resolveAmount } from '../lib/rates'
import { computeTotals, entryCurrency } from '../lib/totals'
import { CATEGORIES, categoryChip } from '../lib/categories'
import { BASE_CURRENCY, summaryCurrency, tripCurrencies } from '../lib/tripCurrency'
import { paymentChip } from '../lib/payment'
import { won } from '../lib/format'
import { Pair } from '../components/Pair'
import { ExportPanel } from '../components/ExportPanel'
import { Help } from '../components/Help'
import { MemberName } from '../components/MemberName'
import { EntryFields } from '../components/EntryFields'

interface Draft {
  title: string
  category: string
  /** 외화 금액 (entries.cny). 어느 통화인지는 currency 가 들고 있다. */
  cny: string
  krw: string
  currency: string
  memberId: string | null
  paidBy: string | null
  paymentMethod: string
  /** 비어 있으면 저장할 때 금액에서 다시 계산한다. */
  rate: string
  date: string
  /** HH:MM. 빈 문자열이면 시각 없이 저장한다(옛 기록 등). */
  time: string
}

export function HistoryTab() {
  const { trip } = useTrip()
  const { members, allMembers } = useTripMembers(trip?.id)
  const { rates, fetchNow } = useRates(trip?.id, trip?.code)
  const { entries, updateEntry, removeEntry, refresh } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)
  usePolling(refresh, !!trip?.id)

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  // 결제자(entries.paid_by) 필터. 돈의 소유가 아니다 —
  // 공금인지 아닌지는 각 항목 meta 에 이미 적혀 있고, 여기서는
  // "누가 카드를 긁었나" 만 고른다. 공금인데 혜연이 결제한 건도 잡힌다.
  const [payerFilter, setPayerFilter] = useState<string | 'ALL'>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  // 기본은 '최근 2일만 펼침'이고, 사용자가 누른 것만 예외로 기억한다.
  // 날짜 목록이 필터에 따라 바뀌므로 열린 목록을 통째로 들고 있으면 어긋난다.
  const [openDates, setOpenDates] = useState<Set<string>>(new Set())
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())

  function toggleDate(date: string, isOpen: boolean) {
    setOpenDates((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(date)
      else next.add(date)
      return next
    })
    setClosedDates((prev) => {
      const next = new Set(prev)
      if (isOpen) next.add(date)
      else next.delete(date)
      return next
    })
  }

  const currencies = tripCurrencies(trip)
  const summary = summaryCurrency(trip)
  const totals = computeTotals(entries, allMembers, budgetTotal, summary, latestRateFor(rates, summary))
  const categories = useMemo(() => CATEGORIES.map(([name]) => name).concat('기타'), [])

  const filtered = entries.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false
    if (payerFilter === 'ALL') return true
    return e.paid_by === payerFilter
  })

  const groups = useMemo(() => {
    const map = new Map<string, PendingEntry[]>()
    for (const e of filtered) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    // 하루 안에서는 늦게 쓴 것부터, 위에서 아래로 시간 역순. time이 없는
    // 옛 기록(마이그레이션 0011 이전)은 언제인지 몰라 맨 아래로 몰아 둔다.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.time && b.time) return a.time < b.time ? 1 : a.time > b.time ? -1 : 0
        if (a.time) return -1
        if (b.time) return 1
        return a.created_at < b.created_at ? 1 : -1
      })
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [filtered])

  function openEdit(e: PendingEntry) {
    setEditingId(e.id)
    setDraft({
      title: e.title,
      cny: String(e.cny),
      krw: String(e.krw),
      currency: entryCurrency(e),
      category: e.category,
      memberId: e.member_id,
      paidBy: e.paid_by,
      paymentMethod: e.payment_method ?? 'cash',
      rate: e.rate === null ? '' : String(e.rate),
      date: e.date,
      time: e.time ?? '',
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
    const resolved = resolveAmount({ krw, cny }, draft.date, draft.currency, rates)
    if (!resolved.krw && !resolved.cny) {
      setError('금액을 입력해주세요.')
      return
    }
    // 환율 칸을 직접 채웠으면 그 값이 우선이다 (설정 탭 직접입력과 같은 원칙).
    const typedRate = parseFloat(draft.rate)
    const useTyped = draft.currency !== BASE_CURRENCY && typedRate > 0 && resolved.cny > 0
    const result = await updateEntry(editingId, {
      title: draft.title,
      category: draft.category,
      member_id: draft.memberId,
      paid_by: draft.paidBy,
      payment_method: draft.paymentMethod,
      date: draft.date,
      time: draft.time || null,
      krw: useTyped ? Math.round(resolved.cny * typedRate) : resolved.krw,
      cny: resolved.cny,
      currency: draft.currency,
      rate: useTyped ? typedRate : resolved.rate,
    })
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    setEditingId(null)
    setDraft(null)
  }

  /**
   * 이 건만 그 날짜 환율로 다시 계산한다.
   *
   * 기본은 '저장 당시 환율로 고정'이다 — 카드 청구는 결제 시점 환율로 확정되고,
   * 외화·원화를 둘 다 입력한 건은 실제 청구 환율이 역산돼 있어서 시세로 덮으면
   * 오히려 부정확해진다. 그래서 일괄 재계산은 두지 않고 건별로만, 확인을 받고 한다.
   */
  async function recalcRate() {
    if (!editingId || !draft) return
    if (draft.currency === BASE_CURRENCY) return

    let rate = rateFor(rates, draft.date, draft.currency)
    if (rate === null) {
      const fetched = await fetchNow(draft.date)
      if (fetched.ok && fetched.rates) rate = fetched.rates[draft.currency] ?? null
    }
    if (rate === null) {
      setError(draft.date + ' 의 ' + draft.currency + ' 환율이 없어요. 설정 탭에서 조회하거나 직접 입력해주세요.')
      return
    }

    const cny = parseFloat(draft.cny) || 0
    if (!cny) {
      setError('외화 금액이 있어야 다시 계산할 수 있어요.')
      return
    }
    const nextKrw = Math.round(cny * rate)
    const msg = `이 건을 ${draft.date} 환율 ${rate.toFixed(2)} 로 다시 계산할까요?
원화 ${draft.krw} → ${nextKrw}`
    if (!confirm(msg)) return

    setDraft({ ...draft, krw: String(nextKrw), rate: String(rate) })
    setError(null)
  }
  async function deleteEntry() {
    if (!editingId) return
    if (!confirm('이 기록을 지울까요?')) return
    const result = await removeEntry(editingId)
    setEditingId(null)
    setDraft(null)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
  }

  return (
    <section className="pad">
      <div className="sec first">📊 합계</div>
      <div className="box">
        <div className="tr"><span className="k">공금 · {totals.fund.n}건</span><span className="v"><Pair amount={totals.fund.cny} krw={totals.fund.krw} currency={summary} /></span></div>
        <div className="tr"><span className="k">개인 합계</span><span className="v"><Pair amount={totals.personCny} krw={totals.personKrw} currency={summary} /></span></div>
        <div className="tr"><span className="k">예산 사용률</span><span className="v">{totals.pct.toFixed(1)}%</span></div>
        <div className="tr"><span className="k">잔여 예산</span><span className="v" style={{ fontWeight: 600 }}><Pair amount={totals.remainCny} krw={totals.remain} currency={summary} /></span></div>
      </div>

      <div className="filters">
        <div className="fgroup">
          <span className="flab">분류</span>
          <div className="chips">
            <button className={'chip' + (categoryFilter === null ? ' on' : '')} onClick={() => setCategoryFilter(null)}>전체</button>
            {categories.map((c) => (
              <button key={c} className={'chip' + (categoryFilter === c ? ' on' : '')} onClick={() => setCategoryFilter(c)}>{categoryChip(c)}</button>
            ))}
          </div>
        </div>
        <div className="fgroup">
          <span className="flab" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            결제
            <Help label="결제 필터 설명">
              <b>누가 카드를 긁었는지</b>로 걸러요.<br />
              돈이 공금인지 아닌지는 따로예요 — 공금인데 혜연이 결제한 건도
              혜연으로 잡혀요. 각 항목에 <b>공금 / 이름</b>이 적혀 있으니 거기서 구분하세요.
            </Help>
          </span>
          <div className="chips">
            <button className={'chip' + (payerFilter === 'ALL' ? ' on' : '')} onClick={() => setPayerFilter('ALL')}>전체</button>
            {members.map((m) => (
              <button key={m.id} className={'chip' + (payerFilter === m.id ? ' on' : '')} onClick={() => setPayerFilter(m.id)}><MemberName emoji={m.emoji} name={m.personName} /></button>
            ))}
          </div>
        </div>
      </div>

      <div className="sec">
        🧾 전체 내역 · {filtered.length}건
        <button
          className="act"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowExport((v) => !v)}
          aria-expanded={showExport}
        >
          {showExport ? '닫기' : '📤 내보내기'}
        </button>
      </div>
      {showExport && trip && (
        <div className="box" style={{ padding: 14, marginBottom: 10 }}>
          <p className="note" style={{ marginBottom: 9 }}>
            지금 걸린 필터가 적용된 {filtered.length}건에서 날짜를 골라 내보내요.
          </p>
          <ExportPanel trip={trip} members={allMembers} entries={filtered} />
        </div>
      )}
      <p className="note" style={{ margin: '-4px 0 10px' }}>항목을 누르면 이름 · 금액 · 날짜를 고칠 수 있어요.</p>

      {error && <p className="err">{error}</p>}

      {filtered.length === 0 && (
        <div className="empty">아직 기록이 없어요.<br />기록 탭에서 첫 지출을 남겨보세요.</div>
      )}

      {groups.map(([date, items], gi) => {
        // 최근 두 날짜는 펼쳐둔다 — 여행 중에 자주 보는 건 오늘·어제다.
        // 그 외에는 접어서 긴 여행에서도 목록이 한눈에 들어오게 한다.
        const open = closedDates.has(date) ? false : openDates.has(date) || gi < 2
        const dayKrw = items.reduce((s, e) => s + Number(e.krw), 0)
        return (
        <div key={date}>
          <button
            type="button"
            className="daygroup"
            aria-expanded={open}
            onClick={() => toggleDate(date, open)}
          >
            <span className="d">{date.slice(5).replace('-', '/')}</span>
            <span className="n">{items.length}건 · {won(dayKrw)}</span>
            <span className="mark" aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
          {open && items.map((e) => {
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
                  <EntryFields
                    value={draft}
                    onChange={(patch) => setDraft({ ...draft, ...patch })}
                    currencies={currencies}
                    members={members}
                    onRecalcRate={recalcRate}
                    emptyRateHint="환율은 저장 당시 값으로 고정돼요. 고치려면 위 칸에 직접 적거나 버튼을 누르세요."
                  />
                  <div className="editrow">
                    <button className="btn warn sm" style={{ flex: '0 0 26%' }} onClick={deleteEntry}>삭제</button>
                    <button className="btn quiet sm" style={{ flex: '0 0 26%' }} onClick={cancelEdit}>취소</button>
                    <button className="btn sm" onClick={saveEdit}>저장</button>
                  </div>
                </div>
              )
            }

            const owner = e.member_id ? allMembers.find((m) => m.id === e.member_id) : null
            // 회계 귀속(비용 구분)과 같은 사람이어도 결제자는 항상 보여준다 —
            // 겹칠 때만 숨기면 "왜 이 건만 결제자가 없지" 하고 헷갈린다.
            const payer = e.paid_by ? allMembers.find((m) => m.id === e.paid_by) : null
            // 원화 건은 환산이 없으므로 환율을 보여줄 게 없다.
            const shownRate =
              e.rate !== null && entryCurrency(e) !== BASE_CURRENCY
                ? `1${entryCurrency(e)}=₩${e.rate.toFixed(2)}`
                : null
            return (
              <div className="item" key={e.id} onClick={() => openEdit(e)}>
                <div className="body">
                  <div className="top">
                    <span className="name">{e.title}</span>
                    <Pair amount={e.cny} krw={e.krw} currency={entryCurrency(e)} />
                  </div>
                  <div className="meta">
                    {e.date.slice(5).replace('-', '/')}{e.time ? ` ${e.time}` : ''} · {categoryChip(e.category)} ·{' '}
                    <span style={{ color: e.member_id ? 'var(--marigold)' : 'var(--jade)' }}>
                      {e.member_id
                        ? owner
                          ? owner.personName
                          : '개인'
                        : '공금'}
                    </span>
                    {' · '}{paymentChip(e.payment_method)}
                    {payer && <> · 결제 <MemberName emoji={payer.emoji} name={payer.personName} /></>}
                    {shownRate && <> · {shownRate}</>}
                    {e.pending && <span style={{ color: 'var(--marigold)' }}> · 동기화 대기중</span>}
                  </div>
                </div>
                <button className="x" onClick={(ev) => { ev.stopPropagation(); openEdit(e) }}>수정</button>
              </div>
            )
          })}
        </div>
        )
      })}
      <div style={{ height: 30 }} />
    </section>
  )
}
