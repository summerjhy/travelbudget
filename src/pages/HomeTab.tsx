import { useMemo } from 'react'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals } from '../lib/totals'
import { latestRateFor } from '../lib/rates'
import { summaryCurrency, foreignCurrencies } from '../lib/tripCurrency'
import { won } from '../lib/format'
import { Pair } from '../components/Pair'
import { useTripNames } from '../lib/useTripNames'
import { CategoryPie } from '../components/CategoryPie'
import { Collapsible } from '../components/Collapsible'
import { todayForTrip } from '../lib/tripDate'

/** 진행중 -> 준비중 -> 종료 순. 지금 쓰는 여행이 맨 위로 온다. */
const TRIP_GROUPS = [
  { key: 'ongoing', label: '🟢 진행중인 여행' },
  { key: 'upcoming', label: '🗓 준비중인 여행' },
  { key: 'ended', label: '✅ 종료된 여행' },
] as const

/** 두 날짜 사이의 일수. 같은 날이면 0. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')
  return Math.round(ms / 86400000)
}

/**
 * 여행이 언제인지 한 줄로. 시작 전이면 D-n, 여행 중이면 n일차,
 * 끝났으면 '여행 완료'.
 */
function tripPhaseLabel(start: string, end: string | null, today: string): string {
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

  const today = todayForTrip(trip)
  const todaySpend = useMemo(
    () => entries.filter((e) => e.date === today).reduce((sum, e) => sum + Number(e.krw), 0),
    [entries, today],
  )

  // 카테고리별 원화 합계 — 통화가 섞여도 원화는 언제나 더할 수 있다.
  // 원형 그래프는 공금 지출만 담는다 — 개인 지출은 각자 돈이라 예산과 무관하다.
  const fundByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.member_id !== null) continue
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.krw))
    }
    return [...map.entries()].map(([label, amount]) => ({ label, amount }))
  }, [entries])

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
            <span className="badge" style={{ marginLeft: 6 }}>{tripPhaseLabel(trip.start_date, trip.end_date, today)}</span>
          </span>
        </div>
        {trip.destinations.length > 0 && (
          <div className="tr"><span className="k">목적지</span><span className="v txt">{trip.destinations.join(' · ')}</span></div>
        )}
        <div className="tr">
          <span className="k">함께</span>
          <span className="v txt">{members.map((m) => m.displayName).join(' · ') || '나 혼자'}</span>
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

      <div className="sec">📊 어디에 썼을까? (공금 내 지출 금액 기준)</div>
      <CategoryPie slices={fundByCategory} />

      <div className="sec">👤 공금 외 지출 (누적)</div>
      <div className="box">
        {members.length === 0 && <div className="tr"><span className="k">참여자가 없어요</span></div>}
        {members.map((m) => (
          <div className="tr" key={m.id}>
            <span className="k">
              {m.displayName}
              {m.personName === personName && <span className="badge" style={{ marginLeft: 5 }}>나</span>}
            </span>
            <span className="v">
              <Pair amount={totals.perMember[m.id]?.cny ?? 0} krw={totals.perMember[m.id]?.krw ?? 0} currency={summary} />
            </span>
          </div>
        ))}
      </div>

      <div className="sec">🗺️ 전체 여행</div>
      {tripNames.length === 0 ? (
        <div className="box"><div className="tr"><span className="k">아직 만들어진 여행이 없어요</span></div></div>
      ) : (
        TRIP_GROUPS.map(({ key, label }) => {
          const list = tripNames.filter((t) => (t.phase ?? 'upcoming') === key)
          if (list.length === 0) return null
          return (
            <Collapsible
              key={key}
              title={`${label} · ${list.length}개`}
              // 진행중인 여행만 펼쳐둔다. 지금 보고 있을 확률이 가장 높다.
              defaultOpen={key === 'ongoing'}
            >
              {list.map((t) => (
                <div className="tr" key={t.trip_id}>
                  <span
                    className="k"
                    style={{
                      color: t.trip_id === trip.id ? 'var(--accent-ink)' : undefined,
                      fontWeight: t.trip_id === trip.id ? 600 : undefined,
                    }}
                  >
                    {t.name}
                  </span>
                  {t.trip_id === trip.id && <span className="badge">지금 보는 중</span>}
                </div>
              ))}
            </Collapsible>
          )
        })
      )}
      <p className="note" style={{ marginTop: 9 }}>
        만들어진 여행 이름만 보여요. 들어가려면 설정 탭 &gt; 맨 하단의 <b>다른 여행 코드로 전환</b>을 눌러주세요.
      </p>
      <div style={{ height: 20 }} />
    </section>
  )
}
