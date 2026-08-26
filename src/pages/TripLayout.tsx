import { NavLink, Outlet, useParams } from 'react-router-dom'
import { won, yuan } from '../lib/format'

export function TripLayout() {
  const { code } = useParams()

  return (
    <div className="wrap">
      <header className="head">
        <div className="eyebrow">{code}</div>
        <h1 className="title">우리 여행</h1>
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
