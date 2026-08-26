import { NavLink, Outlet } from 'react-router-dom'
import { useTrip } from '../context/TripContext'
import { won, yuan } from '../lib/format'

export function TripLayout() {
  const { trip } = useTrip()

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{trip?.code}</div>
        <h1 className="title">{trip?.name}</h1>
        <div className="remain">
          <b>{won(0)}</b>
          <em>{yuan(0)}</em>
          <span>잔여 · 불러오는 중</span>
        </div>
        <div className="gauge"><i style={{ width: '0%' }} /></div>
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
