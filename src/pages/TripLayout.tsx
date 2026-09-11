import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals } from '../lib/totals'
import { foreign, won } from '../lib/format'
import { BASE_CURRENCY, summaryCurrency } from '../lib/tripCurrency'

export function TripLayout() {
  const { trip } = useTrip()
  const { allMembers } = useTripMembers(trip?.id)
  const { rates } = useRates(trip?.id, trip?.code)
  const { entries, refresh } = useEntries(trip?.id)
  const { budgets, refresh: refreshBudgets } = useBudgets(trip?.id)
  usePolling(refresh, !!trip?.id)
  // 예산도 폴링한다. 헤더(TripLayout)는 탭을 옮겨도 언마운트되지 않아서, 이게 없으면
  // 다른 사람이 공금을 더 걷어도 새로고침 전까지 낡은 잔여가 계속 보인다.
  // useBudgets 는 여행별 공유 캐시라 여기서 한 번만 돌리면 모든 화면이 같이 갱신된다.
  usePolling(refreshBudgets, !!trip?.id)

  const summary = summaryCurrency(trip)
  const totals = computeTotals(entries, allMembers, budgets, rates, summary)

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">{trip?.name}</h1>
          <div className="eyebrow">
            {trip?.end_date && trip.end_date !== trip.start_date ? (
              <>
                <span>{trip.start_date}</span>
                <span>~</span>
                <span>{trip.end_date}</span>
              </>
            ) : (
              <span>{trip?.start_date}</span>
            )}
          </div>
        </div>
        {totals.pots.map((pot, i) => {
          const isForeign = pot.currency !== BASE_CURRENCY && pot.budgetForeign > 0
          return (
            <div key={pot.currency}>
              <div className="remain">
                {/* 외화 주머니는 지갑에 남은 외화가 주인공이고 원화는 참고값이다. */}
                <b>{i === 0 ? '💰 ' : ''}{isForeign ? foreign(pot.remainForeign, pot.currency) : won(pot.remainKrw)}</b>
                <em>{isForeign ? won(pot.remainKrw) : ''}</em>
                <span>
                  <span>
                    잔여 · {isForeign
                      ? `${foreign(pot.budgetForeign, pot.currency)}${pot.prepaid ? ' 환전' : ' 한도'}`
                      : won(pot.budgetKrw)}
                  </span>
                  <span>{pot.pct.toFixed(1)}% 사용</span>
                </span>
              </div>
              <div className="gauge">
                <i
                  className={pot.remainKrw < 0 ? 'over' : ''}
                  style={{ width: `${Math.min(100, Math.max(0, pot.pct))}%` }}
                />
              </div>
            </div>
          )
        })}
      </header>

      <Outlet />

      <nav className="tabs">
        <NavLink to="." end className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">🏠</span>홈
        </NavLink>
        <NavLink to="record" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">✏️</span>기록
        </NavLink>
        <NavLink to="history" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">📄</span>내역
        </NavLink>
        <NavLink to="settings" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">⚙️</span>설정
        </NavLink>
      </nav>
    </div>
  )
}
