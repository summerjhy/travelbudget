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
        <div className="eyebrow">{trip?.code}</div>
        <h1 className="title">{trip?.name}</h1>
        <div className="remain">
          <b>{won(totals.remain)}</b>
          {summary && <em>{foreign(totals.remainCny, summary)}</em>}
          <span>잔여 · 예산 {won(totals.budget)} 중 {totals.pct.toFixed(1)}% 사용</span>
        </div>
        <div className="gauge">
          <i
            className={totals.remain < 0 ? 'over' : ''}
            style={{ width: `${Math.min(100, Math.max(0, totals.pct))}%` }}
          />
        </div>
      </header>

      <nav className="tabs">
        <NavLink to="." end className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>기록</NavLink>
        <NavLink to="history" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>내역</NavLink>
        <NavLink to="settings" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>설정</NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
