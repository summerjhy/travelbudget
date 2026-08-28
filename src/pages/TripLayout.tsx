import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals } from '../lib/totals'
import { foreign, won } from '../lib/format'
import { summaryCurrency } from '../lib/tripCurrency'
import { latestRateFor } from '../lib/rates'

export function TripLayout() {
  const { trip } = useTrip()
  const { allMembers } = useTripMembers(trip?.id)
  const { rates } = useRates(trip?.id, trip?.code)
  const { entries, refresh } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)
  usePolling(refresh, !!trip?.id)

  const summary = summaryCurrency(trip)
  const totals = computeTotals(entries, allMembers, budgetTotal, summary, latestRateFor(rates, summary))

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
        <div className="remain">
          <b>💰 {won(totals.remain)}</b>
          {summary && <em>{foreign(totals.remainCny, summary)}</em>}
          <span>
            <span>잔여 예산</span>
            <span>{totals.pct.toFixed(1)}% 사용</span>
          </span>
        </div>
        <div className="gauge">
          <i
            className={totals.remain < 0 ? 'over' : ''}
            style={{ width: `${Math.min(100, Math.max(0, totals.pct))}%` }}
          />
        </div>
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
