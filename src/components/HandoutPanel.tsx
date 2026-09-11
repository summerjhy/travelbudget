import { useState } from 'react'
import type { FundHandout, Trip } from '../lib/types'
import type { MemberWithName } from '../lib/useTripMembers'
import type { HandoutInput } from '../lib/useFundHandouts'
import { currencyChip, currencyLabel } from '../lib/currencies'
import { BASE_CURRENCY, tripCurrencies } from '../lib/tripCurrency'
import { foreign, formatAmountInput, stripAmountInput, won } from '../lib/format'
import type { RateTable } from '../lib/rates'
import { latestRateFor } from '../lib/rates'

interface Form {
  memberId: string
  direction: 'out' | 'in'
  amount: string
  currency: string
  rate: string
  date: string
  memo: string
}

interface Props {
  trip: Trip
  members: MemberWithName[]
  handouts: FundHandout[]
  rates: RateTable
  addHandout: (i: HandoutInput) => Promise<{ ok: boolean; error?: string }>
  removeHandout: (id: string) => Promise<{ ok: boolean; error?: string }>
  today: string
}

function emptyForm(date: string): Form {
  return { memberId: '', direction: 'out', amount: '', currency: BASE_CURRENCY, rate: '', date, memo: '' }
}

/**
 * 공금 나눠주기 / 돌려받기.
 *
 * 여행 중에 총무가 공금 일부를 멤버에게 미리 보내고 그 돈으로 결제하게 하는
 * 일이 흔하다. 원화 계좌이체일 수도, ATM 에서 뽑은 현지 지폐를 비상금으로
 * 나눠주거나 트래블카드 외화를 그대로 송금하는 경우도 있다.
 *
 * 이건 지출이 아니라 공금이 누구 손에 있는지가 바뀌는 것이라 **잔여 예산은
 * 변하지 않는다**. 최종 정산에서만 반영된다.
 */
export function HandoutPanel({ trip, members, handouts, rates, addHandout, removeHandout, today }: Props) {
  const currencies = tripCurrencies(trip)
  const [form, setForm] = useState<Form>(() => emptyForm(today))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForeign = form.currency !== BASE_CURRENCY
  const amountNum = parseFloat(form.amount.replace(/,/g, '')) || 0
  const rateNum = parseFloat(form.rate) || 0
  const previewKrw = isForeign ? Math.round(amountNum * rateNum) : Math.round(amountNum)
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '(빠진 참여자)'

  function pickCurrency(c: string) {
    setError(null)
    const suggested = c === BASE_CURRENCY ? '' : String(latestRateFor(rates, c) || '')
    setForm((f) => ({ ...f, currency: c, rate: c === BASE_CURRENCY ? '' : f.rate || suggested }))
  }

  async function submit() {
    setError(null)
    setBusy(true)
    const result = await addHandout({
      memberId: form.memberId,
      direction: form.direction,
      amount: amountNum,
      currency: form.currency,
      rate: isForeign ? rateNum : null,
      date: form.date,
      memo: form.memo.trim() || (form.direction === 'out' ? '공금 나눠주기' : '공금 돌려받기'),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? '기록에 실패했어요.')
      return
    }
    setForm(emptyForm(today))
  }

  async function handleRemove(h: FundHandout) {
    const verb = h.direction === 'out' ? '나눠준' : '돌려받은'
    if (!confirm(`${nameOf(h.member_id)}님에게 ${verb} ${won(h.amount)} 기록을 지울까요?`)) return
    setError(null)
    const result = await removeHandout(h.id)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 10 }}>
        여행 중에 공금을 미리 보내주고 그 돈으로 결제하게 했다면 여기에 적어주세요.
        <b> 잔여 예산은 변하지 않고</b>(쓴 게 아니라 옮긴 거라서) 최종 정산에만 반영돼요.
        안 적으면 미리 받은 사람이 자기 돈을 쓴 걸로 잡혀 정산이 어긋나요.
      </p>

      <div className="box" style={{ marginBottom: 10 }}>
        {handouts.length === 0 ? (
          <div className="tr"><span className="k">아직 주고받은 기록이 없어요</span></div>
        ) : null}
        {handouts.map((h) => {
          const cur = h.currency ?? BASE_CURRENCY
          return (
            <div className="tr" key={h.id}>
              <span className="k">
                {h.direction === 'out' ? '→ ' : '← '}
                {nameOf(h.member_id)}
                <span style={{ opacity: 0.6, fontSize: 13.5 }}> · {h.date}</span>
                <span style={{ opacity: 0.75, fontSize: 13.5, display: 'block' }}>
                  {h.memo}
                  {cur !== BASE_CURRENCY && h.original_amount !== null && ` · ${foreign(h.original_amount, cur)} × ${h.rate}`}
                </span>
              </span>
              <span className="v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {h.direction === 'in' ? '−' : ''}{won(h.amount)}
                <button className="act warn" onClick={() => handleRemove(h)}>삭제</button>
              </span>
            </div>
          )
        })}
      </div>

      <div className="field">
        <label className="lab">🙋 누구와</label>
        <div className="chips">
          {members.map((m) => (
            <button
              key={m.id}
              className={'chip' + (form.memberId === m.id ? ' on' : '')}
              onClick={() => setForm({ ...form, memberId: m.id })}
            >
              {m.displayName}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="lab">↔️ 방향</label>
        <div className="chips">
          <button
            className={'chip' + (form.direction === 'out' ? ' on' : '')}
            onClick={() => setForm({ ...form, direction: 'out' })}
          >
            공금에서 나눠줌
          </button>
          <button
            className={'chip' + (form.direction === 'in' ? ' on' : '')}
            onClick={() => setForm({ ...form, direction: 'in' })}
          >
            공금으로 돌려받음
          </button>
        </div>
      </div>

      {currencies.length > 1 && (
        <div className="field">
          <label className="lab">💱 건넨 단위</label>
          <div className="chips">
            {currencies.map((c) => (
              <button
                key={c}
                className={'chip' + (form.currency === c ? ' on' : '')}
                onClick={() => pickCurrency(c)}
                title={currencyLabel(c)}
              >
                {currencyChip(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row2" style={{ marginBottom: 7 }}>
        <input
          className="inp num"
          inputMode="decimal"
          placeholder={isForeign ? `금액 (${form.currency})` : '금액 (원)'}
          value={formatAmountInput(form.amount)}
          onChange={(e) => setForm({ ...form, amount: stripAmountInput(e.target.value) })}
        />
        <input
          className="inp"
          placeholder="메모"
          style={{ flex: '0 0 38%' }}
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
        />
      </div>

      <div className="row2" style={{ marginBottom: 7 }}>
        {isForeign && (
          <input
            className="inp num"
            inputMode="decimal"
            placeholder={`적용 환율 (1${form.currency}당 원)`}
            value={formatAmountInput(form.rate)}
            onChange={(e) => setForm({ ...form, rate: stripAmountInput(e.target.value) })}
          />
        )}
        <input
          className="inp"
          type="date"
          style={isForeign ? { flex: '0 0 45%' } : undefined}
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>

      {isForeign && amountNum > 0 && rateNum > 0 && (
        <p className="note" style={{ marginBottom: 7 }}>
          {foreign(amountNum, form.currency)} × {rateNum} = <b>{won(previewKrw)}</b> 로 정산에 반영돼요.
          미리 환전해둔 돈에서 나갔다면 <b>그때 환전 환율</b>을 적어야 실제로 치른 값과 맞아요.
        </p>
      )}

      <button className="btn ghost" onClick={submit} disabled={busy}>
        {busy ? '기록 중...' : form.direction === 'out' ? '나눠준 기록 추가' : '돌려받은 기록 추가'}
      </button>

      {error && <p className="err">{error}</p>}
    </>
  )
}
