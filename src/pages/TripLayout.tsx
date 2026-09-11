import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../context/TripContext'
import { useTripMembers } from '../lib/useTripMembers'
import { useRates } from '../lib/useRates'
import { useEntries } from '../lib/useEntries'
import { useBudgets } from '../lib/useBudgets'
import { usePolling } from '../lib/usePolling'
import { computeTotals } from '../lib/totals'
import { money } from '../lib/format'
import { summaryCurrency } from '../lib/tripCurrency'

export function TripLayout() {
  const { trip } = useTrip()
  const { members } = useTripMembers(trip?.id)
  useRates(trip?.id, trip?.code)
  const { entries, refresh } = useEntries(trip?.id)
  const { budgets } = useBudgets(trip?.id)
  usePolling(refresh, !!trip?.id)

  const totals = computeTotals(entries, members, budgets, summaryCurrency(trip))

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{trip?.code}</div>
        <h1 className="title">{trip?.name}</h1>
        <div className="pots">
          {totals.pots.map((pot, i) => (
            <div className={'pot' + (i > 0 ? ' sub' : '')} key={pot.currency}>
              <b>{money(pot.remain, pot.currency)}</b>
              <em>
                잔여 · 예산 {money(pot.budget, pot.currency)} 중 {pot.pct.toFixed(1)}% 사용
              </em>
              <div className="gauge">
                <i
                  className={pot.remain < 0 ? 'over' : ''}
                  style={{ width: `${Math.min(100, Math.max(0, pot.pct))}%` }}
                />
              </div>
            </div>
          ))}
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
