import { useEffect, useState } from 'react'
import { useAdmin } from '../context/AdminContext'
import { listJournalTrips, type AdminJournalTrip } from '../lib/adminJournal'

export function AdminBrowse({
  onEnter,
  onBack,
}: {
  onEnter: (code: string) => void
  onBack: () => void
}) {
  const { password } = useAdmin()
  const [trips, setTrips] = useState<AdminJournalTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<AdminJournalTrip | null>(null)

  useEffect(() => {
    if (!password) return
    let alive = true
    listJournalTrips(password).then((r) => {
      if (!alive) return
      if (r.ok) setTrips(r.data.trips)
      else setError(r.error)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [password])

  return (
    <div className="wrap">
      <header className="head">
        <div className="headrow">
          <h1 className="title">🧭 관찰일지 둘러보기</h1>
        </div>
        <p className="subtitle">코드 없이 아무 여행이나 열 수 있어요</p>
      </header>

      <div className="pad">
        <button className="btn quiet" style={{ marginBottom: 12 }} onClick={onBack}>돌아가기</button>

        {loading && <p className="note">불러오는 중...</p>}
        {error && <p className="err">{error}</p>}

        {confirming && (
          <div className="box" style={{ marginBottom: 12, padding: 14, borderColor: 'var(--coral)' }}>
            <p className="note" style={{ margin: '0 0 10px' }}>
              <b>'{confirming.name}'</b> 관찰일지를 둘러보시겠어요?
            </p>
            <div className="row2">
              <button className="btn quiet sm" style={{ flex: '0 0 34%' }} onClick={() => setConfirming(null)}>아니오</button>
              <button className="btn sm" onClick={() => onEnter(confirming.code)}>네, 들어갈래요</button>
            </div>
          </div>
        )}

        {!loading && trips.length === 0 && <div className="empty">아직 만들어진 관찰일지가 없어요.</div>}

        {!loading && trips.map((t) => (
          <button
            key={t.id}
            className="box"
            style={{ width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 8, display: 'block' }}
            onClick={() => setConfirming(t)}
          >
            <div className="tr" style={{ border: 'none', padding: 0 }}>
              <span className="k" style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.name}</span>
              <span className="v txt" style={{ color: 'var(--coral-ink)' }}>둘러보기 →</span>
            </div>
          </button>
        ))}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
