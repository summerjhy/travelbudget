import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals } from '../lib/totals'
import { won, yuan } from '../lib/format'

function latestRate(ratesByDate: Record<string, number>): number {
  const keys = Object.keys(ratesByDate).sort()
  return keys.length ? ratesByDate[keys[keys.length - 1]] : 0
}

export function TripLayout() {
  const { trip } = useTrip()
  const { members } = useTripMembers(trip?.id)
  const { ratesByDate } = useRates(trip?.id, trip?.code)
  const { entries, refresh } = useEntries(trip?.id)
  const { total: budgetTotal } = useBudgets(trip?.id)
  usePolling(refresh, !!trip?.id)

  const totals = computeTotals(entries, members, budgetTotal, latestRate(ratesByDate))

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{trip?.code}</div>
        <h1 className="title">{trip?.name}</h1>
        <div className="remain">
          <b>{won(totals.remain)}</b>
          <em>{yuan(totals.remainCny)}</em>
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
