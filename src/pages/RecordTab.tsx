import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries, type NewEntryInput, type PendingEntry } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { useOfflineSync } from '../lib/useOfflineSync'
import { usePolling } from '../lib/usePolling'
import { parseText, parserConfig } from '../lib/parser'
import { guessCategory } from '../lib/categories'
import { latestRateFor, rateFor, resolveAmount, type RateTable } from '../lib/rates'
import { computeTotals, entryCurrency } from '../lib/totals'
import { foreign, won } from '../lib/format'
import { currencyChip, currencyLabel, currencyName } from '../lib/currencies'
import { BASE_CURRENCY, defaultCurrency, summaryCurrency, tripCurrencies } from '../lib/tripCurrency'
import {
  getStoredCostMode,
  getStoredCurrency,
  getStoredPayer,
  getStoredPayment,
  setStoredCostMode,
  setStoredCurrency,
  setStoredPayer,
  setStoredPayment,
  type CostMode,
} from '../lib/session'
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHODS, isPaymentMethod, paymentChip } from '../lib/payment'
import { resizeAndCompressMany } from '../lib/imageResize'
import { parseImages } from '../lib/parseImage'
import { consumeSharedFiles, takeShareFlag } from '../lib/shareTarget'
import { Pair } from '../components/Pair'
import { MemberName } from '../components/MemberName'
import { ResultModal } from '../components/ResultModal'
import { EntryFields, type EntryFieldsValue } from '../components/EntryFields'
import type { Entry } from '../lib/types'
import { nowForTrip, todayForTrip, yearForTrip } from '../lib/tripDate'

interface PreviewItem extends EntryFieldsValue {
  title: string
  entrySource: Entry['source']
}

const MAX_PHOTOS = 5

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
  const [photoResult, setPhotoResult] = useState<{ title: string; body: string } | null>(null)
  const [lastSavedIds, setLastSavedIds] = useState<string[] | null>(null)
  const [currency, setCurrencyState] = useState<string | null>(null)
  const [payment, setPaymentState] = useState<string | null>(null)
  const [payer, setPayerState] = useState<string | null>(null)
  const [costMode, setCostModeState] = useState<CostMode | null>(null)
  // 입력 방식. 사진/텍스트를 한 행 토글로 고른다.
  const [mode, setMode] = useState<'photo' | 'text'>('text')
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
  const activeCostMode = costMode ?? 'fund'
  // 이름을 못 알아본 줄의 기본 비용 구분. 공금이면 null, 개인이면 지금 결제자.
  const defaultMemberId = activeCostMode === 'personal' ? activePayer : null

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

  function pickCostMode(next: CostMode) {
    setCostModeState(next)
    if (trip) setStoredCostMode(trip.code, next)
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
    setCostModeState(getStoredCostMode(tripCode))
  }, [tripCode])

  // 안드로이드 공유 시트로 이 앱을 열면(share_target) /record?share-target=... 로 온다.
  // 서비스워커가 IndexedDB에 저장해둔 공유 이미지를 꺼내 자동으로 분석한다.
  useEffect(() => {
    if (!trip) return
    const shared = takeShareFlag()
    if (!shared) return

    // 공유로 들어왔으면 사진 모드를 보여준다. 실패해도 바로 고를 수 있게.
    setMode('photo')

    if (shared !== '1') {
      setError('공유한 사진을 받지 못했어요. 아래에서 직접 골라주세요.')
      return
    }
    consumeSharedFiles()
      .then((files) => {
        if (files.length > 0) processPhotos(files)
        else setError('공유한 사진을 찾지 못했어요. 아래에서 직접 골라주세요.')
      })
      .catch(() => setError('공유한 사진을 여는 데 실패했어요. 아래에서 직접 골라주세요.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id])

  /** 파싱 직후 값(외화 금액 하나)을 두 칸(외화·원화) 편집 모델로 바꾼다. 최근 캐시 환율로 원화 칸을 미리 채워 둔다. */
  function toMoneyFields(amount: number, curr: string) {
    if (curr === BASE_CURRENCY) return { cny: '', krw: amount ? String(Math.round(amount)) : '' }
    const rate = latestRateFor(rates, curr)
    const krw = amount && rate ? String(Math.round(amount * rate)) : ''
    return { cny: amount ? String(amount) : '', krw }
  }

  function handleParse() {
    setError(null)
    const year = trip?.start_date.slice(0, 4) ?? yearForTrip(trip)
    const parsed = parseText(text, memberNames, year, parserConfig(currencies, activeCurrency))
    if (!parsed.length) {
      setError('금액을 못 찾았어요. 숫자를 포함해서 적어 주세요.')
      setPreview([])
      return
    }
    setPreview((prev) => [
      ...prev,
      ...parsed.map((p) => {
        const matchedMember = members.find((m) => m.personName === p.personName)?.id ?? null
        return {
          title: p.title,
          category: p.category,
          date: p.date ?? todayForTrip(trip),
          time: '',
          currency: p.currency,
          ...toMoneyFields(p.amount, p.currency),
          rate: '',
          paymentMethod: activePayment,
          paidBy: activePayer,
          memberId: matchedMember ?? defaultMemberId,
          entrySource: 'text' as const,
        }
      }),
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
        setPhotoResult({
          title: '❌ 분석 실패',
          body: result.error ?? '사진을 분석하지 못했어요. 직접입력을 이용해주세요.',
        })
        return
      }

      const defaultDate = todayForTrip(trip)
      const newItems: PreviewItem[] = []
      let failCount = 0
      // 사진 한 장이 목록형 이용내역이면 거래가 여러 건 나올 수 있다 —
      // 각 사진의 결과 배열을 펼쳐서 항목마다 미리보기 카드를 하나씩 만든다.
      for (const list of result.results) {
        if (!list || list.length === 0) {
          failCount++
          continue
        }
        let addedFromThisImage = 0
        for (const r of list) {
          if (r.krw === null && r.amount === null) continue
          addedFromThisImage++
          // 캡쳐에서 읽은 통화 코드가 이 여행에서 쓰는 통화면 그대로 쓰고,
          // 아니면(못 읽었거나 낯선 코드) 지금 고른 단위로 넘긴다.
          const read = r.currency?.toUpperCase() ?? null
          const isKRW = read ? read === BASE_CURRENCY : r.krw !== null && r.amount === null
          const itemCurrency = isKRW
            ? BASE_CURRENCY
            : read && currencies.includes(read)
              ? read
              : activeCurrency
          const amount = isKRW ? (r.krw ?? 0) : (r.amount ?? 0)
          newItems.push({
            title: r.merchant || '지출',
            category: guessCategory(r.merchant || ''),
            date: r.date ?? defaultDate,
            time: r.time ?? '',
            currency: itemCurrency,
            ...toMoneyFields(amount, itemCurrency),
            rate: '',
            paymentMethod: activePayment,
            paidBy: activePayer,
            memberId: defaultMemberId,
            entrySource: 'image',
          })
        }
        if (addedFromThisImage === 0) failCount++
      }
      setPreview((prev) => [...prev, ...newItems])

      // 30~40초씩 걸리는 작업이라 그새 다른 앱을 보고 있을 수 있다.
      // 화면 아래 텍스트로만 알리면 놓치기 쉬워서, 확인을 누르기 전까지
      // 화면 가운데 붙잡아 두는 모달로 항상 결과를 알린다.
      const okCount = files.length - failCount
      if (failCount === 0) {
        setPhotoResult({
          title: '✅ 분석 완료',
          body: `사진 ${files.length}장에서 ${newItems.length}건을 찾았어요.\n확인하고 저장해주세요.`,
        })
      } else if (okCount === 0) {
        setPhotoResult({
          title: '❌ 인식 실패',
          body: `사진 ${files.length}장 모두에서 지출을 찾지 못했어요.\n직접입력을 이용해주세요.`,
        })
      } else {
        setPhotoResult({
          title: '⚠️ 일부만 인식',
          body: `사진 ${files.length}장 중 ${newItems.length}건을 찾았어요.\n${failCount}장은 인식하지 못해 직접입력이 필요해요.`,
        })
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

  /**
   * 이 항목만 그 날짜 환율로 다시 계산한다. 내역 탭 수정 카드의
   * recalcRate 와 같은 동작 — 아직 저장 전이라 "덮어쓸 값"이 없다는 점만 다르다.
   */
  async function recalcRateForItem(index: number) {
    const p = preview[index]
    if (!p || p.currency === BASE_CURRENCY) return

    let rate = rateFor(rates, p.date, p.currency)
    if (rate === null) {
      const fetched = await fetchNow(p.date)
      if (fetched.ok && fetched.rates) rate = fetched.rates[p.currency] ?? null
    }
    if (rate === null) {
      setError(`${p.date} 의 ${p.currency} 환율이 없어요. 설정 탭에서 조회하거나 직접 입력해주세요.`)
      return
    }

    const cny = parseFloat(p.cny) || 0
    if (!cny) {
      setError('외화 금액이 있어야 다시 계산할 수 있어요.')
      return
    }
    updatePreviewItem(index, { krw: String(Math.round(cny * rate)), rate: String(rate) })
    setError(null)
  }

  async function handleSave() {
    if (!trip) return
    setSaving(true)
    setError(null)

    // 저장에 필요한 (날짜, 통화) 중 캐시에 없는 게 있으면 그 날짜를 한 번 조회한다.
    // fetch-rate 는 여행의 외화를 한꺼번에 돌려주므로 날짜당 한 번이면 충분하다.
    const saved = preview.filter((p) => (parseFloat(p.cny) || 0) > 0 || (parseFloat(p.krw) || 0) > 0)
    const neededDates = Array.from(new Set(saved.map((p) => p.date || todayForTrip(trip))))
    const table: RateTable = { ...rates }
    for (const date of neededDates) {
      const missing = saved
        .filter((p) => (p.date || todayForTrip(trip)) === date)
        .some((p) => rateFor(table, date, p.currency) === null)
      if (!missing) continue

      const result = await fetchNow(date)
      if (result.ok && result.rates) {
        table[date] = { ...(table[date] ?? {}), ...result.rates }
      }

      // 오프라인 등으로 조회가 안 된 통화는 그 통화의 가장 최근 캐시 환율로 버틴다.
      // 온라인 복귀 후 정확한 환율이 필요하면 내역 탭에서 고칠 수 있다.
      for (const p of saved) {
        if ((p.date || todayForTrip(trip)) !== date) continue
        if (rateFor(table, date, p.currency) !== null) continue
        const fallback = latestRateFor(rates, p.currency)
        if (fallback) table[date] = { ...(table[date] ?? {}), [p.currency]: fallback }
      }
    }

    // 사진에서 실제 결제 시각을 읽었으면 그 값을 쓰고, 못 읽었으면(텍스트
    // 입력 등) 한 번의 저장 동작 안에서는 다 같이 지금 입력한 것으로 본다.
    const fallbackTime = nowForTrip(trip)
    const items: NewEntryInput[] = []
    for (const p of saved) {
      const date = p.date || todayForTrip(trip)
      const cny = parseFloat(p.cny) || 0
      const krw = parseFloat(p.krw) || 0
      const resolved = resolveAmount({ krw, cny }, date, p.currency, table)
      if (!resolved.krw && !resolved.cny) continue

      // 환율 칸을 직접 채웠으면 그 값이 우선이다 (설정 탭 직접입력과 같은 원칙).
      const typedRate = parseFloat(p.rate)
      const useTyped = p.currency !== BASE_CURRENCY && typedRate > 0 && resolved.cny > 0

      items.push({
        date,
        title: p.title,
        category: p.category,
        member_id: p.memberId,
        payment_method: p.paymentMethod,
        paid_by: p.paidBy,
        krw: useTyped ? Math.round(resolved.cny * typedRate) : resolved.krw,
        cny: resolved.cny,
        currency: p.currency,
        rate: useTyped ? typedRate : resolved.rate,
        source: p.entrySource,
        created_by: personName,
        time: p.time || fallbackTime,
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
      {photoResult && (
        <ResultModal title={photoResult.title} body={photoResult.body} onClose={() => setPhotoResult(null)} />
      )}
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
      <div className="segmented" role="tablist" aria-label="입력 방식">
        <button
          role="tab"
          aria-selected={mode === 'photo'}
          className={mode === 'photo' ? 'on' : ''}
          onClick={() => setMode('photo')}
        >
          <span aria-hidden="true">📸</span> 사진으로
        </button>
        <button
          role="tab"
          aria-selected={mode === 'text'}
          className={mode === 'text' ? 'on' : ''}
          onClick={() => setMode('text')}
        >
          <span aria-hidden="true">📝</span> 텍스트로
        </button>
      </div>

      {mode === 'photo' && (
        <>
          <button
            className="btn"
            style={{ marginTop: 9 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={parsingImages || !online}
          >
            {parsingImages ? <><span className="spin" />분석 중...</> : online ? '📸 사진 고르기' : '사진 인식은 온라인에서만 가능해요'}
          </button>
          <p className="note" style={{ margin: '9px 0' }}>
            카드사·트래블카드 앱의 결제 상세내역이나 결제 목록 캡쳐를 올리면 자동으로 읽어요
            (목록이면 여러 건도 한 번에). 최대 5장.
            결제 캡쳐는 분석 후 즉시 폐기되고 서버에 저장되지 않아요.
          </p>
        </>
      )}

      <div className="prev" style={{ marginTop: 9 }}>
      {showCurrencyPicker && (
        <div style={{ marginBottom: 6 }}>
          <div className="chips">
            <span className="note" style={{ marginRight: 4 }}>💱 입력 단위</span>
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
          <p className="note" style={{ margin: '4px 0 0' }}>
            단위를 안 적은 숫자는 <b>{currencyName(activeCurrency)}</b>({activeCurrency})로 읽어요.
            {' '}<b>원</b>{currencies.length > 2 ? ' 처럼 단위를 적으면' : '을 붙이면'} 그 단위로 들어가요.
          </p>
        </div>
      )}

      <div className="chips" style={{ marginBottom: 6 }}>
        <span className="note" style={{ marginRight: 4 }}>💳 결제 수단</span>
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.code}
            className={'chip' + (activePayment === m.code ? ' on' : '')}
            onClick={() => pickPayment(m.code)}
          >
            {paymentChip(m.code)}
          </button>
        ))}
      </div>

      {members.length > 0 && (
        <>
          <div className="chips" style={{ marginBottom: 6 }}>
            <span className="note" style={{ marginRight: 4 }}>🙋 결제자</span>
            {members.map((m) => (
              <button
                key={m.id}
                className={'chip' + (activePayer === m.id ? ' on' : '')}
                onClick={() => pickPayer(m.id)}
              >
                <MemberName emoji={m.emoji} name={m.personName} />
              </button>
            ))}
          </div>

          <div>
            <div className="chips">
              <span className="note" style={{ marginRight: 4 }}>🏷️ 비용 구분</span>
              <button className={'chip fund' + (activeCostMode === 'fund' ? ' on' : '')} onClick={() => pickCostMode('fund')}>
                공금
              </button>
              <button className={'chip' + (activeCostMode === 'personal' ? ' on' : '')} onClick={() => pickCostMode('personal')}>
                개인비용
              </button>
            </div>
            <p className="note" style={{ margin: '4px 0 0' }}>
              사용내역에 이름을 안 적으면 공금, {memberNames.join(' · ') || '참여자'} 중 하나를 적으면 그 사람 개인 결제로 들어가요.
            </p>
          </div>
        </>
      )}

      </div>

      {mode === 'text' && (
      <>
      <textarea
        className="ta"
        style={{ marginTop: 9 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'쓴 만큼 한 줄씩 적으세요.\n훠궈 380\n택시 45 쪼리미\n마사지 198 혜연\n숙소 24만원'}
      />
      <div className="row2" style={{ marginTop: 10 }}>
        <button className="btn quiet" style={{ flex: '0 0 32%' }} onClick={handleClear}>지우기</button>
        <button className="btn" onClick={handleParse}>입력하기</button>
      </div>
      </>
      )}

      {preview.length > 0 && (
        <div>
          <div className="sec">✅ 확인하고 저장</div>
          {preview.map((p, i) => (
            <div className="prev" key={i}>
              <div className="l1">
                <input value={p.title} onChange={(e) => updatePreviewItem(i, { title: e.target.value })} />
                <button className="chip" onClick={() => removePreviewItem(i)}>빼기</button>
              </div>
              <EntryFields
                value={p}
                onChange={(patch) => updatePreviewItem(i, patch)}
                currencies={currencies}
                members={members}
                onRecalcRate={() => recalcRateForItem(i)}
                emptyRateHint="환율은 저장할 때 계산돼요. 고치려면 위 칸에 직접 적거나 버튼을 누르세요."
              />
            </div>
          ))}
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}

      {error && <p className="err">{error}</p>}

      {lastSaved && lastSaved.length > 0 && (
        <div>
          <div className="sec">🧾 이번 사용금액</div>
          {lastSaved.map((e) => (
            <div className="box" style={{ marginBottom: 8 }} key={e.id}>
              <div className="tr"><span className="k">이름</span><span className="v txt">{e.title}</span></div>
              <div className="tr"><span className="k">일자</span><span className="v">{e.date}{e.time ? ` · ${e.time}` : ''}</span></div>
              <div className="tr"><span className="k">결제수단</span><span className="v txt">{paymentChip(e.payment_method)}</span></div>
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

      <div className="sec">👤 공금 외 지출내역 (누적)</div>
      <div className="box">
        {members.map((m) => (
          <div className="tr" key={m.id}>
            <span className="k"><MemberName emoji={m.emoji} name={m.personName} /></span>
            <span className="v"><Pair amount={totals.perMember[m.id]?.cny ?? 0} krw={totals.perMember[m.id]?.krw ?? 0} currency={summary} /></span>
          </div>
        ))}
      </div>

      <div className="sec">💰 잔여 예산</div>
      <div className="box">
        <div className="tr"><span className="k">예산 총액</span><span className="v"><Pair amount={totals.budgetCny} krw={totals.budget} currency={summary} /></span></div>
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
