import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries, type NewEntryInput, type PendingEntry } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { useOfflineSync } from '../lib/useOfflineSync'
import { usePolling } from '../lib/usePolling'
import { parseText, parserConfig, type ParsedEntry } from '../lib/parser'
import { guessCategory } from '../lib/categories'
import { latestRateFor, rateFor, resolveAmount, type RateTable } from '../lib/rates'
import { computeTotals, entryCurrency } from '../lib/totals'
import { foreign, won } from '../lib/format'
import { currencyChip, currencyLabel, currencyName, currencySuffix } from '../lib/currencies'
import { BASE_CURRENCY, defaultCurrency, summaryCurrency, tripCurrencies } from '../lib/tripCurrency'
import {
  getStoredCurrency,
  getStoredPayer,
  getStoredPayment,
  setStoredCurrency,
  setStoredPayer,
  setStoredPayment,
} from '../lib/session'
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS, isPaymentMethod, paymentLabel } from '../lib/payment'
import { resizeAndCompressMany } from '../lib/imageResize'
import { parseImages } from '../lib/parseImage'
import { consumeSharedFiles } from '../lib/shareTarget'
import { Pair } from '../components/Pair'
import type { Entry } from '../lib/types'

interface PreviewItem extends ParsedEntry {
  memberId: string | null
  paymentMethod: string
  entrySource: Entry['source']
}

const MAX_PHOTOS = 5

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RecordTab() {
  const { trip, personName, member } = useTrip()
  const { members, allMembers } = useTripMembers(trip?.id)
  const { rates, fetchNow } = useRates(trip?.id, trip?.code)
  const { entries, addEntries, refresh } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)
  const { online } = useOfflineSync(trip?.id, refresh)
  usePolling(refresh, !!trip?.id)

  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [parsingImages, setParsingImages] = useState(false)
  const [lastSavedIds, setLastSavedIds] = useState<string[] | null>(null)
  const [currency, setCurrencyState] = useState<string | null>(null)
  const [payment, setPaymentState] = useState<string | null>(null)
  const [payer, setPayerState] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const memberNames = members.map((m) => m.personName)
  const currencies = tripCurrencies(trip)
  // 통화 선택 버튼은 고를 게 둘 이상일 때만 띄운다.
  const showCurrencyPicker = currencies.length >= 2
  const summary = summaryCurrency(trip)
  const totals = computeTotals(entries, allMembers, budgetTotal, summary, latestRateFor(rates, summary))

  // 입력 단위: 한 번 고르면 바꾸기 전까지 유지된다. 처음에는 여행하는 나라 돈.
  const activeCurrency =
    currency && currencies.includes(currency) ? currency : defaultCurrency(trip)

  // 결제수단·결제자도 같은 방식. 결제자 기본값은 본인이고, 저장된 값이
  // 지금 참여자 목록에 없으면(비활성화 등) 본인으로 되돌린다.
  const activePayment = isPaymentMethod(payment) ? payment : DEFAULT_PAYMENT_METHOD
  const activePayer =
    payer && members.some((m) => m.id === payer) ? payer : member?.id ?? null

  function pickCurrency(next: string) {
    setCurrencyState(next)
    if (trip) setStoredCurrency(trip.code, next)
  }

  function pickPayment(next: string) {
    setPaymentState(next)
    if (trip) setStoredPayment(trip.code, next)
  }

  function pickPayer(next: string) {
    setPayerState(next)
    if (trip) setStoredPayer(trip.code, next)
  }

  // entries에서 최신 상태(pending 여부 포함)를 그때그때 조회한다 — id는 온라인 동기화 후에도 유지된다(로컬id는 즉시 반영, 서버id는 그대로).
  const lastSaved: PendingEntry[] = lastSavedIds
    ? lastSavedIds.map((id) => entries.find((e) => e.id === id)).filter((e): e is PendingEntry => !!e)
    : []

  // 여행이 바뀌면 그 여행에서 마지막으로 고른 입력 단위를 되살린다.
  const tripCode = trip?.code
  useEffect(() => {
    if (!tripCode) return
    setCurrencyState(getStoredCurrency(tripCode))
    setPaymentState(getStoredPayment(tripCode))
    setPayerState(getStoredPayer(tripCode))
  }, [tripCode])

  // 안드로이드 공유 시트로 이 앱을 열면(share_target) URL에 ?share-target=1이 붙는다.
  // 서비스워커가 IndexedDB에 저장해둔 공유 이미지를 꺼내 자동으로 분석한다.
  useEffect(() => {
    if (!trip) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('share-target') !== '1') return
    window.history.replaceState({}, '', window.location.pathname)
    consumeSharedFiles().then((files) => {
      if (files.length > 0) processPhotos(files)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id])

  function handleParse() {
    setError(null)
    const year = trip?.start_date.slice(0, 4) ?? String(new Date().getFullYear())
    const parsed = parseText(text, memberNames, year, parserConfig(currencies, activeCurrency))
    if (!parsed.length) {
      setError('금액을 못 찾았어요. 숫자를 포함해서 적어 주세요.')
      setPreview([])
      return
    }
    setPreview((prev) => [
      ...prev,
      ...parsed.map((p) => ({
        ...p,
        memberId: members.find((m) => m.personName === p.personName)?.id ?? null,
        paymentMethod: activePayment,
        date: p.date ?? todayDate(),
        entrySource: 'text' as const,
      })),
    ])
  }

  function handleClear() {
    setText('')
    setPreview([])
    setError(null)
  }

  async function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS)
    e.target.value = ''
    await processPhotos(files)
  }

  async function processPhotos(files: File[]) {
    if (!files.length || !trip) return

    setParsingImages(true)
    setError(null)
    try {
      const images = await resizeAndCompressMany(files)
      const result = await parseImages(trip.code, images)
      if (!result.ok || !result.results) {
        setError(result.error ?? '사진을 분석하지 못했어요. 직접입력을 이용해주세요.')
        return
      }

      const defaultDate = todayDate()
      const newItems: PreviewItem[] = []
      let failCount = 0
      for (const r of result.results) {
        if (!r || (r.krw === null && r.amount === null)) {
          failCount++
          continue
        }
        // 캡쳐에서 읽은 통화 코드가 이 여행에서 쓰는 통화면 그대로 쓰고,
        // 아니면(못 읽었거나 낯선 코드) 지금 고른 단위로 넘긴다.
        const read = r.currency?.toUpperCase() ?? null
        const isKRW = read ? read === BASE_CURRENCY : r.krw !== null && r.amount === null
        const itemCurrency = isKRW
          ? BASE_CURRENCY
          : read && currencies.includes(read)
            ? read
            : activeCurrency
        newItems.push({
          title: r.merchant || '지출',
          category: guessCategory(r.merchant || ''),
          personName: null,
          memberId: null,
          paymentMethod: activePayment,
          date: r.date ?? defaultDate,
          amount: isKRW ? (r.krw ?? 0) : (r.amount ?? 0),
          currency: itemCurrency,
          entrySource: 'image',
        })
      }
      setPreview((prev) => [...prev, ...newItems])
      if (failCount > 0) {
        setError(`${failCount}장은 인식하지 못했어요. 직접입력으로 추가해주세요.`)
      }
    } finally {
      setParsingImages(false)
    }
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

    // 저장에 필요한 (날짜, 통화) 중 캐시에 없는 게 있으면 그 날짜를 한 번 조회한다.
    // fetch-rate 는 여행의 외화를 한꺼번에 돌려주므로 날짜당 한 번이면 충분하다.
    const saved = preview.filter((p) => p.amount > 0)
    const neededDates = Array.from(new Set(saved.map((p) => p.date ?? todayDate())))
    const table: RateTable = { ...rates }
    for (const date of neededDates) {
      const missing = saved
        .filter((p) => (p.date ?? todayDate()) === date)
        .some((p) => rateFor(table, date, p.currency) === null)
      if (!missing) continue

      const result = await fetchNow(date)
      if (result.ok && result.rates) {
        table[date] = { ...(table[date] ?? {}), ...result.rates }
      }

      // 오프라인 등으로 조회가 안 된 통화는 그 통화의 가장 최근 캐시 환율로 버틴다.
      // 온라인 복귀 후 정확한 환율이 필요하면 내역 탭에서 고칠 수 있다.
      for (const p of saved) {
        if ((p.date ?? todayDate()) !== date) continue
        if (rateFor(table, date, p.currency) !== null) continue
        const fallback = latestRateFor(rates, p.currency)
        if (fallback) table[date] = { ...(table[date] ?? {}), [p.currency]: fallback }
      }
    }

    const items: NewEntryInput[] = []
    for (const p of saved) {
      const date = p.date ?? todayDate()
      const isKRW = p.currency === BASE_CURRENCY
      const resolved = resolveAmount(
        { krw: isKRW ? p.amount : undefined, cny: isKRW ? undefined : p.amount },
        date,
        p.currency,
        table,
      )
      if (!resolved.krw && !resolved.cny) continue
      items.push({
        date,
        title: p.title,
        category: p.category,
        member_id: p.memberId,
        payment_method: p.paymentMethod,
        // 이름을 적어 개인 지출로 잡힌 건은 그 사람이 자기 돈으로 낸 것이다.
        paid_by: p.memberId ?? activePayer,
        krw: resolved.krw,
        cny: resolved.cny,
        currency: p.currency,
        rate: resolved.rate,
        source: p.entrySource,
        created_by: personName,
      })
    }

    if (!items.length) {
      setSaving(false)
      setError('환율 정보를 가져오지 못했어요. 설정 탭에서 환율을 직접 입력해주세요.')
      return
    }

    const result = await addEntries(items)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? '저장에 실패했어요.')
      return
    }
    setLastSavedIds(result.inserted ? result.inserted.map((e) => e.id) : null)
    setPreview([])
    setText('')
  }

  return (
    <section className="pad">
      {!online && (
        <p className="note" style={{ color: 'var(--marigold)', marginBottom: 9 }}>
          지금 오프라인이에요. 입력은 계속할 수 있고, 온라인이 되면 자동으로 저장돼요.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handlePhotoSelect}
      />
      <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={parsingImages || !online}>
        {parsingImages ? <><span className="spin" />분석 중...</> : online ? '사진으로 읽어들이기' : '사진 인식은 온라인에서만 가능해요'}
      </button>
      <p className="note" style={{ margin: '9px 0' }}>
        카드사 앱의 해외결제 상세내역 캡쳐를 올리면 자동으로 읽어요. 최대 5장.
        결제 캡쳐는 분석 후 즉시 폐기되고 서버에 저장되지 않아요.
      </p>

      {showCurrencyPicker && (
        <div style={{ marginBottom: 8 }}>
          <label className="lab">입력 단위</label>
          <div className="chips">
            {currencies.map((c) => (
              <button
                key={c}
                className={'chip' + (activeCurrency === c ? ' on' : '')}
                onClick={() => pickCurrency(c)}
                title={currencyLabel(c)}
              >
                {currencyChip(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label className="lab">결제 수단</label>
        <div className="chips">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.code}
              className={'chip' + (activePayment === m.code ? ' on' : '')}
              onClick={() => pickPayment(m.code)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {members.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label className="lab">결제자</label>
          <div className="chips">
            {members.map((m) => (
              <button
                key={m.id}
                className={'chip' + (activePayer === m.id ? ' on' : '')}
                onClick={() => pickPayer(m.id)}
              >
                {m.personName}
              </button>
            ))}
          </div>
        </div>
      )}

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
        단위를 안 적은 숫자는 <b>{currencyName(activeCurrency)}</b>({activeCurrency})로 읽어요.
        {' '}<b>원</b>{currencies.length > 2 ? ' 처럼 단위를 적으면' : '을 붙이면'} 그 단위로 들어가요.
      </p>

      {preview.length > 0 && (
        <div>
          <div className="sec">확인하고 저장</div>
          {preview.map((p, i) => {
            const itemRate = latestRateFor(rates, p.currency)
            const other =
              p.currency === BASE_CURRENCY
                ? null
                : won(p.amount * itemRate)
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
                  {currencies.map((c) => (
                    <button
                      key={c}
                      className={'chip' + (p.currency === c ? ' on' : '')}
                      onClick={() => updatePreviewItem(i, { currency: c })}
                      title={currencyLabel(c)}
                    >
                      {currencySuffix(c)}
                    </button>
                  ))}
                  {other && <span className="note" style={{ marginLeft: 2 }}>≈ {other}</span>}
                  <button className="chip" style={{ marginLeft: 'auto' }} onClick={() => removePreviewItem(i)}>빼기</button>
                </div>
                <div className="chips" style={{ marginTop: 7 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.code}
                      className={'chip' + (p.paymentMethod === m.code ? ' on' : '')}
                      onClick={() => updatePreviewItem(i, { paymentMethod: m.code })}
                    >
                      {m.label}
                    </button>
                  ))}
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
              <div className="tr"><span className="k">결제수단</span><span className="v txt">{paymentLabel(e.payment_method)}</span></div>
              <div className="tr"><span className="k">원화</span><span className="v">{won(e.krw)}</span></div>
              {entryCurrency(e) !== BASE_CURRENCY && (
                <div className="tr">
                  <span className="k">{currencyName(entryCurrency(e))}</span>
                  <span className="v">{foreign(e.cny, entryCurrency(e))}</span>
                </div>
              )}
              <div className="tr">
                <span className="k">공금여부</span>
                <span className="v txt">
                  <span className={'badge ' + (e.member_id ? 'self' : 'fund')}>
                    {e.member_id ? '개인' : '공금'}
                  </span>
                  {e.pending && <span className="badge" style={{ marginLeft: 6, background: 'rgba(201,138,30,.15)', color: 'var(--marigold)' }}>동기화 대기중</span>}
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
            <span className="v"><Pair amount={totals.perMember[m.id]?.cny ?? 0} krw={totals.perMember[m.id]?.krw ?? 0} currency={summary} /></span>
          </div>
        ))}
      </div>

      <div className="sec">잔여 예산</div>
      <div className="box">
        <div className="tr"><span className="k">예산 총액</span><span className="v">{won(totals.budget)}</span></div>
        <div className="tr"><span className="k">공금 사용</span><span className="v"><Pair amount={totals.fund.cny} krw={totals.fund.krw} currency={summary} /></span></div>
        <div className="tr">
          <span className="k">잔여</span>
          <span className="v" style={{ fontWeight: 600, color: totals.remain < 0 ? 'var(--rose)' : 'var(--jade)' }}>
            <Pair amount={totals.remainCny} krw={totals.remain} currency={summary} />
          </span>
        </div>
      </div>
      <div style={{ height: 30 }} />
    </section>
  )
}
