import { useState } from 'react'
import type { Budget, Trip } from '../lib/types'
import { currencyChip, currencyLabel } from '../lib/currencies'
import { BASE_CURRENCY, tripCurrencies } from '../lib/tripCurrency'
import { foreign, formatAmountInput, stripAmountInput, won } from '../lib/format'
import type { RateTable } from '../lib/rates'
import type { BudgetInput } from '../lib/useBudgets'
import { isPrepaid } from '../lib/totals'
import { latestRateFor } from '../lib/rates'

interface Form {
  amount: string
  currency: string
  rate: string
  /** 미리 환전해둔 돈인지. false 면 실시간 환율로 결제되는 한도다. */
  prepaid: boolean
  date: string
  memo: string
}

interface Props {
  trip: Trip
  budgets: Budget[]
  total: number
  rates: RateTable
  addBudget: (i: BudgetInput) => Promise<{ ok: boolean; error?: string }>
  updateBudget: (id: string, i: BudgetInput) => Promise<{ ok: boolean; error?: string }>
  removeBudget: (id: string) => Promise<{ ok: boolean; error?: string }>
  today: string
}

function emptyForm(currency: string, date: string): Form {
  return { amount: '', currency, rate: '', prepaid: true, date, memo: '' }
}

/**
 * 공금 예산.
 *
 * 통화를 골라 넣을 수 있고, 외화로 넣을 때는 성격이 둘로 갈린다.
 *   · 미리 환전함   — "3만 TWD를 43.42에 환전". 환전이 끝났으니 시세가 변해도 그대로.
 *   · 실시간 환율   — 계좌 연동/신용카드처럼 결제할 때마다 그날 환율로 환산되는 한도.
 * 두 경우 다 외화 금액이 진짜고, 원화를 어떤 환율로 보여줄지만 다르다.
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
  const marketRate = isForeign ? latestRateFor(rates, form.currency) : 1
  const rateNum = form.prepaid ? parseFloat(form.rate) || 0 : marketRate
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
      prepaid: isPrepaid(b),
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
      rate: isForeign && form.prepaid ? rateNum : null,
      prepaid: form.prepaid,
      marketRate,
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
                <span style={{ opacity: 0.6, fontSize: 13.5 }}> · {b.date}</span>
                {cur !== BASE_CURRENCY && b.original_amount !== null && (
                  <span style={{ opacity: 0.75, fontSize: 13.5, display: 'block' }}>
                    {foreign(b.original_amount, cur)}
                    {isPrepaid(b) ? ` × ${b.rate} (환전 완료)` : ' · 실시간 환율'}
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

      {isForeign && (
        <div className="field">
          <label className="lab">💸 이 돈의 성격</label>
          <div className="chips">
            <button
              className={'chip' + (form.prepaid ? ' on' : '')}
              onClick={() => setForm({ ...form, prepaid: true })}
            >
              미리 환전함
            </button>
            <button
              className={'chip' + (!form.prepaid ? ' on' : '')}
              onClick={() => setForm({ ...form, prepaid: false, rate: '' })}
            >
              실시간 환율
            </button>
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            {form.prepaid
              ? '현금·트래블카드처럼 이미 환전을 끝낸 돈이에요. 시세가 변해도 예산은 그대로예요.'
              : '계좌 연동 카드나 신용카드처럼 결제할 때마다 그날 환율로 계산돼요.'}
          </p>
        </div>
      )}

      {isForeign && form.prepaid && (
        <div className="row2" style={{ marginBottom: 7 }}>
          <input
            className="inp num"
            inputMode="decimal"
            placeholder={`환전 환율 (1${form.currency}당 원)`}
            value={formatAmountInput(form.rate)}
            onChange={(e) => setForm({ ...form, rate: stripAmountInput(e.target.value) })}
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

      {isForeign && !form.prepaid && (
        <div className="row2" style={{ marginBottom: 7 }}>
          <input
            className="inp"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
      )}

      {isForeign && amountNum > 0 && rateNum > 0 && (
        <p className="note" style={{ marginBottom: 7 }}>
          {foreign(amountNum, form.currency)} × {rateNum} = <b>{won(previewKrw)}</b>
          {form.prepaid
            ? ' 로 잡혀요. 환전할 때 환율이라 나중에 시세가 변해도 그대로예요.'
            : ' 쯤 돼요. 오늘 시세 기준이라 앞으로 시세를 따라 달라져요.'}
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
        {currencies.length > 1 && ' 외화로 넣을 때는 이미 환전한 돈인지, 결제할 때마다 환산되는 한도인지 골라주세요.'}
        {' '}통화별로 따로 세서 지갑에 남은 금액과 어긋나지 않아요.
      </p>
    </>
  )
}
