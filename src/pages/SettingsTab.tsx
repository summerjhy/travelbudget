import { useState } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useBudgets } from '../lib/useBudgets'
import { won } from '../lib/format'
import { currencyLabel } from '../lib/currencies'
import { foreignCurrencies } from '../lib/tripCurrency'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SettingsTab() {
  const { trip, personName, switchTrip } = useTrip()
  const { members } = useTripMembers(trip?.id)
  const { rates, setManualRate, fetchNow } = useRates(trip?.id, trip?.code)
  const { budgets, total, addBudget, removeBudget } = useBudgets(trip?.id)

  const [addAmount, setAddAmount] = useState('')
  const [addMemo, setAddMemo] = useState('')
  // 통화별 직접입력 칸. 통화 코드 → 입력 중인 값.
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  const [rateBusy, setRateBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedRateDates = Object.keys(rates).sort()
  const currencies = foreignCurrencies(trip)
  // 환율도 예산도 "지금" 기준이다. 여행 시작일이 아직 안 왔다고 그 날짜로 잡으면
  // 미래 날짜라 외부 API 가 값을 못 주고, 목록에도 오늘이 아닌 날짜가 떠서 헷갈린다.
  const defaultRateDate = todayDate()

  async function handleAddBudget() {
    const amount = Number(addAmount.replace(/[^\d]/g, ''))
    if (!amount) return
    const result = await addBudget(amount, defaultRateDate, addMemo.trim() || '추가 예산')
    if (result.ok) {
      setAddAmount('')
      setAddMemo('')
    } else {
      setError(result.error ?? '예산 추가에 실패했어요.')
    }
  }

  async function handleRemoveBudget(id: string) {
    if (!confirm('이 예산 항목을 지울까요?')) return
    const result = await removeBudget(id)
    if (!result.ok) setError(result.error ?? '삭제에 실패했어요.')
  }

  async function handleManualRate(currency: string) {
    const v = parseFloat(rateInputs[currency] ?? '')
    if (!v) return
    const result = await setManualRate(defaultRateDate, currency, v)
    if (result.ok) {
      setRateInputs((prev) => ({ ...prev, [currency]: '' }))
    } else {
      setError(result.error ?? '환율 저장에 실패했어요.')
    }
  }

  /** 여행에 설정된 외화를 한 번에 조회한다 (Edge Function 이 통화 목록을 보고 전부 돌려준다). */
  async function handleFetchNow() {
    setRateBusy(true)
    setError(null)
    const result = await fetchNow(defaultRateDate)
    setRateBusy(false)
    if (!result.ok) {
      setError(result.error ?? '환율을 못 가져왔어요. 직접 입력해주세요.')
      return
    }
    const missing = currencies.filter((c) => result.rates?.[c] === undefined)
    if (missing.length > 0) {
      setError(`${missing.join(', ')} 환율은 못 가져왔어요. 아래에 직접 입력해주세요.`)
    }
  }

  return (
    <section className="pad">
      <div className="sec first">공금 예산</div>
      <div className="box" style={{ marginBottom: 10 }}>
        {budgets.map((b) => (
          <div className="tr" key={b.id}>
            <span className="k">
              {b.memo || b.date}
              <span style={{ opacity: 0.6, fontSize: 11.5 }}> · {b.date}</span>
            </span>
            <span className="v">
              {won(b.amount)}
              {budgets.length > 1 && (
                <button className="x" style={{ color: 'var(--rose)', fontSize: 11, marginLeft: 6 }} onClick={() => handleRemoveBudget(b.id)}>삭제</button>
              )}
            </span>
          </div>
        ))}
        <div className="tr" style={{ background: 'rgba(42,107,92,.06)' }}>
          <span className="k" style={{ fontWeight: 600, color: 'var(--ink)' }}>합계</span>
          <span className="v" style={{ fontWeight: 600 }}>{won(total)}</span>
        </div>
      </div>
      <div className="row2" style={{ marginBottom: 7 }}>
        <input className="inp num" inputMode="numeric" placeholder="추가 금액 (원)" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
        <input className="inp" placeholder="메모" style={{ flex: '0 0 38%' }} value={addMemo} onChange={(e) => setAddMemo(e.target.value)} />
      </div>
      <button className="btn ghost" onClick={handleAddBudget}>예산 추가</button>
      <p className="note" style={{ marginTop: 9 }}>여행 중에 공금을 더 걷으면 여기에 추가하세요. 예산 총액과 잔여가 바로 반영돼요.</p>

      {currencies.length > 0 && (
        <>
        <div className="sec">환율 · 원화 기준</div>
        <p className="note" style={{ marginBottom: 10 }}>
          이 여행에 설정된 통화를 한 번에 조회해서 날짜별로 저장해둬요. 직접 적으면 그 값이 우선이에요.
          내역에서 외화·원화를 둘 다 입력하면 그 건은 실제 청구 환율로 잡혀요.
        </p>
        <div className="box" style={{ marginBottom: 10 }}>
          <div className="tr" style={{ background: 'rgba(42,107,92,.06)' }}>
            <span className="k" style={{ fontWeight: 600, color: 'var(--ink)' }}>날짜</span>
            <span className="v" style={{ fontWeight: 600 }}>
              {currencies.map((c) => `1${c}`).join(' · ')}
            </span>
          </div>
          {sortedRateDates.length ? (
            sortedRateDates.map((d) => (
              <div className="tr" key={d}>
                <span className="k">{d}</span>
                <span className="v">
                  {currencies
                    .map((c) => (rates[d]?.[c] !== undefined ? `₩${rates[d][c].toFixed(2)}` : '—'))
                    .join(' · ')}
                </span>
              </div>
            ))
          ) : (
            <div className="tr"><span className="k">저장된 환율</span><span className="v txt">없음</span></div>
          )}
        </div>

        <button className="btn ghost" onClick={handleFetchNow} disabled={rateBusy}>
          {rateBusy ? '조회 중...' : `오늘(${defaultRateDate}) 환율 일괄 조회`}
        </button>

        <div className="sec">환율 직접 입력</div>
        {currencies.map((c) => (
          <div className="row2" style={{ marginBottom: 7 }} key={c}>
            <span className="k" style={{ flex: '0 0 42%', alignSelf: 'center', fontSize: 13 }}>
              1 {currencyLabel(c)}
            </span>
            <input
              className="inp num"
              inputMode="decimal"
              aria-label={`${c} 환율 직접 입력`}
              placeholder={rates[defaultRateDate]?.[c] !== undefined ? String(rates[defaultRateDate][c].toFixed(2)) : '원'}
              value={rateInputs[c] ?? ''}
              onChange={(e) => setRateInputs((prev) => ({ ...prev, [c]: e.target.value }))}
              onBlur={() => handleManualRate(c)}
            />
          </div>
        ))}
        <p className="note" style={{ marginTop: 7 }}>
          입력·조회 모두 오늘({defaultRateDate}) 날짜로 저장돼요. 다른 날짜 환율은 그 날 조회하면 따로 쌓여요.
        </p>
        </>
      )}

      {error && <p className="err">{error}</p>}

      <div className="sec">여행 정보</div>
      <div className="box">
        <div className="tr"><span className="k">여행 이름</span><span className="v txt">{trip?.name}</span></div>
        <div className="tr"><span className="k">참여 코드</span><span className="v">{trip?.code}</span></div>
        <div className="tr"><span className="k">목적지</span><span className="v txt">{trip?.destinations?.length ? trip.destinations.join(' · ') : '미지정'}</span></div>
        <div className="tr"><span className="k">사용 통화</span><span className="v txt">{trip?.spend_currencies?.join(' · ') || '-'}</span></div>
        <div className="tr"><span className="k">내 이름</span><span className="v txt">{personName}</span></div>
      </div>

      <div className="sec">참여자</div>
      <div className="box">
        {members.map((m) => (
          <div className="tr" key={m.id}><span className="k">{m.personName}</span></div>
        ))}
      </div>

      <div className="sec">홈 화면에 앱처럼 두기</div>
      <div className="box" style={{ padding: '14px 15px', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>아이폰 (Safari)</div>
        <ol className="steps">
          <li>카톡에서 링크를 연 뒤 오른쪽 아래 <b>⋯ → Safari로 열기</b></li>
          <li>아래 가운데 <b>공유 버튼(↑)</b> 탭</li>
          <li><b>홈 화면에 추가</b> 선택</li>
          <li>이름 바꾸고 <b>추가</b></li>
        </ol>
      </div>
      <div className="box" style={{ padding: '14px 15px' }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>갤럭시 (Chrome)</div>
        <ol className="steps">
          <li>카톡에서 링크를 연 뒤 <b>다른 브라우저로 열기 → Chrome</b></li>
          <li>오른쪽 위 <b>⋮</b> 탭</li>
          <li><b>홈 화면에 추가</b> 선택</li>
          <li><b>설치</b> 또는 <b>추가</b> 누르기</li>
        </ol>
      </div>
      <p className="note" style={{ marginTop: 9 }}>
        홈 화면에 설치하면 앱처럼 아이콘으로 바로 열 수 있어요.
      </p>

      <div className="sec">캡쳐로 바로 기록하기</div>
      <div className="box" style={{ padding: '14px 15px' }}>
        <p className="note" style={{ margin: 0 }}>
          <b>갤럭시(안드로이드)</b>: 카드 결제 캡쳐를 찍고 공유 버튼을 누르면 공유 대상 목록에 이 앱이 떠요. 앱을 고르면 캡쳐 → 공유만으로 자동 분석까지 끝나요.
        </p>
        <p className="note" style={{ margin: '9px 0 0' }}>
          <b>아이폰(iOS)</b>: iOS는 앱 간 공유 시트에 홈 화면 앱을 등록하는 기능을 지원하지 않아요. 기록 탭의 <b>사진으로 읽어들이기</b> 버튼으로 캡쳐를 직접 선택해주세요.
        </p>
      </div>

      <div className="sec">다른 여행</div>
      <button className="btn quiet" onClick={switchTrip}>다른 여행 코드로 전환</button>
      <p className="note" style={{ marginTop: 9 }}>
        새 코드를 입력하면 그 여행으로 이동해요. 지금 코드를 다시 입력하면 이 여행으로 돌아올 수 있어요.
      </p>
      <div style={{ height: 30 }} />
    </section>
  )
}
