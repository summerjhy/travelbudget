import { NavLink, Outlet } from 'react-router-dom'
import { useNote } from '../context/NoteContext'

export function TripLayout() {
  const { trip } = useNote()

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
        <p className="subtitle">🔍 비밀친구 관찰일지</p>
      </header>

      <Outlet />

      <nav className="tabs">
        <NavLink to="." end className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">🏠</span>홈
        </NavLink>
        <NavLink to="record" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">✍️</span>기록
        </NavLink>
        <NavLink to="history" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">📖</span>내 메모
        </NavLink>
        <NavLink to="deliver" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">💌</span>발송
        </NavLink>
        <NavLink to="settings" className={({ isActive }) => 'tab' + (isActive ? ' on' : '')}>
          <span className="ico" aria-hidden="true">⚙️</span>설정
        </NavLink>
      </nav>
    </div>
  )
}
