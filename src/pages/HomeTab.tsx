import { useMemo } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals, entryCurrency } from '../lib/totals'
import { latestRateFor } from '../lib/rates'
import { summaryCurrency, foreignCurrencies } from '../lib/tripCurrency'
import { won } from '../lib/format'
import { paymentLabel } from '../lib/payment'
import { Pair } from '../components/Pair'
import { useTripNames } from '../lib/useTripNames'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 두 날짜 사이의 일수. 같은 날이면 0. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')
  return Math.round(ms / 86400000)
}

/**
 * 여행이 언제인지 한 줄로. 시작 전이면 D-n, 여행 중이면 n일차,
 * 끝났으면 '여행 완료'.
 */
function tripPhase(start: string, end: string | null): string {
  const today = todayDate()
  const last = end ?? start
  if (today < start) {
    const d = daysBetween(today, start)
    return d === 1 ? '내일 출발' : `D-${d}`
  }
  if (today > last) return '여행 완료'
  const nth = daysBetween(start, today) + 1
  const total = daysBetween(start, last) + 1
  return `${nth}일차 / ${total}일`
}

export function HomeTab() {
  const { trip, personName } = useTrip()
  const { members, allMembers } = useTripMembers(trip?.id)
  const { rates } = useRates(trip?.id, trip?.code)
  const { entries, refresh } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)
  const { names: tripNames } = useTripNames()
  usePolling(refresh, !!trip?.id)

  const summary = summaryCurrency(trip)
  const totals = computeTotals(entries, allMembers, budgetTotal, summary, latestRateFor(rates, summary))

  const today = todayDate()
  const todaySpend = useMemo(
    () => entries.filter((e) => e.date === today).reduce((sum, e) => sum + Number(e.krw), 0),
    [entries, today],
  )

  // 카테고리별 원화 합계 — 통화가 섞여도 원화는 언제나 더할 수 있다.
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.krw))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [entries])

  const recent = entries.slice(0, 5)
  const maxCat = byCategory.length ? byCategory[0][1] : 0

  if (!trip) return null

  return (
    <section className="pad">
      <div className="sec first">🧳 이번 여행</div>
      <div className="box">
        <div className="tr">
          <span className="k">일정</span>
          <span className="v txt">
            {trip.start_date.slice(5).replace('-', '/')}
            {trip.end_date && ` – ${trip.end_date.slice(5).replace('-', '/')}`}
            <span className="badge" style={{ marginLeft: 6 }}>{tripPhase(trip.start_date, trip.end_date)}</span>
          </span>
        </div>
        {trip.destinations.length > 0 && (
          <div className="tr"><span className="k">목적지</span><span className="v txt">{trip.destinations.join(' · ')}</span></div>
        )}
        <div className="tr">
          <span className="k">함께</span>
          <span className="v txt">{members.map((m) => m.personName).join(' · ') || '나 혼자'}</span>
        </div>
        {foreignCurrencies(trip).length > 0 && (
          <div className="tr">
            <span className="k">환율</span>
            <span className="v">
              {foreignCurrencies(trip)
                .map((c) => {
                  const r = latestRateFor(rates, c)
                  return r ? `1${c}=₩${r.toFixed(2)}` : `${c} —`
                })
                .join('  ')}
            </span>
          </div>
        )}
      </div>

      <div className="sec">💰 예산</div>
      <div className="box">
        <div className="tr"><span className="k">예산 총액</span><span className="v">{won(totals.budget)}</span></div>
        <div className="tr"><span className="k">공금 사용</span><span className="v"><Pair amount={totals.fund.cny} krw={totals.fund.krw} currency={summary} /></span></div>
        <div className="tr"><span className="k">오늘 쓴 돈</span><span className="v">{won(todaySpend)}</span></div>
        <div className="tr" style={{ background: 'var(--accent-soft)' }}>
          <span className="k" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>잔여</span>
          <span className="v" style={{ color: totals.remain < 0 ? 'var(--rose)' : 'var(--accent-ink)', fontWeight: 600 }}>
            <Pair amount={totals.remainCny} krw={totals.remain} currency={summary} />
          </span>
        </div>
      </div>

      {byCategory.length > 0 && (
        <>
          <div className="sec">📊 어디에 썼나</div>
          <div className="box">
            {byCategory.map(([cat, amount]) => (
              <div className="tr" key={cat}>
                <span className="k" style={{ flex: '0 0 62px' }}>{cat}</span>
                <span className="catbar" aria-hidden="true">
                  <i style={{ width: `${maxCat ? Math.max(3, (amount / maxCat) * 100) : 0}%` }} />
                </span>
                <span className="v">{won(amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec">👤 공금 외 지출 (누적)</div>
      <div className="box">
        {members.length === 0 && <div className="tr"><span className="k">참여자가 없어요</span></div>}
        {members.map((m) => (
          <div className="tr" key={m.id}>
            <span className="k">
              {m.personName}
              {m.personName === personName && <span className="badge" style={{ marginLeft: 5 }}>나</span>}
            </span>
            <span className="v">
              <Pair amount={totals.perMember[m.id]?.cny ?? 0} krw={totals.perMember[m.id]?.krw ?? 0} currency={summary} />
            </span>
          </div>
        ))}
      </div>

      <div className="sec">🧾 최근 기록</div>
      {recent.length === 0 ? (
        <div className="empty">아직 기록이 없어요.<br />기록 탭에서 첫 지출을 남겨보세요.</div>
      ) : (
        <div className="box">
          {recent.map((e) => (
            <div className="tr" key={e.id}>
              <span className="k">
                {e.title}
                <span style={{ opacity: 0.6, fontSize: 11 }}>
                  {' · '}{e.date.slice(5).replace('-', '/')}{' · '}{paymentLabel(e.payment_method)}
                </span>
              </span>
              <span className="v"><Pair amount={e.cny} krw={e.krw} currency={entryCurrency(e)} /></span>
            </div>
          ))}
        </div>
      )}

      <div className="sec">🗺️ 전체 여행</div>
      {tripNames.length === 0 ? (
        <div className="box"><div className="tr"><span className="k">아직 만들어진 여행이 없어요</span></div></div>
      ) : (
        <div className="box">
          {tripNames.map((t) => (
            <div className="tr" key={t.trip_id}>
              <span className="k" style={{ color: t.trip_id === trip.id ? "var(--accent-ink)" : undefined, fontWeight: t.trip_id === trip.id ? 600 : undefined }}>
                {t.name}
              </span>
              {t.trip_id === trip.id && <span className="badge">지금 보는 중</span>}
            </div>
          ))}
        </div>
      )}
      <p className="note" style={{ marginTop: 9 }}>
        만들어진 여행 이름만 보여요. 들어가려면 그 여행의 참여 코드가 필요해요.
      </p>
      <div style={{ height: 20 }} />
    </section>
  )
}
