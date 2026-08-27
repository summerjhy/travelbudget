import { useState } from 'react'
import type { Budget, Trip } from '../lib/types'
import { currencyChip, currencyLabel, currencyName } from '../lib/currencies'
import { BASE_CURRENCY, tripCurrencies } from '../lib/tripCurrency'
import { foreign, won } from '../lib/format'
import type { RateTable } from '../lib/rates'
import { latestRateFor } from '../lib/rates'

interface Form {
  amount: string
  currency: string
  rate: string
  date: string
  memo: string
}

interface Props {
  trip: Trip
  budgets: Budget[]
  total: number
  rates: RateTable
  addBudget: (i: { amount: number; currency: string; rate?: number | null; date: string; memo: string }) => Promise<{ ok: boolean; error?: string }>
  updateBudget: (id: string, i: { amount: number; currency: string; rate?: number | null; date: string; memo: string }) => Promise<{ ok: boolean; error?: string }>
  removeBudget: (id: string) => Promise<{ ok: boolean; error?: string }>
  today: string
}

function emptyForm(currency: string, date: string): Form {
  return { amount: '', currency, rate: '', date, memo: '' }
}

/**
 * 공금 예산.
 *
 * 통화를 골라 넣을 수 있다 — 트래블카드에 미리 환전해두는 경우가 많아서,
 * "3만 TWD를 43.42에 환전" 처럼 그대로 적는 게 자연스럽다.
 * 넣는 순간 원화로 환산해 고정하므로 나중에 시세가 움직여도 예산은 그대로다.
 *
 * 통화를 섞어 넣어도 예산은 하나의 원화 모집합이다. 지갑을 나누지 않는다.
 */
export function BudgetPanel({
  trip, budgets, total, rates, addBudget, updateBudget, removeBudget, today,
}: Props) {
  const currencies = tripCurrencies(trip)
  const [form, setForm] = useState<Form>(() => emptyForm(BASE_CURRENCY, today))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForeign = form.currency !== BASE_CURRENCY
  const amountNum = parseFloat(form.amount.replace(/,/g, '')) || 0
  const rateNum = parseFloat(form.rate) || 0
  const previewKrw = isForeign ? Math.round(amountNum * rateNum) : Math.round(amountNum)

  function pickCurrency(c: string) {
    setError(null)
    // 통화를 바꾸면 그 통화의 최근 환율을 미리 채워준다. 환전 환율이
    // 시세와 다르면 사용자가 고치면 된다.
    const suggested = c === BASE_CURRENCY ? '' : String(latestRateFor(rates, c) || '')
    setForm((f) => ({ ...f, currency: c, rate: c === BASE_CURRENCY ? '' : f.rate || suggested }))
  }

  function startEdit(b: Budget) {
    setEditingId(b.id)
    setError(null)
    setForm({
      amount: String(b.original_amount ?? b.amount),
      currency: b.currency ?? BASE_CURRENCY,
      rate: b.rate === null || b.rate === undefined ? '' : String(b.rate),
      date: b.date,
      memo: b.memo ?? '',
    })
  }

  function cancel() {
    setEditingId(null)
    setError(null)
    setForm(emptyForm(BASE_CURRENCY, today))
  }

  async function submit() {
    setError(null)
    if (!(amountNum > 0)) {
      setError('금액을 입력해주세요.')
      return
    }
    setBusy(true)
    const payload = {
      amount: amountNum,
      currency: form.currency,
      rate: isForeign ? rateNum : null,
      date: form.date,
      memo: form.memo.trim() || (editingId ? '예산' : '추가 예산'),
    }
    const result = editingId ? await updateBudget(editingId, payload) : await addBudget(payload)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    cancel()
  }

  async function handleRemove(b: Budget) {
    const label = b.memo || b.date
    if (!confirm(`'${label}' 예산 ${won(b.amount)} 을(를) 지울까요?`)) return
    setError(null)
    const result = await removeBudget(b.id)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
    else if (editingId === b.id) cancel()
  }

  return (
    <>
      <div className="box" style={{ marginBottom: 10 }}>
        {budgets.length === 0 ? (
          <div className="tr"><span className="k">아직 예산이 없어요</span></div>
        ) : null}
        {budgets.map((b) => {
          const cur = b.currency ?? BASE_CURRENCY
          return (
            <div className="tr" key={b.id}>
              <span className="k">
                {b.memo || b.date}
                <span style={{ opacity: 0.6, fontSize: 11.5 }}> · {b.date}</span>
                {cur !== BASE_CURRENCY && b.original_amount !== null && (
                  <span style={{ opacity: 0.75, fontSize: 11.5, display: 'block' }}>
                    {foreign(b.original_amount, cur)} × {b.rate}
                  </span>
                )}
              </span>
              <span className="v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {won(b.amount)}
                <button className="act" onClick={() => startEdit(b)}>수정</button>
                <button className="act warn" onClick={() => handleRemove(b)}>삭제</button>
              </span>
            </div>
          )
        })}
        <div className="tr" style={{ background: 'var(--accent-soft)' }}>
          <span className="k" style={{ fontWeight: 600, color: 'var(--accent-ink)' }}>합계</span>
          <span className="v" style={{ fontWeight: 600, color: 'var(--accent-ink)' }}>{won(total)}</span>
        </div>
      </div>

      {currencies.length > 1 && (
        <div className="field">
          <label className="lab">💱 넣을 단위</label>
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
          placeholder={isForeign ? `환전한 금액 (${form.currency})` : '금액 (원)'}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <input
          className="inp"
          placeholder="메모"
          style={{ flex: '0 0 38%' }}
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
        />
      </div>

      {isForeign && (
        <div className="row2" style={{ marginBottom: 7 }}>
          <input
            className="inp num"
            inputMode="decimal"
            placeholder={`환전 환율 (1${form.currency}당 원)`}
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
          <input
            className="inp"
            type="date"
            style={{ flex: '0 0 45%' }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
      )}

      {isForeign && amountNum > 0 && rateNum > 0 && (
        <p className="note" style={{ marginBottom: 7 }}>
          {foreign(amountNum, form.currency)} × {rateNum} = <b>{won(previewKrw)}</b> 로 잡혀요.
          환전할 때 환율이라 나중에 시세가 변해도 그대로예요.
        </p>
      )}

      {editingId ? (
        <div className="row2">
          <button className="btn quiet" style={{ flex: '0 0 32%' }} onClick={cancel}>취소</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
        </div>
      ) : (
        <button className="btn ghost" onClick={submit} disabled={busy}>
          {busy ? '추가 중...' : '예산 추가'}
        </button>
      )}

      {error && <p className="err">{error}</p>}

      <p className="note" style={{ marginTop: 9 }}>
        여행 중에 공금을 더 걷으면 여기에 추가하세요.
        {currencies.length > 1 && ` 트래블카드에 ${currencyName(currencies[0])}로 환전해뒀다면 그 금액과 환율을 그대로 적으면 돼요.`}
        {' '}통화를 섞어 넣어도 예산은 원화 하나로 합쳐서 계산해요.
      </p>
    </>
  )
}
